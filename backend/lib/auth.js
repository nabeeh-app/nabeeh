const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * JWT token management utilities
 */
class TokenService {
    constructor() {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is required');
        }
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    }

    /**
     * Generate JWT token for user
     * @param {Object} user - User object with id, email, role, etc.
     * @returns {string} - JWT token
     */
    generateToken(user) {
        const payload = {
            user_id: user.id,
            email: user.email,
            role: user.role || 'teacher'
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn,
            issuer: 'nabeeh-auth',
            audience: 'nabeeh-app'
        });
    }

    /**
     * Verify and decode JWT token
     * @param {string} token - JWT token
     * @returns {Object} - Decoded token payload
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret, {
                issuer: 'nabeeh-auth',
                audience: 'nabeeh-app'
            });
        } catch (error) {
            throw new Error(`Invalid token: ${error.message}`);
        }
    }

    /**
     * Generate secure random token for password reset
     * @returns {string} - Random token
     */
    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }
}

/**
 * Password strength validation
 */
class PasswordService {
    validatePasswordStrength(password) {
        const errors = [];
        if (password.length < 8) errors.push('Password must be at least 8 characters');
        if (password.length > 128) errors.push('Password must not exceed 128 characters');
        if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
        if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
        return { isValid: errors.length === 0, errors };
    }
}

/**
 * Authentication service combining password and token services
 */
class AuthService {
    constructor() {
        this.tokenService = new TokenService();
        this.passwordService = new PasswordService();
    }

    /**
     * Authenticate user with email and password using Supabase Auth
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {Object} supabaseAdmin - Supabase admin client
     * @returns {Promise<Object>} - Authentication result
     */
    async authenticateUser(email, password, supabaseAdmin) {
        try {
            // Use Supabase Auth for authentication
            const { data, error } = await supabaseAdmin.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                logger.error('Supabase auth error', { error: error.message });
                return {
                    success: false,
                    message: 'Invalid credentials',
                    messageAr: 'بيانات الدخول غير صحيحة'
                };
            }

            const user = data.user;

            // Generate a local JWT (not Supabase's access_token)
            const localToken = this.tokenService.generateToken({
                id: user.id,
                email: user.email,
                role: user.user_metadata?.role || 'teacher'
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.name || '',
                    role: user.user_metadata?.role || 'teacher'
                },
                token: localToken,
                message: 'Login successful',
                messageAr: 'تم تسجيل الدخول بنجاح'
            };
        } catch (error) {
            logger.error('Authentication error', { error: error.message });
            return {
                success: false,
                message: 'Authentication failed',
                messageAr: 'فشل في تسجيل الدخول'
            };
        }
    }
}

module.exports = {
    TokenService,
    PasswordService,
    AuthService
};
