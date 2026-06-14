const express = require('express');
const supabase = require('../config/database').supabaseAdmin;
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate, createGradeSchema, bulkGradeSchema, updateGradeSchema } = require('../middleware/validate');
const logger = require('../lib/logger');

const router = express.Router();

// @desc    Get grades for students
// @route   GET /api/grades
// @access  Private
// Helper to resolve enrollment and offering from legacy inputs
const resolveEnrollmentAndOffering = async (student_id, subject_name, teacher_id) => {
  // Find enrollment for student in a group belonging to teacher for specific subject
  // We check against name_en, name_ar, or code
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select(`
          id, 
          group:groups!inner(
              id,
              offering:offerings!inner(
                  id, 
                  teacher_id, 
                  subject:subjects!inner(id, name_en, name_ar, code)
              )
          )
      `)
    .eq('student_id', student_id)
    .eq('groups.offerings.teacher_id', teacher_id)
    .or(`name_en.ilike.${subject_name},name_ar.ilike.${subject_name},code.ilike.${subject_name}`, { foreignTable: 'groups.offerings.subjects' })
    .limit(1);

  if (error || !enrollments || enrollments.length === 0) return null;

  return {
    enrollment_id: enrollments[0].id,
    offering_id: enrollments[0].group.offering.id
  };
};

const getGrades = async (req, res) => {
  try {
    const {
      student_id,
      subject,
      assessment_type,
      start_date,
      end_date
    } = req.query;

    // Base query: Grades -> Assessments -> Offerings -> Teacher
    let query = supabase
      .from('grades')
      .select(`
        id,
        score,
        notes,
        assessment:assessments!inner (
            id,
            name,
            max_score,
            date,
            offering:offerings!inner (
                teacher_id,
                subject:subjects (name_en, name_ar, code)
            )
        ),
        enrollment:enrollments!inner (
            student:students (
                id,
                name,
                student_code
            )
        )
      `)
      .eq('assessments.offerings.teacher_id', req.user.id)
      .order('date', { foreignTable: 'assessments', ascending: false });

    if (student_id) {
      query = query.eq('enrollments.student_id', student_id);
    }

    if (subject) {
      // Filter logic
    }

    // Apply date filters to assessment DATE
    if (start_date) {
      query = query.gte('assessments.date', start_date);
    }
    if (end_date) {
      query = query.lte('assessments.date', end_date);
    }

    const { data: gradesData, error } = await query;

    if (error) throw error;

    // Map to legacy format for frontend compatibility
    let grades = gradesData.map(g => ({
      id: g.id,
      student_id: g.enrollment.student.id,
      student_code: g.enrollment.student.student_code,
      student_name: g.enrollment.student.name,
      subject: g.assessment.offering.subject.name_en,
      subject_code: g.assessment.offering.subject.code,
      assessment_type: g.assessment.name,
      assessment_name: g.assessment.name,
      score: g.score,
      max_score: g.assessment.max_score,
      date: g.assessment.date,
      percentage: (g.score / g.assessment.max_score) * 100,
      notes: g.notes
    }));

    // Manual filter for subject if provided (due to deep join limitation)
    if (subject) {
      const lowerSub = subject.toLowerCase();
      grades = grades.filter(g =>
        g.subject?.toLowerCase().includes(lowerSub) ||
        g.subject_code?.toLowerCase().includes(lowerSub)
      );
    }

    res.status(200).json({
      success: true,
      data: grades
    });
  } catch (error) {
    logger.error('Get grades error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching grades'
    });
  }
};

