/**
 * Role-based permission system for Nabeeh
 */

// Define user roles
const USER_ROLES = {
    TEACHER: 'teacher',
    ADMIN: 'admin',
    PARENT: 'parent'
};

// Define permissions
const PERMISSIONS = {
    // Student management
    VIEW_STUDENTS: 'view_students',
    CREATE_STUDENTS: 'create_students',
    UPDATE_STUDENTS: 'update_students',
    DELETE_STUDENTS: 'delete_students',
    
    // Attendance management
    VIEW_ATTENDANCE: 'view_attendance',
    MARK_ATTENDANCE: 'mark_attendance',
    UPDATE_ATTENDANCE: 'update_attendance',
    
    // Grade management
    VIEW_GRADES: 'view_grades',
    CREATE_GRADES: 'create_grades',
    UPDATE_GRADES: 'update_grades',
    DELETE_GRADES: 'delete_grades',
    PUBLISH_GRADES: 'publish_grades',
    
    // Parent communication
    VIEW_MESSAGES: 'view_messages',
    SEND_MESSAGES: 'send_messages',
    
    // System administration
    MANAGE_USERS: 'manage_users',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    SYSTEM_SETTINGS: 'system_settings',
    
    // Teacher management
    VIEW_TEACHER_PROFILE: 'view_teacher_profile',
    UPDATE_TEACHER_PROFILE: 'update_teacher_profile'
};

// Role-permission mapping
const ROLE_PERMISSIONS = {
    [USER_ROLES.TEACHER]: [
        // Student management for own students
        PERMISSIONS.VIEW_STUDENTS,
        PERMISSIONS.CREATE_STUDENTS,
        PERMISSIONS.UPDATE_STUDENTS,
        
        // Attendance management
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.MARK_ATTENDANCE,
        PERMISSIONS.UPDATE_ATTENDANCE,
        
        // Grade management
        PERMISSIONS.VIEW_GRADES,
        PERMISSIONS.CREATE_GRADES,
        PERMISSIONS.UPDATE_GRADES,
        PERMISSIONS.DELETE_GRADES,
        PERMISSIONS.PUBLISH_GRADES,
        
        // Communication
        PERMISSIONS.VIEW_MESSAGES,
        PERMISSIONS.SEND_MESSAGES,
        
        // Own profile
        PERMISSIONS.VIEW_TEACHER_PROFILE,
        PERMISSIONS.UPDATE_TEACHER_PROFILE
    ],
    
    [USER_ROLES.ADMIN]: [
        // All teacher permissions plus admin-specific ones
        ...ROLE_PERMISSIONS[USER_ROLES.TEACHER] || [],
        
        // Additional admin permissions
        PERMISSIONS.DELETE_STUDENTS,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.VIEW_AUDIT_LOGS,
        PERMISSIONS.SYSTEM_SETTINGS
    ],
    
    [USER_ROLES.PARENT]: [
        // Limited permissions for parents
        PERMISSIONS.VIEW_STUDENTS, // Only their own children
        PERMISSIONS.VIEW_ATTENDANCE, // Only their children's attendance
        PERMISSIONS.VIEW_GRADES, // Only their children's grades
        PERMISSIONS.VIEW_MESSAGES,
        PERMISSIONS.SEND_MESSAGES
    ]
};

/**
 * Check if a user role has a specific permission
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean} - True if role has permission
 */
function hasPermission(role, permission) {
    if (!role || !permission) {
        return false;
    }
    
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    return rolePermissions.includes(permission);
}

/**
 * Get all permissions for a role
 * @param {string} role - User role
 * @returns {Array} - Array of permissions
 */
function getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user can access resource based on ownership
 * @param {Object} user - User object with id and role
 * @param {string} resourceOwnerId - ID of resource owner
 * @param {string} permission - Permission required
 * @returns {boolean} - True if user can access
 */
function canAccessResource(user, resourceOwnerId, permission) {
    if (!user || !permission) {
        return false;
    }
    
    // Check if user has the permission
    if (!hasPermission(user.role, permission)) {
        return false;
    }
    
    // Admins can access everything
    if (user.role === USER_ROLES.ADMIN) {
        return true;
    }
    
    // Teachers can only access their own resources
    if (user.role === USER_ROLES.TEACHER) {
        return user.id === resourceOwnerId;
    }
    
    // Parents can only access their children's resources
    if (user.role === USER_ROLES.PARENT) {
        // This would need additional logic to check parent-child relationships
        // For now, return false - implement when parent system is ready
        return false;
    }
    
    return false;
}

/**
 * Middleware factory for permission checking
 * @param {string} permission - Required permission
 * @returns {Function} - Express middleware function
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                messageAr: 'المصادقة مطلوبة'
            });
        }
        
        if (!hasPermission(req.user.role, permission)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                messageAr: 'صلاحيات غير كافية'
            });
        }
        
        next();
    };
}

/**
 * Middleware factory for resource ownership checking
 * @param {string} permission - Required permission
 * @param {Function} getResourceOwnerId - Function to extract resource owner ID from request
 * @returns {Function} - Express middleware function
 */
function requireResourceAccess(permission, getResourceOwnerId) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                messageAr: 'المصادقة مطلوبة'
            });
        }
        
        const resourceOwnerId = getResourceOwnerId(req);
        
        if (!canAccessResource(req.user, resourceOwnerId, permission)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                messageAr: 'الوصول مرفوض'
            });
        }
        
        next();
    };
}

module.exports = {
    USER_ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    hasPermission,
    getRolePermissions,
    canAccessResource,
    requirePermission,
    requireResourceAccess
};