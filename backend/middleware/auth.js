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
            : null;

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

        // First, try to find the user as a teacher
        const { data: teacher, error: teacherError } = await supabaseAdmin
            .from('teachers')
            .select('id, email, name, role, preferred_language, is_active')
            .eq('id', decoded.user_id)
            .single();

        if (teacher && !teacherError) {
            if (!teacher.is_active) {
                return res.status(401).json({
                    success: false,
                    message: 'User account is deactivated',
                    messageAr: 'حساب المستخدم معطل'
                });
            }

            // Teacher found - set full permissions
            req.user = {
                ...teacher,
                role: 'teacher',
                permissions: TEACHER_DEFAULT_PERMISSIONS,
                teacherId: teacher.id
            };
            req.token = decoded;
            return next();
        }

        // Not found as teacher - check if assistant via teacher_assistants junction
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
            .eq('assistant_id', decoded.user_id)
            .eq('status', 'active')
            .single();

        if (assistantLink && !assistantError) {
            const ownerTeacher = assistantLink.teachers;

            if (!ownerTeacher || !ownerTeacher.is_active) {
                return res.status(401).json({
                    success: false,
                    message: 'Associated teacher account is deactivated',
                    messageAr: 'حساب المعلم المرتبط معطل'
                });
            }

            // Merge default permissions with stored permissions
            const permissions = {
                ...TEACHER_DEFAULT_PERMISSIONS,
                ...assistantLink.permissions
            };

            req.user = {
                id: decoded.user_id,
                email: ownerTeacher.email,
                name: ownerTeacher.name,
                role: 'assistant',
                permissions,
                teacherId: assistantLink.teacher_id,
                assistantLinkId: assistantLink.id
            };
            req.token = decoded;
            return next();
        }

        // Neither teacher nor active assistant found
        return res.status(401).json({
            success: false,
            message: 'Invalid token - user not found',
            messageAr: 'رمز غير صالح - المستخدم غير موجود'
        });

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
 * Optional authentication middleware
 * Adds user info if token is present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : null;

        if (token) {
            try {
                const decoded = tokenService.verifyToken(token);

                // Check if token has been revoked
                if (decoded.jti && await tokenService.isTokenRevoked(decoded.jti)) {
                    return res.status(401).json({
                        success: false,
                        message: 'Token has been revoked',
                        messageAr: 'تم إلغاء الرمز'
                    });
                }

                // Try teacher first
                const { data: teacher } = await supabaseAdmin
                    .from('teachers')
                    .select('id, email, name, role, preferred_language, is_active')
                    .eq('id', decoded.user_id)
                    .single();

                if (teacher && teacher.is_active) {
                    req.user = {
                        ...teacher,
                        role: 'teacher',
                        permissions: TEACHER_DEFAULT_PERMISSIONS,
                        teacherId: teacher.id
                    };
                    req.token = decoded;
                    return next();
                }

                // Try assistant
                const { data: assistantLink } = await supabaseAdmin
                    .from('teacher_assistants')
                    .select(`
                        id,
                        teacher_id,
                        permissions,
                        status,
                        teachers!teacher_id ( id, is_active )
                    `)
                    .eq('assistant_id', decoded.user_id)
                    .eq('status', 'active')
                    .single();

                if (assistantLink && assistantLink.teachers?.is_active) {
                    const permissions = {
                        ...TEACHER_DEFAULT_PERMISSIONS,
                        ...assistantLink.permissions
                    };
                    req.user = {
                        id: decoded.user_id,
                        role: 'assistant',
                        permissions,
                        teacherId: assistantLink.teacher_id
                    };
                    req.token = decoded;
                }
            } catch (error) {
                // Ignore token errors for optional auth
                logger.info('Optional auth token error', { error: error.message });
            }
        }

        next();

    } catch (error) {
        logger.error('Optional auth middleware error', { error: error.message });
        next(); // Continue without authentication
    }
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
    requirePermission,
    optionalAuth
};