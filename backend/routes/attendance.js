const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @desc    Get attendance for date range
// @route   GET /api/attendance
// @access  Private
// @desc    Get attendance for date range
// @route   GET /api/attendance
// @access  Private
const getAttendance = async (req, res) => {
  try {
    const {
      start_date = new Date().toISOString().split('T')[0],
      end_date = new Date().toISOString().split('T')[0],
      student_id,
      group_id // Filter by specific group
    } = req.query;

    let query = supabase
      .from('attendance')
      .select(`
        *,
        enrollment:enrollments!inner (
            id,
            student:students (id, name, student_code),
            group:groups!inner (
                id, name,
                offering:offerings!inner ( teacher_id, subject:subjects(*) )
            )
        )
      `)
      .gte('date', start_date)
      .lte('date', end_date)
      .eq('enrollment.group.offering.teacher_id', req.user.id)
      .order('date', { ascending: false });

    if (student_id) {
      // Filter via enrollment
      query = query.eq('enrollment.student_id', student_id);
    }

    if (group_id) {
      query = query.eq('enrollment.group_id', group_id);
    }

    const { data: attendance, error } = await query;

    if (error) throw error;

    // Transform result to flatter structure if helpful for frontend
    const flatAttendance = attendance.map(a => ({
      id: a.id,
      date: a.date,
      status: a.status,
      notes: a.notes,
      student_id: a.enrollment.student.id,
      group_id: a.enrollment.group.id,
      student: a.enrollment.student,
      group: {
        id: a.enrollment.group.id,
        name: a.enrollment.group.name,
        subject: a.enrollment.group.offering.subject.name_en
      }
    }));

    res.status(200).json({
      success: true,
      data: flatAttendance
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance'
    });
  }
};

// @desc    Mark attendance for students (Active in a Group)
// @route   POST /api/attendance
// @access  Private
const markAttendance = async (req, res) => {
  try {
    const incomingRecords = req.body.attendance_records || req.body.attendance;
    const requestDate = req.body.date;

    if (!incomingRecords || !Array.isArray(incomingRecords)) {
      return res.status(400).json({
        success: false,
        message: 'Attendance records array is required'
      });
    }

    const attendance_records = incomingRecords.map(record => ({
      ...record,
      date: record.date || requestDate
    })).filter(record => Boolean(record.student_id && record.group_id));

    if (attendance_records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Each attendance record must include student_id and group_id'
      });
    }

    // 1. Resolve Enrollments
    // We need to map (student_id, group_id) -> enrollment_id
    // Efficient way: Fetch all relevant enrollments for these pairs?
    // Or just fetch enrollments for the group(s) involved.
    // Assuming mostly one group per batch:
    const groupIds = [...new Set(attendance_records.map(r => r.group_id))];
    const studentIds = attendance_records.map(r => r.student_id);

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, group_id')
      .in('group_id', groupIds)
      .in('student_id', studentIds);

    const enrollmentMap = {};
    enrollments?.forEach(e => {
      enrollmentMap[`${e.student_id}_${e.group_id}`] = e.id;
    });

    const activeRecords = [];
    const missingEnrollments = [];

    attendance_records.forEach(record => {
      const enrollmentId = enrollmentMap[`${record.student_id}_${record.group_id}`];
      if (enrollmentId) {
        activeRecords.push({
          enrollment_id: enrollmentId,
          date: record.date || new Date().toISOString().split('T')[0],
          status: record.status,
          notes: record.notes
        });
      } else {
        missingEnrollments.push(record.student_id);
      }
    });

    if (activeRecords.length === 0) {
      return res.status(400).json({ error: 'No valid enrollments found for these students/groups' });
    }

    // 2. Upsert Attendance
    const { data: attendance, error } = await supabase
      .from('attendance')
      .upsert(activeRecords, {
        onConflict: 'enrollment_id,date'
      })
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(201).json({
      success: true,
      data: attendance,
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error marking attendance'
    });
  }
};

// @desc    Get attendance summary
// @route   GET /api/attendance/summary
// @access  Private
const getAttendanceSummary = async (req, res) => {
  try {
    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date = new Date().toISOString().split('T')[0]
    } = req.query;

    // Fetch all attendance for this teacher's offerings in range
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select(`
        status,
        enrollment:enrollments!inner (
             group:groups!inner (
                 offering:offerings!inner ( teacher_id )
             )
        )
      `)
      .gte('date', start_date)
      .lte('date', end_date)
      .eq('enrollment.group.offering.teacher_id', req.user.id);

    if (error) throw error;

    // Aggregation in JS (Server-side)
    const summary = {
      total_sessions: attendance.length,
      present_count: attendance.filter(a => a.status === 'present').length,
      absent_count: attendance.filter(a => a.status === 'absent').length,
      late_count: attendance.filter(a => a.status === 'late').length,
      excused_count: attendance.filter(a => a.status === 'excused').length
    };
    summary.attendance_rate = summary.total_sessions ? Math.round((summary.present_count / summary.total_sessions) * 100) : 0;

    res.status(200).json({
      success: true,
      data: summary // Note: Returned as single object summary for whole class/teacher view for now. 
      // If student-wise breakdown needed, frontend likely hits per-student endpoint or different route.
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance summary'
    });
  }
};

// Route definitions
router.get('/', authenticateToken, getAttendance);
router.post('/', authenticateToken, markAttendance);
router.get('/summary', authenticateToken, getAttendanceSummary);

module.exports = router;
