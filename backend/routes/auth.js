const express = require('express');
const { supabase, supabaseAdmin } = require('../config/database');
const { TokenService, AuthService } = require('../lib/auth');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate, registerSchema, loginSchema, requestResetSchema, resetPasswordSchema, updateProfileSchema, createTeacherSchema } = require('../middleware/validate');
const rateLimit = require('express-rate-limit');
const logger = require('../lib/logger');

const router = express.Router();

// Auth routes initialized

// Use anon client for reads, admin for auth operations
let supabaseClient = supabase;
try {
    logger.info('Supabase client initialized successfully');
} catch (error) {
    logger.error('Failed to initialize Supabase client', { error: error.message });
}

// Initialize auth service
const authService = new AuthService();
const teacherSelectFields = `
    id,
    email,
    name,
    phone,
    business_name,
    bio,
    subjects,
    address,
    city,
    country,
    timezone,
    whatsapp_number,
    telegram_username,
    created_at,
    updated_at
`;

// Standardize teacher shape returned to the frontend
const formatTeacherResponse = (teacher) => {
    if (!teacher) return null;

    return {
        id: teacher.id,
        email: teacher.email,
        phone: teacher.phone || '',
        name: teacher.name,
        role: 'teacher',
        business_name: teacher.business_name || null,
        bio: teacher.bio || null,
        subjects: teacher.subjects || [],
        address: teacher.address || null,
        city: teacher.city || null,
        country: teacher.country || null,
        timezone: teacher.timezone || 'Africa/Cairo',
        whatsapp_number: teacher.whatsapp_number || null,
        telegram_username: teacher.telegram_username || null,
        created_at: teacher.created_at,
        updated_at: teacher.updated_at
    };
};

// Rate limiting for authentication endpoints
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 attempts per window per IP
    message: {
        success: false,
        message: 'Too many login attempts, please try again later',
        messageAr: 'محاولات دخول كثيرة، يرجى المحاولة لاحقاً'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 reset requests per hour per IP
    message: {
        success: false,
        message: 'Too many password reset requests, please try again later',
        messageAr: 'طلبات إعادة تعيين كلمة المرور كثيرة، يرجى المحاولة لاحقاً'
    }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
        success: false,
        message: 'Too many registrations from this IP, please try again later',
        messageAr: 'طلبات تسجيل كثيرة من هذا العنوان، يرجى المحاولة لاحقاً'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Helper function to get user by email
 */
async function getUserByEmail(email) {
    const { data, error } = await supabaseClient
        .from('teachers')
        .select(teacherSelectFields)
        .eq('email', email)
        .single();

    if (error) {
        logger.error('Database error', { error });
        return null;
    }

    return data;
}

/**
 * Helper function to update user last login
 */
async function updateLastLogin(userId) {
    const { error } = await supabaseClient
        .from('teachers')
        .update({
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (error) {
        logger.error('Error updating last login', { error: error.message });
    }
}

/**
 * Helper function to log authentication events
 */
async function logAuthEvent(userId, action, success, ipAddress, userAgent, details = {}) {
    const { error } = await supabaseAdmin
        .from('auth_audit_log')
        .insert({
            teacher_id: userId,
            event_type: action,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: { success, ...details }
        });

    if (error) {
        logger.error('Error logging auth event', { error: error.message });
    }
}

async function provisionTeacherAccount(payload) {
    const {
        name,
        email,
        password,
        phone = null,
        business_name = null,
        subjects = null,
        whatsapp_number = null
    } = payload;

    if (!name || !email || !password) {
        const error = new Error('Name, email, and password are required');
        error.status = 400;
        throw error;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingTeacher = await getUserByEmail(normalizedEmail);
    if (existingTeacher) {
        const conflict = new Error('Email is already registered');
        conflict.status = 409;
        throw conflict;
    }

    // Supabase Auth handles password hashing and strength validation
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
            name,
            role: 'teacher'
        }
    });

    if (authError) {
        if (authError.message?.includes('already registered')) {
            const conflict = new Error('Email is already registered');
            conflict.status = 409;
            throw conflict;
        }
        throw authError;
    }

    const userId = authUser.user.id;

    const { data: teacher, error } = await supabaseAdmin
        .from('teachers')
        .insert({
            id: userId,
            name,
            email: normalizedEmail,
            phone,
            business_name,
            subjects,
            whatsapp_number
        })
        .select(teacherSelectFields)
        .single();

    if (error) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw error;
    }

    return teacher;
}

/**
 * POST /api/auth/register
 * Create a new teacher account
 */
