const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
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

    // Process sequentially (could be parallelized with Promise.all but robust with loop)
    for (const gradeData of grades) {
      const {
        student_id,
        subject,
        assessment_name,
        score,
        max_score,
        date,
        notes,
        is_published = false
      } = gradeData;

      try {
        // 1. Resolve
        const resolved = await resolveEnrollmentAndOffering(student_id, subject, req.user.id);
        if (!resolved) {
          errors.push({ student_id, message: 'Enrollment not found' });
          continue;
        }
        const { enrollment_id, offering_id } = resolved;

        // 2. Find/Create Assessment
        const assessmentDate = date || new Date().toISOString().split('T')[0];
        let { data: assessment } = await supabase
          .from('assessments')
          .select('id')
          .eq('offering_id', offering_id)
          .eq('name', assessment_name)
          .eq('date', assessmentDate)
          .single();

        if (!assessment) {
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
          .select(`
                *,
                enrollment:enrollments(
                    student:students(name, student_id)
                )
              `)
          .single();

        if (error) throw error;

        // Map back to legacy structure for response
        results.push({
          ...grade,
          student_name: grade.enrollment.student.name,
          student_id: grade.enrollment.student.student_id
        });

      } catch (err) {
        logger.error('Error processing student', { student_id: gradeData.student_id, error: err.message });
        errors.push({ student_id: gradeData.student_id, message: err.message });
      }
    }

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

// Route definitions
router.get('/', authenticateToken, getGrades);
router.post('/', authenticateToken, validate(createGradeSchema), createGrade);
router.post('/bulk', authenticateToken, validate(bulkGradeSchema), createBulkGrades);
router.put('/:id', authenticateToken, validate(updateGradeSchema), updateGrade);
router.delete('/:id', authenticateToken, deleteGrade);
router.get('/stats', authenticateToken, getGradeStats);

module.exports = router;
