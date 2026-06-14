const express = require('express');
const supabase = require('../config/database').supabaseAdmin;
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate, markAttendanceSchema, updateAttendanceSchema } = require('../middleware/validate');
const logger = require('../lib/logger');

const router = express.Router();

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
            teacher_id,
            student:students (id, name, student_code),
            group:groups!inner (
                id, name,
                offering:offerings!inner ( subject:subjects(*) )
            )
        ),
        session:sessions!inner (
            date
        )
      `)
      .gte('sessions.date', start_date)
      .lte('sessions.date', end_date)
      .eq('enrollment.teacher_id', req.user.id)
      .order('created_at', { ascending: false });

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
      date: a.session?.date,
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
    logger.error('Get attendance error', { error: error.message });
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
      .select('id, student_id, group_id, teacher_id')
      .in('group_id', groupIds)
      .in('student_id', studentIds)
      .eq('teacher_id', req.user.id);

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
      return res.status(400).json({ success: false, message: 'No valid enrollments found for these students/groups' });
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
    logger.error('Mark attendance error', { error: error.message });
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

    // Single RPC call replaces fetching all rows + JS-side aggregation
    const { data: summary, error: rpcError } = await supabase
      .rpc('attendance_summary', {
        p_teacher_id: req.user.id,
        p_start_date: start_date,
        p_end_date: end_date
      })
      .single();

    if (rpcError) throw rpcError;

    res.status(200).json({
      success: true,
      data: {
        total_sessions: Number(summary.total_sessions) || 0,
        present_count: Number(summary.present_count) || 0,
        absent_count: Number(summary.absent_count) || 0,
        late_count: Number(summary.late_count) || 0,
        excused_count: Number(summary.excused_count) || 0,
        attendance_rate: Number(summary.attendance_rate) || 0
      }
    });
  } catch (error) {
    logger.error('Get attendance summary error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching attendance summary'
    });
  }
};

// @desc    Update a single attendance record
// @route   PATCH /api/attendance/:id
// @access  Private
const updateAttendance = async (req, res) => {
  try {
    const { status, notes } = req.body;

    // Verify ownership via enrollment chain
    const { data: record, error: fetchError } = await supabase
      .from('attendance')
      .select(`
        id,
        enrollment:enrollments!inner (
          teacher_id
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (fetchError || !record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    if (record.enrollment.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const { data: updated, error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update attendance error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error updating attendance' });
  }
};

// ============================================================
// Attendance Lock Endpoints
// ============================================================

/**
 * @openapi
 * /api/attendance/lock:
 *   post:
 *     tags: [Attendance]
 *     summary: Acquire attendance lock
 *     description: Acquires a lock on a specific student for a session to prevent concurrent attendance editing. Locks expire after 5 minutes.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [session_id, student_id]
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Session UUID
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 description: Student UUID
 *     responses:
 *       201:
 *         description: Lock acquired successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AttendanceLock'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Lock conflict — another user holds the lock
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 code:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     locked_by:
 *                       type: string
 *                     locked_at:
 *                       type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
// Acquire lock on a student for a session
router.post('/lock', authenticateToken, requirePermission('manage_attendance'), async (req, res) => {
  try {
    const { session_id, student_id } = req.body;

    if (!session_id || !student_id) {
      return res.status(400).json({ success: false, message: 'session_id and student_id are required' });
    }

    // Check for existing lock
    const { data: existingLock } = await supabase
      .from('attendance_locks')
      .select('id, locked_by, locked_by_type, locked_at')
      .eq('session_id', session_id)
      .eq('student_id', student_id)
      .single();

    if (existingLock) {
      const lockAge = Date.now() - new Date(existingLock.locked_at).getTime();
      const fiveMinutes = 5 * 60 * 1000;

      if (lockAge < fiveMinutes) {
        // Lock is still active
        const lockOwnerName = existingLock.locked_by === req.user.id ? 'you' : 'another user';
        return res.status(409).json({
          success: false,
          message: `Locked by ${lockOwnerName}`,
          code: 'LOCK_CONFLICT',
          data: { locked_by: existingLock.locked_by, locked_at: existingLock.locked_at }
        });
      }

      // Lock expired — release and re-lock
      await supabase.from('attendance_locks').delete().eq('id', existingLock.id);
    }

    // Acquire new lock
    const { data: lock, error: lockError } = await supabase
      .from('attendance_locks')
      .insert([{
        session_id,
        student_id,
        locked_by: req.user.id,
        locked_by_type: req.user.role || 'teacher'
      }])
      .select()
      .single();

    if (lockError) throw lockError;

    res.status(201).json({ success: true, data: lock, message: 'Lock acquired' });
  } catch (error) {
    logger.error('Acquire attendance lock error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error acquiring lock' });
  }
});

/**
 * @openapi
 * /api/attendance/lock:
 *   delete:
 *     tags: [Attendance]
 *     summary: Release attendance lock
 *     description: Releases the lock on a student for a session. Only the lock owner can release it.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [session_id, student_id]
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Session UUID
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 description: Student UUID
 *     responses:
 *       200:
 *         description: Lock released successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
// Release lock
router.delete('/lock', authenticateToken, async (req, res) => {
  try {
    const { session_id, student_id } = req.body;

    if (!session_id || !student_id) {
      return res.status(400).json({ success: false, message: 'session_id and student_id are required' });
    }

    const { error } = await supabase
      .from('attendance_locks')
      .delete()
      .eq('session_id', session_id)
      .eq('student_id', student_id)
      .eq('locked_by', req.user.id);

    if (error) throw error;

    res.json({ success: true, message: 'Lock released' });
  } catch (error) {
    logger.error('Release attendance lock error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error releasing lock' });
  }
});

/**
 * @openapi
 * /api/attendance/lock/{sessionId}/{studentId}:
 *   get:
 *     tags: [Attendance]
 *     summary: Check lock status
 *     description: Checks whether a student is currently locked for a session. Expired locks (older than 5 minutes) are automatically cleaned up.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session UUID
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student UUID
 *     responses:
 *       200:
 *         description: Lock status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     locked:
 *                       type: boolean
 *                     id:
 *                       type: string
 *                     locked_by:
 *                       type: string
 *                     locked_by_type:
 *                       type: string
 *                     locked_at:
 *                       type: string
 *                     expires_at:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
// Check lock status
router.get('/lock/:sessionId/:studentId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, studentId } = req.params;

    const { data: lock, error } = await supabase
      .from('attendance_locks')
      .select('id, locked_by, locked_by_type, locked_at, expires_at')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .single();

    if (error || !lock) {
      return res.json({ success: true, data: { locked: false } });
    }

    const lockAge = Date.now() - new Date(lock.locked_at).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    const isExpired = lockAge >= fiveMinutes;

    if (isExpired) {
      await supabase.from('attendance_locks').delete().eq('id', lock.id);
      return res.json({ success: true, data: { locked: false } });
    }

    res.json({ success: true, data: { locked: true, ...lock } });
  } catch (error) {
    logger.error('Check attendance lock error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error checking lock' });
  }
});

// ============================================================
// Audit logging for attendance actions
// ============================================================

const markAttendanceOriginal = markAttendance;
const markAttendanceWithAudit = async (req, res) => {
  await markAttendanceOriginal(req, res);
  if (res.statusCode < 400) {
    const { logAudit } = require('../lib/auditLog');
    const records = req.body.attendance_records || req.body.attendance || [];
    for (const record of records) {
      await logAudit({
        actorId: req.user.id,
        actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
        teacherId: req.user.teacherId || req.user.id,
        action: 'attendance_marked',
        entityType: 'attendance',
        metadata: { student_id: record.student_id, status: record.status, group_id: record.group_id },
        ipAddress: req.ip
      });
    }
  }
};

const updateAttendanceOriginal = updateAttendance;
const updateAttendanceWithAudit = async (req, res) => {
  await updateAttendanceOriginal(req, res);
  if (res.statusCode < 400) {
    const { logAudit } = require('../lib/auditLog');
    await logAudit({
      actorId: req.user.id,
      actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
      teacherId: req.user.teacherId || req.user.id,
      action: 'attendance_edited',
      entityType: 'attendance',
      entityId: req.params.id,
      metadata: { status: req.body.status },
      ipAddress: req.ip
    });
  }
};

/**
 * @openapi
 * /api/attendance:
 *   get:
 *     tags: [Attendance]
 *     summary: Get attendance records
 *     description: Returns attendance records for a date range, filtered by teacher ownership. Supports student and group filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (defaults to today)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (defaults to today)
 *       - in: query
 *         name: student_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student UUID
 *       - in: query
 *         name: group_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by group UUID
 *     responses:
 *       200:
 *         description: List of attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AttendanceRecord'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
// Route definitions
router.get('/', authenticateToken, getAttendance);

/**
 * @openapi
 * /api/attendance:
 *   post:
 *     tags: [Attendance]
 *     summary: Mark attendance for students
 *     description: Upserts attendance records for one or more students. Resolves enrollments automatically and validates teacher ownership.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Default date applied to all records (overridden per-record if provided)
 *               attendance_records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [student_id, group_id, status]
 *                   properties:
 *                     student_id:
 *                       type: string
 *                       format: uuid
 *                     group_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [present, absent, late, excused]
 *                     notes:
 *                       type: string
 *                     date:
 *                       type: string
 *                       format: date
 *                 description: Array of attendance records to upsert
 *     responses:
 *       201:
 *         description: Attendance marked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AttendanceRecord'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or no valid enrollments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/', authenticateToken, requirePermission('manage_attendance'), validate(markAttendanceSchema), markAttendanceWithAudit);

/**
 * @openapi
 * /api/attendance/summary:
 *   get:
 *     tags: [Attendance]
 *     summary: Get attendance summary
 *     description: Returns aggregated attendance statistics (present, absent, late, excused counts and attendance rate) for the teacher's classes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (defaults to 30 days ago)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (defaults to today)
 *     responses:
 *       200:
 *         description: Attendance summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_sessions:
 *                       type: integer
 *                     present_count:
 *                       type: integer
 *                     absent_count:
 *                       type: integer
 *                     late_count:
 *                       type: integer
 *                     excused_count:
 *                       type: integer
 *                     attendance_rate:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/summary', authenticateToken, getAttendanceSummary);

/**
 * @openapi
 * /api/attendance/{id}:
 *   patch:
 *     tags: [Attendance]
 *     summary: Update an attendance record
 *     description: Updates the status or notes of a single attendance record. Validates teacher ownership via the enrollment chain.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attendance record UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [present, absent, late, excused]
 *                 description: Updated attendance status
 *               notes:
 *                 type: string
 *                 description: Optional notes (set to empty string to clear)
 *     responses:
 *       200:
 *         description: Attendance record updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AttendanceRecord'
 *       400:
 *         description: Validation error or no fields to update
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Attendance record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.patch('/:id', authenticateToken, requirePermission('manage_attendance'), validate(updateAttendanceSchema), updateAttendanceWithAudit);

module.exports = router;