// @desc    Create new grade
// @route   POST /api/grades
// @access  Private
const createGrade = async (req, res) => {
  try {
    const {
      student_id,
      subject,
      assessment_type, // "Quiz", "Exam" etc. (We might append to title or ignore)
      assessment_name,
      score,
      max_score,
      date,
      notes,
      is_published = false
    } = req.body;

    if (!student_id || !subject || !assessment_name || score === undefined || !max_score) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // 1. Resolve Enrollment & Offering
    const resolved = await resolveEnrollmentAndOffering(student_id, subject, req.user.id);
    if (!resolved) {
      return res.status(404).json({ success: false, message: 'Student enrollment not found for this subject' });
    }
    const { enrollment_id, offering_id } = resolved;

    // 2. Find or Create Assessment
    // Check if assessment exists for this offering with same title/date
    const assessmentDate = date || new Date().toISOString().split('T')[0];

    let { data: assessment } = await supabase
      .from('assessments')
      .select('id')
      .eq('offering_id', offering_id)
      .eq('name', assessment_name)
      .eq('date', assessmentDate)
      .single();

    if (!assessment) {
      // Create new assessment
      const { data: newAssessment, error: assessError } = await supabase
        .from('assessments')
        .insert([{
          offering_id,
          name: assessment_name,
          max_score: max_score,
          date: assessmentDate
        }])
        .select()
        .single();

      if (assessError) throw assessError;
      assessment = newAssessment;
    }

    // 3. Insert Grade
    const { data: grade, error } = await supabase
      .from('grades')
      .upsert([{
        enrollment_id,
        assessment_id: assessment.id,
        score: parseFloat(score),
        notes
      }], { onConflict: 'enrollment_id, assessment_id' })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: grade
    });
  } catch (error) {
    logger.error('Create grade error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error creating grade'
    });
  }
};

// @desc    Bulk create grades
// @route   POST /api/grades/bulk
// @access  Private
const createBulkGrades = async (req, res) => {
  try {
    const { grades } = req.body;

    if (!grades || !Array.isArray(grades)) {
      return res.status(400).json({
        success: false,
        message: 'Grades array is required'
      });
    }

    const results = [];
    const errors = [];
    const teacherId = req.user.id;
    const defaultDate = new Date().toISOString().split('T')[0];

    // --- Step 1: Batch resolve enrollments ---
    // Collect unique (student_id, subject) pairs
    const uniquePairs = [...new Map(
      grades.map(g => [`${g.student_id}|${g.subject}`, { student_id: g.student_id, subject: g.subject }])
    ).values()];

    // Fetch all enrollments for these students under this teacher in one query
    const studentIds = [...new Set(uniquePairs.map(p => p.student_id))];
    const { data: allEnrollments } = await supabase
      .from('enrollments')
      .select(`
        id,
        student_id,
        group:groups!inner(
          offering:offerings!inner(
            id,
            teacher_id,
            subject:subjects!inner(id, name_en, name_ar, code)
          )
        )
      `)
      .in('student_id', studentIds)
      .eq('groups.offerings.teacher_id', teacherId);

    // Build lookup map: "student_id|subject_name_lower" -> { enrollment_id, offering_id }
    const enrollmentLookup = {};
    allEnrollments?.forEach(e => {
      const subj = e.group.offering.subject;
      const subjects = [subj.name_en, subj.name_ar, subj.code].filter(Boolean);
      subjects.forEach(name => {
        const key = `${e.student_id}|${name.toLowerCase()}`;
        if (!enrollmentLookup[key]) {
          enrollmentLookup[key] = {
            enrollment_id: e.id,
            offering_id: e.group.offering.id
          };
        }
      });
    });

    // Resolve each grade's enrollment
    const resolvedGrades = [];
    for (const gradeData of grades) {
      const { student_id, subject, assessment_name, score, max_score, date, notes } = gradeData;
      const subjectLower = subject.toLowerCase();
      const resolved = enrollmentLookup[`${student_id}|${subjectLower}`];

      if (!resolved) {
        errors.push({ student_id, message: 'Enrollment not found for this subject' });
        continue;
      }

      const assessmentDate = date || defaultDate;
      resolvedGrades.push({
        ...gradeData,
        enrollment_id: resolved.enrollment_id,
        offering_id: resolved.offering_id,
        assessmentDate,
        score: parseFloat(score),
        max_score: parseFloat(max_score)
      });
    }

    if (resolvedGrades.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        errors,
        message: 'No grades could be resolved'
      });
    }

    // --- Step 2: Batch find-or-create assessments ---
    // Collect unique (offering_id, name, date) combos
    const assessmentKeys = [...new Map(
      resolvedGrades.map(g => [`${g.offering_id}|${g.assessment_name}|${g.assessmentDate}`, {
        offering_id: g.offering_id,
        name: g.assessment_name,
        date: g.assessmentDate,
        max_score: g.max_score
      }])
    ).values()];

    // Fetch existing assessments matching these combos
    const offeringIds = [...new Set(assessmentKeys.map(k => k.offering_id))];
    const { data: existingAssessments } = await supabase
      .from('assessments')
      .select('id, offering_id, name, date')
      .in('offering_id', offeringIds);

    // Build lookup: "offering_id|name|date" -> assessment_id
    const assessmentLookup = {};
    existingAssessments?.forEach(a => {
      assessmentLookup[`${a.offering_id}|${a.name}|${a.date}`] = a.id;
    });

    // Find which assessments need to be created
    const toCreate = assessmentKeys.filter(k => !assessmentLookup[`${k.offering_id}|${k.name}|${k.date}`]);

    // Bulk insert missing assessments
    if (toCreate.length > 0) {
      const { data: created, error: createError } = await supabase
        .from('assessments')
        .insert(toCreate.map(a => ({
          offering_id: a.offering_id,
          name: a.name,
          max_score: a.max_score,
          date: a.date
        })))
        .select('id, offering_id, name, date');

      if (createError) throw createError;
      created?.forEach(a => {
        assessmentLookup[`${a.offering_id}|${a.name}|${a.date}`] = a.id;
      });
    }

    // --- Step 3: Bulk upsert all grades ---
    const gradeRows = resolvedGrades.map(g => ({
      enrollment_id: g.enrollment_id,
      assessment_id: assessmentLookup[`${g.offering_id}|${g.assessment_name}|${g.assessmentDate}`],
      score: g.score,
      notes: g.notes
    })).filter(g => g.assessment_id);

    const { data: upserted, error: upsertError } = await supabase
      .from('grades')
      .upsert(gradeRows, { onConflict: 'enrollment_id,assessment_id' })
      .select(`
        id, score, notes,
        enrollment:enrollments(
          student:students(name, student_id)
        )
      `);

    if (upsertError) throw upsertError;

    upserted?.forEach(g => {
      results.push({
        id: g.id,
        score: g.score,
        notes: g.notes,
        student_name: g.enrollment?.student?.name,
        student_id: g.enrollment?.student?.student_id
      });
    });

    res.status(201).json({
      success: true,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      message: `${results.length} grades created successfully`
    });
  } catch (error) {
    logger.error('Bulk create grades error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error creating bulk grades'
    });
  }
};

