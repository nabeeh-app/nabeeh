const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params
  });

  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Validation error';
    return res.status(400).json({
      success: false,
      message,
      code: 'VALIDATION_ERROR'
    });
  }

  req.validated = result.data;
  next();
};

// ==================== AUTH SCHEMAS ====================

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable(),
    business_name: z.string().max(255).optional().nullable(),
    subjects: z.array(z.string()).optional().nullable(),
    whatsapp_number: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable(),
    preferred_language: z.enum(['ar', 'en']).default('ar')
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
});

const requestResetSchema = z.object({
  body: z.object({
    email: z.string().email()
  })
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8).max(128)
  })
});

// ==================== STUDENT SCHEMAS ====================

const createStudentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    student_id: z.string().min(1).max(50).optional(),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable(),
    group_id: z.string().uuid(),
    parents: z.array(z.object({
      name: z.string().min(1).max(255),
      phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
      email: z.string().email().optional().nullable(),
      relationship: z.enum(['father', 'mother', 'guardian', 'grandmother', 'grandfather', 'uncle', 'aunt', 'other']),
      is_primary: z.boolean().optional(),
      preferred_language: z.enum(['ar', 'en']).optional()
    })).optional()
  })
});

const updateStudentSchema = z.object({
  body: z.object({
    student_code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(255).optional(),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
  params: z.object({ id: z.string().uuid() })
});

// ==================== GRADE SCHEMAS ====================

const createGradeSchema = z.object({
  body: z.object({
    student_id: z.string().uuid(),
    subject: z.string().min(1),
    assessment_name: z.string().min(1).max(255),
    score: z.number().min(0),
    max_score: z.number().positive(),
    date: z.string().optional(),
    notes: z.string().optional().nullable()
  })
});

const bulkGradeSchema = z.object({
  body: z.object({
    grades: z.array(z.object({
      student_id: z.string().uuid(),
      subject: z.string().min(1),
      assessment_name: z.string().min(1).max(255),
      score: z.number().min(0),
      max_score: z.number().positive(),
      date: z.string().optional(),
      notes: z.string().optional().nullable()
    })).min(1)
  })
});

// ==================== ATTENDANCE SCHEMAS ====================

const markAttendanceSchema = z.object({
  body: z.object({
    date: z.string().optional(),
    attendance_records: z.array(z.object({
      student_id: z.string().uuid(),
      group_id: z.string().uuid(),
      status: z.enum(['present', 'absent', 'late', 'excused']),
      notes: z.string().optional().nullable(),
      date: z.string().optional()
    })).min(1),
    attendance: z.array(z.object({
      student_id: z.string().uuid(),
      group_id: z.string().uuid(),
      status: z.enum(['present', 'absent', 'late', 'excused']),
      notes: z.string().optional().nullable(),
      date: z.string().optional()
    })).min(1).optional()
  }).refine(data => data.attendance_records || data.attendance, {
    message: 'attendance_records or attendance array is required'
  })
});

// ==================== OFFERING SCHEMAS ====================

const createOfferingSchema = z.object({
  body: z.object({
    subject_id: z.string().uuid(),
    grade_level_id: z.string().uuid(),
    academic_year: z.string().min(1).max(50)
  })
});

const updateGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    max_capacity: z.number().int().positive().optional(),
    schedule_description: z.string().optional().nullable(),
    is_active: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
  params: z.object({ offeringId: z.string().uuid(), groupId: z.string().uuid() })
});

const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    max_capacity: z.number().int().positive().optional(),
    schedule_description: z.string().optional().nullable()
  }),
  params: z.object({ offeringId: z.string().uuid() })
});

// ==================== PARENT SCHEMAS ====================

const createParentSchema = z.object({
  body: z.object({
    student_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
    email: z.string().email().optional().nullable(),
    relationship: z.enum(['father', 'mother', 'guardian', 'grandmother', 'grandfather', 'uncle', 'aunt', 'other']),
    preferred_language: z.enum(['ar', 'en']).optional(),
    is_primary: z.boolean().optional()
  })
});

const updateParentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional(),
    email: z.string().email().optional().nullable(),
    relationship: z.enum(['father', 'mother', 'guardian', 'grandmother', 'grandfather', 'uncle', 'aunt', 'other']).optional(),
    preferred_language: z.enum(['ar', 'en']).optional(),
    is_primary: z.boolean().optional(),
    telegram_username: z.string().max(100).optional().nullable(),
    communication_preferences: z.record(z.string()).optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
  params: z.object({ id: z.string().uuid() })
});

// ==================== GRADE UPDATE SCHEMA ====================

const updateGradeSchema = z.object({
  body: z.object({
    score: z.number().min(0).optional(),
    notes: z.string().optional().nullable(),
    assessment_name: z.string().min(1).max(255).optional(),
    max_score: z.number().positive().optional(),
    date: z.string().optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
  params: z.object({ id: z.string().uuid() })
});

// ==================== ADMIN SCHEMAS ====================

const createTeacherSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable(),
    business_name: z.string().max(255).optional().nullable(),
    role: z.enum(['teacher', 'admin']).optional()
  })
});

// ==================== ATTENDANCE UPDATE SCHEMA ====================

const updateAttendanceSchema = z.object({
  body: z.object({
    status: z.enum(['present', 'absent', 'late', 'excused']).optional(),
    notes: z.string().optional().nullable()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
  params: z.object({ id: z.string().uuid() })
});

// ==================== TEACHER SCHEMAS ====================

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable(),
    business_name: z.string().max(255).optional().nullable(),
    bio: z.string().max(1000).optional().nullable(),
    subjects: z.array(z.string()).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    timezone: z.string().max(50).optional().nullable(),
    whatsapp_number: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional().nullable(),
    telegram_username: z.string().max(100).optional().nullable()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })
});

const updateSettingsSchema = z.object({
  body: z.object({
    notifications: z.object({
      attendance: z.boolean().optional(),
      grades: z.boolean().optional(),
      messages: z.boolean().optional()
    }).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.enum(['ar', 'en']).optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one setting must be provided' })
});

// ==================== MESSAGE SCHEMAS ====================

const getMessagesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional()
  })
});

// ==================== ASSISTANT SCHEMAS ====================

const inviteAssistantSchema = z.object({
  body: z.object({
    email: z.string().email(),
    permissions: z.record(z.boolean()).optional()
  })
});

const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(1)
  })
});

const updateAssistantPermissionsSchema = z.object({
  body: z.object({
    permissions: z.record(z.boolean())
  }),
  params: z.object({ id: z.string().uuid() })
});

const updateAssistantStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'inactive'])
  }),
  params: z.object({ id: z.string().uuid() })
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
  createStudentSchema,
  updateStudentSchema,
  createGradeSchema,
  updateGradeSchema,
  bulkGradeSchema,
  markAttendanceSchema,
  updateAttendanceSchema,
  createOfferingSchema,
  createGroupSchema,
  updateGroupSchema,
  createParentSchema,
  updateParentSchema,
  createTeacherSchema,
  updateProfileSchema,
  updateSettingsSchema,
  getMessagesSchema,
  inviteAssistantSchema,
  acceptInviteSchema,
  updateAssistantPermissionsSchema,
  updateAssistantStatusSchema
};
