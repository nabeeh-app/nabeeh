const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Password hashing and verification utilities
 */
class PasswordService {
    constructor() {
        this.saltRounds = 12; // Minimum 12 as per requirements
    }

    /**
     * Hash a plain text password
     * @param {string} password - Plain text password
     * @returns {Promise<string>} - Hashed password
     */
    async hashPassword(password) {
        if (!password) {
            throw new Error('Password is required');
        }
        return await bcrypt.hash(password, this.saltRounds);
    }

    /**
     * Verify a password against its hash
     * @param {string} password - Plain text password
     * @param {string} hash - Hashed password
     * @returns {Promise<boolean>} - True if password matches
     */
    async verifyPassword(password, hash) {
        if (!password || !hash) {
            return false;
        }
        return await bcrypt.compare(password, hash);
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} - Validation result with isValid and errors
     */
    validatePasswordStrength(password) {
        const errors = [];
        
        if (!password) {
            errors.push('Password is required');
            return { isValid: false, errors };
        }

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

/**
 * JWT token management utilities
 */
class TokenService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
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
            role: user.role,
            subject_id: user.subject_id,
            preferred_language: user.preferred_language
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
 * Authentication service combining password and token services
 */
class AuthService {
    constructor() {
        this.passwordService = new PasswordService();
        this.tokenService = new TokenService();
    }

    /**
     * Authenticate user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {Function} getUserByEmail - Function to get user by email from database
     * @returns {Promise<Object>} - Authentication result
     */
    async authenticateUser(email, password, getUserByEmail) {
        try {
            // Get user from database
            const user = await getUserByEmail(email);
            if (!user) {
                return {
                    success: false,
                    message: 'Invalid credentials',
                    messageAr: 'بيانات الدخول غير صحيحة'
                };
            }

            // Check if user is active
            if (!user.is_active) {
                return {
                    success: false,
                    message: 'Account is deactivated',
                    messageAr: 'الحساب معطل'
                };
            }

            // Verify password
            const isPasswordValid = await this.passwordService.verifyPassword(password, user.password_hash);
            if (!isPasswordValid) {
                return {
                    success: false,
                    message: 'Invalid credentials',
                    messageAr: 'بيانات الدخول غير صحيحة'
                };
            }

            // Generate token
            const token = this.tokenService.generateToken(user);

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    preferred_language: user.preferred_language
                },
                token,
                message: 'Login successful',
                messageAr: 'تم تسجيل الدخول بنجاح'
            };
        } catch (error) {
            console.error('Authentication error:', error);
            return {
                success: false,
                message: 'Authentication failed',
                messageAr: 'فشل في تسجيل الدخول'
            };
        }
    }
}

module.exports = {
    PasswordService,
    TokenService,
    AuthService
};