// @desc    Update grade
// @route   PUT /api/grades/:id
// @access  Private
const updateGrade = async (req, res) => {
  try {
    const allowedFields = [
      'subject', 'assessment_type', 'assessment_name',
      'score', 'max_score', 'date', 'notes', 'is_published'
    ];

    // Separate updates for 'grades' table and 'assessments' table
    const gradeUpdates = {};
    const assessmentUpdates = {};
    let hasAssessmentUpdates = false;

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'score') gradeUpdates.score = parseFloat(req.body.score);
        if (key === 'notes') gradeUpdates.notes = req.body.notes;

        // Assessment fields
        if (key === 'assessment_name') {
          assessmentUpdates.name = req.body.assessment_name;
          hasAssessmentUpdates = true;
        }
        if (key === 'max_score') {
          assessmentUpdates.max_score = parseFloat(req.body.max_score);
          hasAssessmentUpdates = true;
        }
        if (key === 'date') {
          assessmentUpdates.date = req.body.date;
          hasAssessmentUpdates = true;
        }
      }
    });

    // 1. Fetch current grade to get assessment_id
    // Verify ownership via deep join to offerings -> teacher
    const { data: currentGrade, error: fetchError } = await supabase
      .from('grades')
      .select('id, assessment_id, assessment:assessments!inner(offering:offerings!inner(teacher_id))')
      .eq('id', req.params.id)
      .eq('assessments.offerings.teacher_id', req.user.id)
      .single();

    if (fetchError || !currentGrade) {
      return res.status(404).json({ success: false, message: 'Grade not found or unauthorized' });
    }

    // 2. Update Assessment (if needed) - Affects all students!
    if (hasAssessmentUpdates) {
      const { error: assessUpdateError } = await supabase
        .from('assessments')
        .update(assessmentUpdates)
        .eq('id', currentGrade.assessment_id);

      if (assessUpdateError) throw assessUpdateError;
    }

    // 3. Update Grade
    if (Object.keys(gradeUpdates).length > 0) {
      const { error: gradeUpdateError } = await supabase
        .from('grades')
        .update(gradeUpdates)
        .eq('id', req.params.id);

      if (gradeUpdateError) throw gradeUpdateError;
    }

    // 4. Return updated data (mimic legacy format)
    const { data: updatedGrade } = await supabase
      .from('grades')
      .select(`
            id, score, notes,
            assessment:assessments (
                name, max_score, date,
                offering:offerings(subject:subjects(name_en))
            ),
            enrollment:enrollments(
                student:students(id, name, student_id)
            )
        `)
      .eq('id', req.params.id)
      .single();

    const responseData = {
      id: updatedGrade.id,
      score: updatedGrade.score,
      notes: updatedGrade.notes,
      max_score: updatedGrade.assessment.max_score,
      assessment_name: updatedGrade.assessment.name,
      date: updatedGrade.assessment.date,
      subject: updatedGrade.assessment.offering.subject.name_en,
      student_id: updatedGrade.enrollment.student.id,
      student_name: updatedGrade.enrollment.student.name
    };

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    logger.error('Update grade error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error updating grade'
    });
  }
};

