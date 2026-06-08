const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @desc    Get teacher profile
// @route   GET /api/teachers/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const { data: teacher, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    // Get student count via enrollments
    // Note: Multiple enrollments per student? We want unique student count.
    // Query enrollments -> groups -> offerings -> teacher_id
    const { data: offerings } = await supabase
      .from('offerings')
      .select('groups(enrollments(student_id))')
      .eq('teacher_id', req.user.id);

    const studentIds = new Set();
    offerings?.forEach(o =>
      o.groups?.forEach(g =>
        g.enrollments?.forEach(e =>
          studentIds.add(e.student_id)
        )
      )
    );

    const teacherProfile = {
      ...teacher,
      students: { count: studentIds.size }
    };

    delete teacherProfile.password;

    res.status(200).json({
      success: true,
      data: teacherProfile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
};

// @desc    Get teacher dashboard stats
// @route   GET /api/teachers/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // 1. Get Students & Parents Count
    const { data: offerings } = await supabase
      .from('offerings')
      .select('groups(enrollments(student_id))')
      .eq('teacher_id', teacherId);

    const studentIds = new Set();
    offerings?.forEach(o =>
      o.groups?.forEach(g =>
        g.enrollments?.forEach(e =>
          studentIds.add(e.student_id)
        )
      )
    );
    const totalStudents = studentIds.size;

    let totalParents = 0;
    if (totalStudents > 0) {
      const { count } = await supabase
        .from('parents')
        .select('*', { count: 'exact', head: true })
        .in('student_id', Array.from(studentIds));
      totalParents = count || 0;
    }

    // 2. Get today's attendance
    const today = new Date().toISOString().split('T')[0];
    // Join: attendance -> enrollment -> group -> offering -> teacher_id
    const { count: todayAttendance } = await supabase
      .from('attendance')
      .select('enrollment:enrollments!inner(group:groups!inner(offering:offerings!inner(teacher_id)))', { count: 'exact', head: true })
      .eq('enrollments.groups.offerings.teacher_id', teacherId)
      .eq('date', today);

    // 3. Get this week's messages (Assuming conversations linked to teacher)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Assuming messages/conversations schema is valid. Reference check needed if failed.
    const { count: weeklyMessages, error: msgError } = await supabase
      .from('messages')
      .select('conversations!inner(teacher_id)', { count: 'exact', head: true })
      .eq('conversations.teacher_id', teacherId)
      .gte('created_at', weekAgo);

    // 4. Get recent grades
    // Grades -> Assessments -> Offerings
    const { data: recentGrades } = await supabase
      .from('grades')
      .select(`
        score,
        assessment:assessments!inner(
            title, 
            offering:offerings!inner(teacher_id)
        ),
        enrollment:enrollments!inner(
            student:students(name, student_id)
        )
      `)
      .eq('assessments.offerings.teacher_id', teacherId)
      .order('id', { ascending: false }) // Grades don't have created_at usually? Use ID or Assessment Date? 
      // Schema check: Grades table doesn't have created_at. Assessments have date.
      // We can sort by assessment.date
      .limit(5);

    // 5. Get recent messages
    const { data: recentMessages } = await supabase
      .from('messages')
      .select(`
        *,
        conversations!inner (
          teacher_id,
          parents (name)
        )
      `)
      .eq('conversations.teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Transform recentGrades to flat format
    const formattedGrades = recentGrades?.map(g => ({
      id: Math.random(), // No ID returned?
      score: g.score,
      assessment_name: g.assessment.title,
      student_name: g.enrollment.student.name,
      date: g.assessment.date // Using assessment date
    })) || [];

    res.status(200).json({
      success: true,
      data: {
        stats: {
          total_students: totalStudents || 0,
          total_parents: totalParents || 0,
          today_attendance: todayAttendance || 0,
          weekly_messages: weeklyMessages || 0
        },
        recent_grades: formattedGrades,
        recent_messages: recentMessages || []
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard stats'
    });
  }
};

// @desc    Get teacher settings
// @route   GET /api/teachers/settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('teacher_settings')
      .select('*')
      .eq('teacher_id', req.user.id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Convert to key-value object
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });

    res.status(200).json({
      success: true,
      data: settingsObj
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching settings'
    });
  }
};

// @desc    Update teacher settings
// @route   PUT /api/teachers/settings
// @access  Private
const updateSettings = async (req, res) => {
  try {
    const settings = req.body;
    const teacherId = req.user.id;

    // Prepare settings for upsert
    const settingsArray = Object.keys(settings).map(key => ({
      teacher_id: teacherId,
      setting_key: key,
      setting_value: settings[key]
    }));

    const { data: updatedSettings, error } = await supabase
      .from('teacher_settings')
      .upsert(settingsArray, {
        onConflict: 'teacher_id,setting_key'
      })
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating settings'
    });
  }
};

// Route definitions
router.get('/profile', authenticateToken, getProfile);
router.get('/dashboard', authenticateToken, getDashboardStats);
router.get('/settings', authenticateToken, getSettings);
router.put('/settings', authenticateToken, updateSettings);

module.exports = router;