router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
    try {
        const teacher = await provisionTeacherAccount(req.body);

        const token = authService.tokenService.generateToken(teacher);

        await logAuthEvent(
            teacher.id,
            'register',
            true,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent'),
            { email: teacher.email }
        );

        res.status(201).json({
            success: true,
            data: {
                teacher: formatTeacherResponse(teacher),
                token
            },
            message: 'Registration successful',
            messageAr: 'تم إنشاء الحساب بنجاح'
        });
    } catch (error) {
        const statusCode = error.status || 500;
        logger.error('Registration error', { error: error.message });
        res.status(statusCode).json({
            success: false,
            message: statusCode === 409 ? 'Email is already registered' : 'Internal server error',
            messageAr: statusCode === 409 ? 'البريد الإلكتروني مسجل بالفعل' : 'خطأ في الخادم الداخلي'
        });
    }
});

router.post('/admin/create-teacher', authenticateToken, requireRole('admin'), validate(createTeacherSchema), async (req, res) => {
    try {
        const teacher = await provisionTeacherAccount(req.body);
        res.status(201).json({
            success: true,
            data: formatTeacherResponse(teacher),
            message: 'Teacher account created successfully'
        });
    } catch (error) {
        const statusCode = error.status || 500;
        logger.error('Admin create teacher error', { error: error.message });
        res.status(statusCode).json({
            success: false,
            message: statusCode === 409 ? 'Email is already registered' : 'Failed to create teacher account'
        });
    }
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.toLowerCase().trim();
        logger.info('Login attempt', { email: normalizedEmail });

        // Validate input
        if (!normalizedEmail || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
                messageAr: 'البريد الإلكتروني وكلمة المرور مطلوبان'
            });
        }

        // Authenticate user with Supabase Auth
        const result = await authService.authenticateUser(normalizedEmail, password, supabase);

        if (result.success) {
            // Get teacher profile from database
            const { data: teacherProfile } = await supabaseClient
                .from('teachers')
                .select(teacherSelectFields)
                .eq('id', result.user.id)
                .single();

            await updateLastLogin(result.user.id);

            // Log authentication attempt
            await logAuthEvent(
                result.user.id,
                'login',
                true,
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent'),
                { email: normalizedEmail }
            );

            res.json({
                success: true,
                data: {
                    teacher: formatTeacherResponse(teacherProfile) || result.user,
                    token: result.token
                },
                message: result.message,
                messageAr: result.messageAr
            });
        } else {
            // Log failed attempt
            await logAuthEvent(
                null,
                'login',
                false,
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent'),
                { email: normalizedEmail }
            );
            res.status(401).json({
                success: false,
                message: result.message || 'Invalid credentials',
                messageAr: result.messageAr || 'بيانات الدخول غير صحيحة'
            });
        }

    } catch (error) {
        logger.error('Login error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        if (token) {
            try {
                const decoded = authService.tokenService.verifyToken(token);

                // Log logout event
                await logAuthEvent(
                    decoded.user_id,
                    'logout',
                    true,
                    ipAddress,
                    userAgent
                );

                // TODO: Add token to blacklist or invalidate session in user_sessions table

            } catch (error) {
                // Token might be expired or invalid, but still allow logout
                logger.info('Token verification failed during logout', { error: error.message });
            }
        }

        res.json({
            success: true,
            message: 'Logged out successfully',
            messageAr: 'تم تسجيل الخروج بنجاح'
        });

    } catch (error) {
        logger.error('Logout error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * POST /api/auth/test
 * Test endpoint for debugging
 */


/**
 * POST /api/auth/verify-token
 * Verify JWT token validity
 */
router.get('/verify-token', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required',
                messageAr: 'الرمز المميز مطلوب'
            });
        }

        const decoded = authService.tokenService.verifyToken(token);

        // Get fresh user data to ensure user still exists
        const user = await getUserByEmail(decoded.email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
                messageAr: 'المستخدم غير موجود'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'teacher'
            },
            message: 'Token is valid',
            messageAr: 'الرمز المميز صالح'
        });

    } catch (error) {
        logger.error('Token verification error', { error: error.message });
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            messageAr: 'رمز مميز غير صالح أو منتهي الصلاحية'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const { data: teacher, error } = await supabaseClient
            .from('teachers')
            .select(teacherSelectFields)
            .eq('id', req.user.id)
            .single();

        if (error || !teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found',
                messageAr: 'المعلم غير موجود'
            });
        }

        res.json({
            success: true,
            data: formatTeacherResponse(teacher)
        });
    } catch (error) {
        logger.error('Get profile error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * PUT /api/auth/profile
 * Update current teacher profile
 */
router.put('/profile', authenticateToken, validate(updateProfileSchema), async (req, res) => {
    try {
        const allowedFields = [
            'name',
            'phone',
            'business_name',
            'bio',
            'subjects',
            'address',
            'city',
            'country',
            'timezone',
            'whatsapp_number',
            'telegram_username'
        ];

        const updates = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No profile fields provided',
                messageAr: 'لم يتم توفير أي بيانات للتحديث'
            });
        }

        updates.updated_at = new Date().toISOString();

        const { data: teacher, error } = await supabaseClient
            .from('teachers')
            .update(updates)
            .eq('id', req.user.id)
            .select(teacherSelectFields)
            .single();

        if (error || !teacher) {
            return res.status(400).json({
                success: false,
                message: error?.message || 'Failed to update profile',
                messageAr: 'فشل تحديث الملف الشخصي'
            });
        }

        res.json({
            success: true,
            data: formatTeacherResponse(teacher),
            message: 'Profile updated successfully',
            messageAr: 'تم تحديث الملف الشخصي بنجاح'
        });
    } catch (error) {
        logger.error('Update profile error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * POST /api/auth/request-reset
 * Request password reset
 */
router.post('/request-reset', resetLimiter, validate(requestResetSchema), async (req, res) => {
    try {
        const { email } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
                messageAr: 'البريد الإلكتروني مطلوب'
            });
        }

        // Check if user exists
        const user = await getUserByEmail(email);

        // Always return success to prevent email enumeration
        const response = {
            success: true,
            message: 'If an account with this email exists, a password reset link has been sent',
            messageAr: 'إذا كان هناك حساب بهذا البريد الإلكتروني، فقد تم إرسال رابط إعادة تعيين كلمة المرور'
        };

        if (user) {
            // Generate reset token
            const resetToken = authService.tokenService.generateResetToken();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Store reset token in database
            const { error } = await supabaseAdmin
                .from('password_reset_tokens')
                .insert({
                    teacher_id: user.id,
                    token: resetToken,
                    expires_at: expiresAt.toISOString()
                });

            if (!error) {
                // TODO: Send email with reset link
                logger.info('Password reset requested', { email });

                // Log password reset request
                await logAuthEvent(
                    user.id,
                    'password_reset_request',
                    true,
                    ipAddress,
                    userAgent,
                    { email }
                );
            }
        }

        res.json(response);

    } catch (error) {
        logger.error('Password reset request error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * GET /api/auth/reset/:token
 * Validate password reset token
 */
router.get('/reset/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Check if token exists and is not expired
        const { data: resetToken, error } = await supabaseAdmin
            .from('password_reset_tokens')
            .select('id, teacher_id, expires_at, used')
            .eq('token', token)
            .single();

        if (error || !resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset token',
                messageAr: 'رمز إعادة التعيين غير صالح'
            });
        }

        if (resetToken.used) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has already been used',
                messageAr: 'تم استخدام رمز إعادة التعيين بالفعل'
            });
        }

        if (new Date() > new Date(resetToken.expires_at)) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired',
                messageAr: 'انتهت صلاحية رمز إعادة التعيين'
            });
        }

        res.json({
            success: true,
            message: 'Reset token is valid',
            messageAr: 'رمز إعادة التعيين صالح'
        });

    } catch (error) {
        logger.error('Reset token validation error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required',
                messageAr: 'الرمز المميز وكلمة المرور الجديدة مطلوبان'
            });
        }

        // Validate password strength
        const passwordValidation = authService.passwordService.validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.errors.join(', '),
                messageAr: 'كلمة المرور لا تلبي متطلبات الأمان'
            });
        }

        // Validate reset token (same logic as GET /reset/:token)
        const { data: resetToken, error } = await supabaseAdmin
            .from('password_reset_tokens')
            .select('id, teacher_id, expires_at, used')
            .eq('token', token)
            .single();

        if (error || !resetToken || resetToken.used || new Date() > new Date(resetToken.expires_at)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token',
                messageAr: 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية'
            });
        }

        // Update user password via Supabase Auth
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            resetToken.teacher_id,
            { password: newPassword }
        );

        if (updateError) {
            throw updateError;
        }

        // Mark reset token as used
        await supabaseAdmin
            .from('password_reset_tokens')
            .update({ used: true })
            .eq('id', resetToken.id);

        // Log password reset completion
        await logAuthEvent(
            resetToken.teacher_id,
            'password_reset_complete',
            true,
            ipAddress,
            userAgent
        );

        res.json({
            success: true,
            message: 'Password has been reset successfully',
            messageAr: 'تم إعادة تعيين كلمة المرور بنجاح'
        });

    } catch (error) {
        logger.error('Password reset error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

module.exports = router;