// @desc    Delete grade
// @route   DELETE /api/grades/:id
// @access  Private
const deleteGrade = async (req, res) => {
  try {
    // Check ownership via Join
    const { data: grade } = await supabase
      .from('grades')
      .select('id, assessment:assessments!inner(offering:offerings!inner(teacher_id))')
      .eq('id', req.params.id)
      .eq('assessments.offerings.teacher_id', req.user.id)
      .single();

    if (!grade) {
      return res.status(404).json({ success: false, message: 'Grade not found or unauthorized' });
    }

    const { error } = await supabase
      .from('grades')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Grade deleted successfully'
    });
  } catch (error) {
    logger.error('Delete grade error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error deleting grade'
    });
  }
};

// @desc    Get grade statistics
// @route   GET /api/grades/stats
// @access  Private
const getGradeStats = async (req, res) => {
  try {
    const { subject, student_id } = req.query;

    let query = supabase
      .from('grades')
      .select(`
        score,
        assessment:assessments!inner (
           name,
           max_score,
           offering:offerings!inner(
               teacher_id,
               subject:subjects(name_en, code)
           )
        ),
        enrollment:enrollments!inner(
            student_id
        )
      `)
      .eq('assessments.offerings.teacher_id', req.user.id);

    if (student_id) {
      query = query.eq('enrollments.student_id', student_id);
    }

    // Manual filtering for subject as postgrest deep filter is complex
    const { data: rawData, error } = await query;

    if (error) {
      logger.error('Grade stats query error', { error: error.message });
      throw error;
    }

    // Filter by subject
    let grades = rawData;
    if (subject) {
      const lowerSub = subject.toLowerCase();
      grades = grades.filter(g =>
        g.assessment.offering.subject.name_en.toLowerCase().includes(lowerSub) ||
        g.assessment.offering.subject.code.toLowerCase().includes(lowerSub)
      );
    }

    // Process stats
    const stats = {
      total_assessments: grades.length,
      average_score: 0,
      by_subject: {},
      by_assessment_type: {} // Using title as type for now or generic 'Assessment'
    };

    let totalPercentage = 0;

    grades.forEach(g => {
      const percentage = (g.score / g.assessment.max_score) * 100;
      totalPercentage += percentage;

      const subjName = g.assessment.offering.subject.name_en;
      if (!stats.by_subject[subjName]) stats.by_subject[subjName] = [];
      stats.by_subject[subjName].push(percentage);

      const type = "Assessment"; // Schema doesn't have type anymore, use generic
      if (!stats.by_assessment_type[type]) stats.by_assessment_type[type] = [];
      stats.by_assessment_type[type].push(percentage);
    });

    if (grades.length > 0) {
      stats.average_score = Math.round((totalPercentage / grades.length) * 100) / 100;
    }

    // Averages for groups
    Object.keys(stats.by_subject).forEach(subj => {
      const scores = stats.by_subject[subj];
      stats.by_subject[subj] = {
        count: scores.length,
        average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      };
    });

    Object.keys(stats.by_assessment_type).forEach(type => {
      const scores = stats.by_assessment_type[type];
      stats.by_assessment_type[type] = {
        count: scores.length,
        average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      };
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get grade stats error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching grade statistics'
    });
  }
};

