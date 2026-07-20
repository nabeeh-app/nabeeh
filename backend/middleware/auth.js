const { TokenService } = require('../lib/auth');
const { supabaseAdmin } = require('../config/database');
const logger = require('../lib/logger');

// Initialize services
const tokenService = new TokenService();

// Default permissions for teachers (full access)
const TEACHER_DEFAULT_PERMISSIONS = {
    view_students: true,
    manage_attendance: true,
    manage_grades: true,
    manage_assessments: true,
    manage_offerings: true,
    send_whatsapp: true,
    view_reports: true,
    manage_students: true
};

/**
 * Authentication middleware to verify JWT tokens
 * Resolves both teachers and assistants
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : req.cookies?.nabeeh_token || null;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required',
                messageAr: 'رمز الوصول مطلوب'
            });
        }

        // Verify token
        const decoded = tokenService.verifyToken(token);

        // Check if token has been revoked
        if (decoded.jti && await tokenService.isTokenRevoked(decoded.jti)) {
            return res.status(401).json({
                success: false,
                message: 'Token has been revoked',
                messageAr: 'تم إلغاء الرمز'
            });
        }

        // Resolve user (teacher or assistant) with single teacher query
        const { user, error } = await resolveUser(decoded);

        if (error) {
            return res.status(401).json({
                success: false,
                message: error,
                messageAr: error === 'User account is deactivated' ? 'حساب المستخدم معطل'
                    : error === 'Associated teacher account is deactivated' ? 'حساب المعلم المرتبط معطل'
                    : 'رمز غير صالح - المستخدم غير موجود'
            });
        }

        req.user = user;
        req.token = decoded;
        return next();

    } catch (error) {
        logger.error('Authentication middleware error', { error: error.message });
        
        if (error.message.includes('expired')) {
            return res.status(401).json({
                success: false,
                message: 'Token has expired',
                messageAr: 'انتهت صلاحية الرمز المميز'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Invalid token',
            messageAr: 'رمز غير صالح'
        });
    }
};

/**
 * Resolve user from decoded JWT token
 * Single query for teacher (by id OR auth_id), then assistant fallback
 * @param {Object} decoded - Decoded JWT payload with user_id, jti
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
const resolveUser = async (decoded) => {
    const userId = decoded.user_id;

    // Single query: teacher by id OR auth_id
    const { data: teacher, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .select('id, email, name, role, preferred_language, is_active, auth_id')
        .or(`id.eq.${userId},auth_id.eq.${userId}`)
        .single();

    if (teacher && !teacherError) {
        if (!teacher.is_active) {
            return { user: null, error: 'User account is deactivated' };
        }

        return {
            user: {
                ...teacher,
                role: 'teacher',
                permissions: TEACHER_DEFAULT_PERMISSIONS,
                teacherId: teacher.id
            },
            error: null
        };
    }

    // Not a teacher — check assistant link
    const { data: assistantLink, error: assistantError } = await supabaseAdmin
        .from('teacher_assistants')
        .select(`
            id,
            teacher_id,
            permissions,
            status,
            teachers!teacher_id (
                id,
                email,
                name,
                is_active
            )
        `)
        .eq('assistant_id', userId)
        .eq('status', 'active')
        .single();

    if (assistantLink && !assistantError) {
        const ownerTeacher = assistantLink.teachers;

        if (!ownerTeacher || !ownerTeacher.is_active) {
            return { user: null, error: 'Associated teacher account is deactivated' };
        }

        const permissions = {
            ...TEACHER_DEFAULT_PERMISSIONS,
            ...assistantLink.permissions
        };

        return {
            user: {
                id: userId,
                email: ownerTeacher.email,
                name: ownerTeacher.name,
                role: 'assistant',
                permissions,
                teacherId: assistantLink.teacher_id,
                assistantLinkId: assistantLink.id
            },
            error: null
        };
    }

    return { user: null, error: 'Invalid token - user not found' };
};

/**
 * Role-based authorization middleware
 * @param {string|Array} allowedRoles - Single role or array of allowed roles
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                messageAr: 'المصادقة مطلوبة'
            });
        }

        const userRole = req.user.role;
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                messageAr: 'صلاحيات غير كافية'
            });
        }

        next();
    };
};

/**
 * Teacher-specific authorization middleware
 * Ensures teacher can only access their own data
 * Assistants access data through their teacherId
 */
const requireTeacherOwnership = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            messageAr: 'المصادقة مطلوبة'
        });
    }

    // Admin users can access any teacher's data
    if (req.user.role === 'admin') {
        return next();
    }

    // For teachers and assistants, check if they're accessing their own data
    // Assistants use teacherId (the owning teacher's ID)
    const ownerTeacherId = req.user.teacherId || req.user.id;
    const teacherId = req.params.teacherId || req.body.teacherId || req.query.teacherId;
    
    if (teacherId && teacherId !== ownerTeacherId) {
        return res.status(403).json({
            success: false,
            message: 'You can only access your own data',
            messageAr: 'يمكنك الوصول إلى بياناتك فقط'
        });
    }

    next();
};

/**
 * Permission-based authorization middleware for assistants
 * @param {string|Array} requiredPermissions - Single permission or array of required permissions
 */
const requirePermission = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                messageAr: 'المصادقة مطلوبة'
            });
        }

        // Teachers have full permissions
        if (req.user.role === 'teacher' || req.user.role === 'admin') {
            return next();
        }

        // Assistants need specific permission check
        const permissions = req.user.permissions || {};
        const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

        const hasPermission = required.every(p => permissions[p] === true);

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                messageAr: 'صلاحيات غير كافية'
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    requireRole,
    requireTeacherOwnership,
    requirePermission
};