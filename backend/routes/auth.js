const express = require('express');
const { supabase, supabaseAdmin } = require('../config/database');
const { TokenService, AuthService } = require('../lib/auth');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate, registerSchema, loginSchema, requestResetSchema, resetPasswordSchema, updateProfileSchema, createTeacherSchema } = require('../middleware/validate');
const rateLimit = require('express-rate-limit');
const logger = require('../lib/logger');
const { sendEmail } = require('../lib/email');

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';

function setAuthCookie(res, token) {
  res.cookie('nabeeh_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours, matches JWT_EXPIRES_IN default
    path: '/'
  });
  const csrfToken = require('crypto').randomBytes(32).toString('hex');
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  });
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
    // Use supabaseAdmin: called in unauthenticated contexts (register, reset)
    // where auth.uid() is null, so RLS would block the anon client.
    const { data, error } = await supabaseAdmin
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
    // Use supabaseAdmin: RLS policy uses auth.uid() which may not be set
    // on the anon client for all auth flows (e.g., OAuth).
    const { error } = await supabaseAdmin
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
        whatsapp_number = null,
        preferred_language = 'ar'
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
            whatsapp_number,
            preferred_language
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
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new teacher account
 *     description: Creates a new teacher account with email, password, and optional profile fields. Rate limited to 20 registrations per hour per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Teacher's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Unique email address
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Password (minimum 8 characters)
 *               phone:
 *                 type: string
 *                 pattern: "^\\+?[1-9]\\d{6,14}$"
 *                 description: Phone number in international format
 *               business_name:
 *                 type: string
 *                 description: Optional business or tutoring center name
 *               subjects:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of subjects taught
 *               whatsapp_number:
 *                 type: string
 *                 description: WhatsApp number for parent communication
 *     responses:
 *       200:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     teacher:
 *                       $ref: '#/components/schemas/Teacher'
 *                     token:
 *                       type: string
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
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

        setAuthCookie(res, token);

        res.status(201).json({
            success: true,
            data: {
                teacher: formatTeacherResponse(teacher),
                token
            },
            message: 'Registration successful',
            messageAr: 'تم إنشاء الحساب بنجاح'
        });

        // Welcome email to the new user — async, don't block the response
        const lang = teacher.preferred_language || 'ar';
        const isAr = lang === 'ar';
        const dir = isAr ? 'rtl' : 'ltr';
        const align = isAr ? 'right' : 'left';
        const font = isAr ? "'Segoe UI', Tahoma, Arial, sans-serif" : "Arial, 'Helvetica Neue', Helvetica, sans-serif";
        const welcomeEmail = {
            subject: isAr ? 'مرحباً بك في نبيه!' : 'Welcome to Nabeeh!',
            html: `
<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#fcfcf8;font-family:${font};color:#083d44;line-height:1.6;direction:${dir};text-align:${align};">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fcfcf8;padding:20px 0;direction:${dir};">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;direction:${dir};">
    <tr>
        <td style="background-color:#026370;padding:24px 32px;text-align:center;font-family:${font};">
            <span style="font-size:28px;font-weight:bold;color:#e5ff97;">${isAr ? 'نبيه' : 'Nabeeh'}</span>
        </td>
    </tr>
    <tr>
        <td style="background-color:#ffffff;padding:32px;border:1px solid #e8eced;border-top:none;text-align:${align};direction:${dir};font-family:${font};">
            <h2 style="margin:0 0 16px;font-size:22px;color:#083d44;text-align:${align};">
                ${isAr ? `أهلاً ${teacher.name || ''}،` : `Hey ${teacher.name || ''},`}
            </h2>
            <p style="margin:0 0 12px;color:#083d44;opacity:0.8;text-align:${align};">
                ${isAr
                    ? 'أنا مصطفى — مؤسس نبيه. بنينا نبيه لأننا عايزين طريقة أسهل للمعلمين يسيروا طلابهم وحضورهم ودرجاتهم — كلهم في مكان واحد.'
                    : "I'm Mustafa — founder of Nabeeh. We built this because we wanted a better way for teachers to manage students, attendance, and grades — all in one place."}
            </p>
            <p style="margin:0 0 12px;color:#083d44;opacity:0.8;text-align:${align};">
                ${isAr ? 'إليك 3 نصائح للبدء:' : 'Here are 3 tips to get started:'}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr><td style="padding:12px 16px;background-color:#f3f6e4;text-align:${align};">
                    <strong style="color:#026370;">${isAr ? '١.' : '1.'}</strong>
                    <span style="color:#083d44;"> ${isAr ? '<strong>أضف أول طالب</strong> — روح لصفحة الطلاب وأضف ملف شخصي' : '<strong>Add your first student</strong> — go to Students and create a profile'}</span>
                </td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f3f6e4;text-align:${align};">
                    <strong style="color:#026370;">${isAr ? '٢.' : '2.'}</strong>
                    <span style="color:#083d44;"> ${isAr ? '<strong>أنشئ دورة</strong> — حضّر العروض والمجموعات بتاعتك' : '<strong>Create a course</strong> — set up your offerings and groups'}</span>
                </td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f3f6e4;text-align:${align};">
                    <strong style="color:#026370;">${isAr ? '٣.' : '3.'}</strong>
                    <span style="color:#083d44;"> ${isAr ? '<strong>جرّب بوت واتساب</strong> — خلي أولياء الأمور يسألوا عن الدرجات تلقائياً' : '<strong>Try the WhatsApp bot</strong> — let parents ask about grades automatically'}</span>
                </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="${align}" style="padding:0 0 24px;">
                    <a href="${process.env.FRONTEND_URL || 'https://nabeeh.app'}/${lang}/login" style="display:inline-block;padding:12px 28px;background-color:#026370;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;font-family:${font};">${isAr ? 'افتح نبيه' : 'Open Nabeeh'}</a>
                </td></tr>
            </table>
            <p style="margin:0 0 20px;color:#083d44;opacity:0.8;text-align:${align};">
                ${isAr ? 'رد عليا وقولي إيه اللي جابك هنا — أنا بقرأ كل إيميل.' : 'Hit "Reply" and let me know what brought you here — I read every email.'}
            </p>
            <p style="margin:0;color:#083d44;opacity:0.7;text-align:${align};">
                ${isAr ? 'مع تحياتي،<br>مصطفى' : 'Cheers,<br>Mustafa'}
            </p>
        </td>
    </tr>
    <tr>
        <td style="background-color:#f3f6e4;padding:20px 32px;text-align:center;border:1px solid #e8eced;border-top:none;font-family:${font};">
            <p style="margin:0;font-size:13px;color:#083d44;opacity:0.6;">&copy; 2025 ${isAr ? 'نبيه — المساعد الذكي للتدريس' : 'Nabeeh — Smart Teaching Assistant'}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#083d44;opacity:0.4;">${isAr ? 'هذه رسالة تلقائية، يرجى عدم الرد عليها.' : 'This is an automated message, please do not reply.'}</p>
        </td>
    </tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        };

        sendEmail({
            to: teacher.email,
            from: 'Mustafa <mustafa@nabeeh.app>',
            subject: welcomeEmail.subject,
            html: welcomeEmail.html,
        }).catch(() => {});
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

/**
 * @openapi
 * /api/auth/admin/create-teacher:
 *   post:
 *     tags: [Auth]
 *     summary: Create a teacher account (admin only)
 *     description: Allows an admin user to provision a new teacher account. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Teacher's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Unique email address
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Password (minimum 8 characters)
 *               phone:
 *                 type: string
 *                 description: Phone number
 *               business_name:
 *                 type: string
 *                 description: Optional business name
 *               role:
 *                 type: string
 *                 description: 'User role (default: teacher)'
 *     responses:
 *       200:
 *         description: Teacher account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Teacher'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Forbidden — not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
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
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     description: Authenticates a teacher using email and password. Rate limited to 20 attempts per 5 minutes per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email address
 *               password:
 *                 type: string
 *                 description: Account password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     teacher:
 *                       $ref: '#/components/schemas/Teacher'
 *                     token:
 *                       type: string
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       400:
 *         description: Validation error — missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
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
            const { data: teacherProfile } = await supabaseAdmin
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

            setAuthCookie(res, result.token);

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
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current user
 *     description: Logs out the currently authenticated user and records the logout event.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        if (token) {
            try {
                // Revoke the token
                await authService.tokenService.revokeToken(token);

                const decoded = authService.tokenService.verifyToken(token);
                await logAuthEvent(
                    decoded.user_id,
                    'logout',
                    true,
                    ipAddress,
                    userAgent
                );
            } catch (error) {
                logger.info('Token revocation failed during logout', { error: error.message });
            }
        }

        res.clearCookie('nabeeh_token', { path: '/' });
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
 * @openapi
 * /api/auth/verify-token:
 *   get:
 *     tags: [Auth]
 *     summary: Verify JWT token validity
 *     description: Checks whether the provided JWT token is valid and the user still exists. Token can be passed in the Authorization header or as a query parameter.
 *     parameters:
 *       - name: Authorization
 *         in: header
 *         required: false
 *         schema:
 *           type: string
 *         description: "Bearer <token>"
 *       - name: token
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token as query parameter (fallback)
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Token is missing, invalid, or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/verify-token', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required',
                messageAr: 'الرمز المميز مطلوب'
            });
        }

        const decoded = authService.tokenService.verifyToken(token);

        // Check if token has been revoked
        if (decoded.jti && await authService.tokenService.isTokenRevoked(decoded.jti)) {
            return res.status(401).json({
                success: false,
                message: 'Token has been revoked',
                messageAr: 'تم إلغاء الرمز'
            });
        }

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
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     description: Returns the authenticated teacher's full profile. Requires a valid JWT token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Teacher'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Teacher profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Use supabaseAdmin: the user already passed authenticateToken,
        // and the teachers RLS policy uses auth.uid() which is not set
        // for backend-JWT-authenticated requests.
        const { data: teacher, error } = await supabaseAdmin
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
 * @openapi
 * /api/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update current teacher profile
 *     description: Updates the authenticated teacher's profile fields. Only provided fields are updated. Requires a valid JWT token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               phone:
 *                 type: string
 *               business_name:
 *                 type: string
 *               bio:
 *                 type: string
 *               subjects:
 *                 type: array
 *                 items:
 *                   type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               timezone:
 *                 type: string
 *               whatsapp_number:
 *                 type: string
 *               telegram_username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Teacher'
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       400:
 *         description: Validation error or no fields provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
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

        const { data: teacher, error } = await supabaseAdmin
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
 * @openapi
 * /api/auth/request-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: Sends a password reset email if an account with the given email exists. Always returns success to prevent email enumeration. Rate limited to 3 requests per hour per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email address
 *     responses:
 *       200:
 *         description: Reset request processed (always returns success for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       429:
 *         description: Too many reset requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
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
            const resetTokenPlain = authService.tokenService.generateResetToken();
            const resetToken = authService.tokenService.hashToken(resetTokenPlain);
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Store hashed reset token in database
            const { error } = await supabaseAdmin
                .from('password_reset_tokens')
                .insert({
                    teacher_id: user.id,
                    token: resetToken,
                    expires_at: expiresAt.toISOString()
                });

            if (!error) {
                // Send password reset email
                const frontendUrl = process.env.FRONTEND_URL || 'https://nabeeh.app';
                const resetLink = `${frontendUrl}/reset-password?token=${resetTokenPlain}`;
                const lang = user.preferred_language || 'ar';
                const { getPasswordResetTemplate } = require('../lib/emailTemplates');
                const resetEmail = getPasswordResetTemplate({ name: user.name, resetLink, language: lang });

                sendEmail({
                    to: user.email,
                    from: 'Nabeeh <noreply@nabeeh.app>',
                    subject: resetEmail.subject,
                    html: resetEmail.html,
                }).catch(() => {});

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
 * @openapi
 * /api/auth/reset/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: Validate password reset token
 *     description: Checks whether a password reset token is valid, not expired, and not yet used.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token received via email
 *     responses:
 *       200:
 *         description: Reset token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid, expired, or already-used token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/reset/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Check if token exists and is not expired
        const hashedToken = authService.tokenService.hashToken(token);
        const { data: resetToken, error } = await supabaseAdmin
            .from('password_reset_tokens')
            .select('id, teacher_id, expires_at, used')
            .eq('token', hashedToken)
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
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     description: Resets the user's password using a valid reset token. The token must be valid, not expired, and not previously used.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token received via email
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (minimum 8 characters)
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       400:
 *         description: Validation error, invalid token, or password too weak
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
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
        const hashedToken = authService.tokenService.hashToken(token);
        const { data: resetToken, error } = await supabaseAdmin
            .from('password_reset_tokens')
            .select('id, teacher_id, expires_at, used')
            .eq('token', hashedToken)
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

/**
 * @openapi
 * /api/auth/oauth/check-profile:
 *   post:
 *     tags: [Auth]
 *     summary: Check if a user has a teacher profile
 *     description: Used during OAuth flow to check whether the authenticated user already has a teacher profile or assistant link. Accepts user_id or email.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: Supabase auth user ID
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *     responses:
 *       200:
 *         description: Profile check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasProfile:
 *                       type: boolean
 *                     isAssistant:
 *                       type: boolean
 *                     teacher:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *       400:
 *         description: Neither user_id nor email provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/oauth/check-profile', authenticateToken, async (req, res) => {
    try {
        const { user_id, email } = req.body;

        if (!user_id && !email) {
            return res.status(400).json({
                success: false,
                message: 'user_id or email is required',
                messageAr: 'user_id أو البريد الإلكتروني مطلوب'
            });
        }

        let teacher = null;

        // Check by user_id first
        if (user_id) {
            const { data } = await supabaseAdmin
                .from('teachers')
                .select('id, name, email')
                .eq('id', user_id)
                .single();
            teacher = data;
        }

        // If not found by user_id, check by email
        if (!teacher && email) {
            const { data } = await supabaseAdmin
                .from('teachers')
                .select('id, name, email')
                .eq('email', email.toLowerCase().trim())
                .single();
            teacher = data;
        }

        // Also check if user is an assistant
        let isAssistant = false;
        if (user_id) {
            const { data: assistantLink } = await supabaseAdmin
                .from('teacher_assistants')
                .select('id')
                .eq('assistant_id', user_id)
                .eq('status', 'active')
                .single();
            isAssistant = !!assistantLink;
        }

        const hasProfile = !!teacher || isAssistant;

        res.json({
            success: true,
            data: {
                hasProfile,
                isAssistant,
                teacher: teacher ? { id: teacher.id, name: teacher.name, email: teacher.email } : null
            }
        });

    } catch (error) {
        logger.error('Check profile error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * @openapi
 * /api/auth/oauth/callback:
 *   post:
 *     tags: [Auth]
 *     summary: Handle Google OAuth callback
 *     description: Processes a Google OAuth access token. If the email matches an existing teacher, links the account and logs in. If an assistant invite exists, activates the assistant. Otherwise, creates a new teacher account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [access_token, provider]
 *             properties:
 *               access_token:
 *                 type: string
 *                 description: OAuth access token from Google
 *               provider:
 *                 type: string
 *                 enum: [google]
 *                 description: OAuth provider name
 *     responses:
 *       200:
 *         description: OAuth login/link successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     teacher:
 *                       $ref: '#/components/schemas/Teacher'
 *                     token:
 *                       type: string
 *                     isNewUser:
 *                       type: boolean
 *                     isAssistant:
 *                       type: boolean
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       201:
 *         description: New account created via OAuth
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     teacher:
 *                       $ref: '#/components/schemas/Teacher'
 *                     token:
 *                       type: string
 *                     isNewUser:
 *                       type: boolean
 *                 message:
 *                   type: string
 *                 messageAr:
 *                   type: string
 *       400:
 *         description: Invalid OAuth parameters or missing email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Failed to verify OAuth token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/oauth/callback', async (req, res) => {
    try {
        const { access_token, provider } = req.body;

        if (!access_token || provider !== 'google') {
            return res.status(400).json({
                success: false,
                message: 'Invalid OAuth callback parameters',
                messageAr: 'معلمات تسجيل الدخول عبر OAuth غير صالحة'
            });
        }

        // Exchange access token for user info via Supabase
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(access_token);

        if (authError || !user) {
            return res.status(401).json({
                success: false,
                message: 'Failed to verify OAuth token',
                messageAr: 'فشل التحقق من رمز OAuth'
            });
        }

        const email = user.email?.toLowerCase().trim();
        const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
        const avatarUrl = user.user_metadata?.avatar_url || null;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email not provided by OAuth provider',
                messageAr: 'لم يتم توفير البريد الإلكتروني من مزود تسجيل الدخول'
            });
        }

        // Check if this email matches an existing teacher
        const { data: existingTeacher } = await supabaseAdmin
            .from('teachers')
            .select('id, email, name')
            .eq('email', email)
            .single();

        if (existingTeacher) {
            // Account linking: link the Google auth user to existing teacher
            // Check if the auth user ID already matches the teacher ID
            if (user.id === existingTeacher.id) {
                // Already linked - just generate token and return
                const token = authService.tokenService.generateToken(existingTeacher);

                await logAuthEvent(
                    existingTeacher.id,
                    'oauth_login',
                    true,
                    req.ip || req.connection.remoteAddress,
                    req.get('User-Agent'),
                    { provider, email }
                );

                setAuthCookie(res, token);

                return res.json({
                    success: true,
                    data: {
                        teacher: formatTeacherResponse(existingTeacher),
                        token,
                        isNewUser: false
                    },
                    message: 'Login successful',
                    messageAr: 'تم تسجيل الدخول بنجاح'
                });
            }

            // Auth user ID doesn't match teacher ID - need to link them
            // Update the teacher's ID to match the auth user's ID
            const { error: linkError } = await supabaseAdmin
                .from('teachers')
                .update({ 
                    id: user.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingTeacher.id);

            if (linkError) {
                // If ID update fails (likely due to FK constraints), try alternative approach
                // Create a new auth user with the existing teacher's ID
                logger.info('Account linking: ID update failed, checking existing auth user', { error: linkError.message });
                
                // The user is already authenticated via Google, so use their ID
                const token = authService.tokenService.generateToken({ 
                    id: user.id, 
                    email, 
                    name: existingTeacher.name 
                });

                await logAuthEvent(
                    existingTeacher.id,
                    'oauth_login',
                    true,
                    req.ip || req.connection.remoteAddress,
                    req.get('User-Agent'),
                    { provider, email }
                );

                setAuthCookie(res, token);

                return res.json({
                    success: true,
                    data: {
                        teacher: formatTeacherResponse({ ...existingTeacher, id: user.id }),
                        token,
                        isNewUser: false
                    },
                    message: 'Login successful',
                    messageAr: 'تم تسجيل الدخول بنجاح'
                });
            }

            // Successfully linked
            const token = authService.tokenService.generateToken({ 
                id: user.id, 
                email, 
                name: existingTeacher.name 
            });

            await logAuthEvent(
                user.id,
                'oauth_account_linked',
                true,
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent'),
                { provider, email, linkedTo: existingTeacher.id }
            );

            setAuthCookie(res, token);

            return res.json({
                success: true,
                data: {
                    teacher: formatTeacherResponse({ ...existingTeacher, id: user.id }),
                    token,
                    isNewUser: false
                },
                message: 'Account linked and login successful',
                messageAr: 'تم ربط الحساب وتسجيل الدخول بنجاح'
            });
        }

        // No existing teacher found - check if this is an assistant invite
        const { data: invite } = await supabaseAdmin
            .from('assistant_invites')
            .select('id, teacher_id, permissions, expires_at')
            .eq('email', email)
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (invite) {
            // This is an invited assistant - create the teacher_assistants link
            const { error: inviteError } = await supabaseAdmin
                .from('teacher_assistants')
                .insert({
                    teacher_id: invite.teacher_id,
                    assistant_id: user.id,
                    permissions: invite.permissions,
                    status: 'active',
                    accepted_at: new Date().toISOString()
                });

            if (!inviteError) {
                // Mark invite as accepted
                await supabaseAdmin
                    .from('assistant_invites')
                    .update({ accepted_at: new Date().toISOString() })
                    .eq('id', invite.id);

                // Get teacher info for token
                const { data: ownerTeacher } = await supabaseAdmin
                    .from('teachers')
                    .select('id, email, name')
                    .eq('id', invite.teacher_id)
                    .single();

                const token = authService.tokenService.generateToken({
                    id: user.id,
                    email: ownerTeacher?.email || email,
                    name: name || ownerTeacher?.name || ''
                });

                await logAuthEvent(
                    user.id,
                    'oauth_assistant_accepted',
                    true,
                    req.ip || req.connection.remoteAddress,
                    req.get('User-Agent'),
                    { provider, email, teacherId: invite.teacher_id }
                );

                setAuthCookie(res, token);

                return res.json({
                    success: true,
                    data: {
                        teacher: {
                            id: user.id,
                            email: ownerTeacher?.email || email,
                            name: name || ownerTeacher?.name || '',
                            role: 'assistant'
                        },
                        token,
                        isNewUser: true,
                        isAssistant: true
                    },
                    message: 'Assistant account activated',
                    messageAr: 'تم تفعيل حساب المساعد'
                });
            }
        }

        // No existing teacher or invite - this is a new user
        // Create a new teacher account from Google profile data
        const { data: newTeacher, error: createError } = await supabaseAdmin
            .from('teachers')
            .insert({
                id: user.id,
                name: name,
                email: email,
                updated_at: new Date().toISOString()
            })
            .select(teacherSelectFields)
            .single();

        if (createError) {
            // If teacher creation fails (e.g., duplicate key), the user might already exist
            // Try to get the existing teacher
            const { data: fallbackTeacher } = await supabaseAdmin
                .from('teachers')
                .select(teacherSelectFields)
                .eq('id', user.id)
                .single();

            if (fallbackTeacher) {
                const token = authService.tokenService.generateToken(fallbackTeacher);

                await logAuthEvent(
                    fallbackTeacher.id,
                    'oauth_login',
                    true,
                    req.ip || req.connection.remoteAddress,
                    req.get('User-Agent'),
                    { provider, email }
                );

                setAuthCookie(res, token);

                return res.json({
                    success: true,
                    data: {
                        teacher: formatTeacherResponse(fallbackTeacher),
                        token,
                        isNewUser: false
                    },
                    message: 'Login successful',
                    messageAr: 'تم تسجيل الدخول بنجاح'
                });
            }

            throw createError;
        }

        const token = authService.tokenService.generateToken(newTeacher);

        await logAuthEvent(
            newTeacher.id,
            'oauth_register',
            true,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent'),
            { provider, email }
        );

        setAuthCookie(res, token);

        res.status(201).json({
            success: true,
            data: {
                teacher: formatTeacherResponse(newTeacher),
                token,
                isNewUser: true
            },
            message: 'Registration successful',
            messageAr: 'تم إنشاء الحساب بنجاح'
        });

    } catch (error) {
        logger.error('OAuth callback error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            messageAr: 'خطأ في الخادم الداخلي'
        });
    }
});

/**
 * @openapi
 * components:
 *   schemas:
 *     ErrorEnvelope:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         messageAr:
 *           type: string
 *         code:
 *           type: string
 *     Teacher:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         name:
 *           type: string
 *         phone:
 *           type: string
 *         role:
 *           type: string
 *           example: teacher
 *         business_name:
 *           type: string
 *           nullable: true
 *         bio:
 *           type: string
 *           nullable: true
 *         subjects:
 *           type: array
 *           items:
 *             type: string
 *         address:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *         country:
 *           type: string
 *           nullable: true
 *         timezone:
 *           type: string
 *           example: Africa/Cairo
 *         whatsapp_number:
 *           type: string
 *           nullable: true
 *         telegram_username:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

module.exports = router;