// ============================================================
// Audit logging for grade actions
// ============================================================

const createGradeOriginal = createGrade;
const createGradeWithAudit = async (req, res) => {
  await createGradeOriginal(req, res);
  if (res.statusCode < 400) {
    const { logAudit } = require('../lib/auditLog');
    await logAudit({
      actorId: req.user.id,
      actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
      teacherId: req.user.teacherId || req.user.id,
      action: 'grade_entered',
      entityType: 'grade',
      entityId: res.locals?.data?.id,
      metadata: { student_id: req.body.student_id, subject: req.body.subject, score: req.body.score },
      ipAddress: req.ip
    });
  }
};

const createBulkGradesOriginal = createBulkGrades;
const createBulkGradesWithAudit = async (req, res) => {
  await createBulkGradesOriginal(req, res);
  if (res.statusCode < 400) {
    const { logAudit } = require('../lib/auditLog');
    await logAudit({
      actorId: req.user.id,
      actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
      teacherId: req.user.teacherId || req.user.id,
      action: 'grade_bulk_import',
      entityType: 'grade',
      metadata: { count: req.body.grades?.length },
      ipAddress: req.ip
    });
  }
};

const updateGradeOriginal = updateGrade;
const updateGradeWithAudit = async (req, res) => {
  await updateGradeOriginal(req, res);
  if (res.statusCode < 400) {
    const { logAudit } = require('../lib/auditLog');
    await logAudit({
      actorId: req.user.id,
      actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
      teacherId: req.user.teacherId || req.user.id,
      action: 'grade_edited',
      entityType: 'grade',
      entityId: req.params.id,
      metadata: { score: req.body.score },
      ipAddress: req.ip
    });
  }
};

const deleteGradeOriginal = deleteGrade;
const deleteGradeWithAudit = async (req, res) => {
  await deleteGradeOriginal(req, res);
  if (res.statusCode < 400) {
    const { logAudit } = require('../lib/auditLog');
    await logAudit({
      actorId: req.user.id,
      actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
      teacherId: req.user.teacherId || req.user.id,
      action: 'grade_deleted',
      entityType: 'grade',
      entityId: req.params.id,
      ipAddress: req.ip
    });
  }
};

