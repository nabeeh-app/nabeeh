const { TokenService } = require('../lib/auth');
const { supabaseAdmin } = require('../config/database');
const logger = require('../lib/logger');

// Initialize services
const tokenService = new TokenService();

/**
 * Authentication middleware to verify JWT tokens
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

        // Get fresh user data to ensure user is still active
        const { data: user, error } = await supabaseAdmin
            .from('teachers')
            .select('id, email, name, role, preferred_language, is_active')
            .eq('id', decoded.user_id)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token - user not found',
                messageAr: 'رمز غير صالح - المستخدم غير موجود'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'User account is deactivated',
                messageAr: 'حساب المستخدم معطل'
            });
        }

        // Add user info to request object
        req.user = user;
        req.token = decoded;

        next();

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

    // For teachers, check if they're accessing their own data
    const teacherId = req.params.teacherId || req.body.teacherId || req.query.teacherId;
    
    if (teacherId && teacherId !== req.user.id) {
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
                
                const { data: user } = await supabaseAdmin
                    .from('teachers')
                    .select('id, email, name, role, preferred_language, is_active')
                    .eq('id', decoded.user_id)
                    .single();

                if (user && user.is_active) {
                    req.user = user;
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

module.exports = {
    authenticateToken,
    requireRole,
    requireTeacherOwnership,
    optionalAuth
};