/**
 * @openapi
 * /api/grades:
 *   get:
 *     tags: [Grades]
 *     summary: Get grades for students
 *     description: Returns grades for the authenticated teacher's offerings, with optional filtering by student, subject, and date range.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: student_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student UUID
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Filter by subject name (case-insensitive partial match)
 *       - in: query
 *         name: assessment_type
 *         schema:
 *           type: string
 *         description: Filter by assessment type
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter grades from this date (assessment date)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter grades up to this date (assessment date)
 *     responses:
 *       200:
 *         description: List of grades
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
 *                     $ref: '#/components/schemas/Grade'
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
router.get('/', authenticateToken, getGrades);

/**
 * @openapi
 * /api/grades:
 *   post:
 *     tags: [Grades]
 *     summary: Create a grade
 *     description: Creates or updates (upserts) a grade for a student in a subject. Automatically finds or creates the assessment record.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student_id, subject, assessment_name, score, max_score]
 *             properties:
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 description: Student UUID
 *               subject:
 *                 type: string
 *                 description: Subject name (matched against name_en, name_ar, or code)
 *               assessment_name:
 *                 type: string
 *                 description: Assessment title (e.g. "Midterm", "Quiz 1")
 *               score:
 *                 type: number
 *                 description: Student's score
 *               max_score:
 *                 type: number
 *                 description: Maximum possible score
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Assessment date (defaults to today)
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *               is_published:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the grade is published to parents
 *     responses:
 *       201:
 *         description: Grade created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Grade'
 *       400:
 *         description: Validation error or missing required fields
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
 *         description: Student enrollment not found for this subject
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
router.post('/', authenticateToken, requirePermission('manage_grades'), validate(createGradeSchema), createGradeWithAudit);

/**
 * @openapi
 * /api/grades/bulk:
 *   post:
 *     tags: [Grades]
 *     summary: Bulk create grades
 *     description: Creates or updates multiple grades in a single request. Resolves enrollments and assessments in batch for efficiency.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [grades]
 *             properties:
 *               grades:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [student_id, subject, assessment_name, score, max_score]
 *                   properties:
 *                     student_id:
 *                       type: string
 *                       format: uuid
 *                     subject:
 *                       type: string
 *                     assessment_name:
 *                       type: string
 *                     score:
 *                       type: number
 *                     max_score:
 *                       type: number
 *                     date:
 *                       type: string
 *                       format: date
 *                     notes:
 *                       type: string
 *                 description: Array of grade records to create/upsert
 *     responses:
 *       201:
 *         description: Grades created successfully
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       score:
 *                         type: number
 *                       notes:
 *                         type: string
 *                       student_name:
 *                         type: string
 *                       student_id:
 *                         type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       student_id:
 *                         type: string
 *                       message:
 *                         type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or grades array required
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
router.post('/bulk', authenticateToken, requirePermission('manage_grades'), validate(bulkGradeSchema), createBulkGradesWithAudit);

/**
 * @openapi
 * /api/grades/{id}:
 *   put:
 *     tags: [Grades]
 *     summary: Update a grade
 *     description: Updates a grade and optionally its associated assessment. Updating assessment fields affects all students with that assessment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Grade UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score:
 *                 type: number
 *                 description: Updated score
 *               notes:
 *                 type: string
 *                 description: Updated notes
 *               assessment_name:
 *                 type: string
 *                 description: Updated assessment name (affects all students)
 *               max_score:
 *                 type: number
 *                 description: Updated max score (affects all students)
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Updated assessment date (affects all students)
 *     responses:
 *       200:
 *         description: Grade updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Grade'
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
 *       404:
 *         description: Grade not found or unauthorized
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
router.put('/:id', authenticateToken, requirePermission('manage_grades'), validate(updateGradeSchema), updateGradeWithAudit);

/**
 * @openapi
 * /api/grades/{id}:
 *   delete:
 *     tags: [Grades]
 *     summary: Delete a grade
 *     description: Deletes a grade record. Validates teacher ownership via the assessment-offering chain.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Grade UUID
 *     responses:
 *       200:
 *         description: Grade deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Grade not found or unauthorized
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
router.delete('/:id', authenticateToken, requirePermission('manage_grades'), deleteGradeWithAudit);

/**
 * @openapi
 * /api/grades/stats:
 *   get:
 *     tags: [Grades]
 *     summary: Get grade statistics
 *     description: Returns aggregated grade statistics including average scores and breakdowns by subject and assessment type.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Filter stats by subject name (case-insensitive partial match)
 *       - in: query
 *         name: student_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter stats by student UUID
 *     responses:
 *       200:
 *         description: Grade statistics
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
 *                     total_assessments:
 *                       type: integer
 *                     average_score:
 *                       type: number
 *                     by_subject:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: integer
 *                           average:
 *                             type: number
 *                     by_assessment_type:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: integer
 *                           average:
 *                             type: number
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
router.get('/stats', authenticateToken, getGradeStats);

module.exports = router;
