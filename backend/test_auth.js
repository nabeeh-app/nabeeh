require('dotenv').config();
const { AuthService } = require('./lib/auth');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize auth service
const authService = new AuthService();

// Helper function to get user by email
async function getUserByEmail(email) {
    const { data, error } = await supabase
        .from('teachers')
        .select('id, email, name, password_hash, role, subject_id, preferred_language, is_active, last_login')
        .eq('email', email)
        .single();

    if (error) {
        console.error('Database error:', error);
        return null;
    }

    return data;
}

async function testAuthentication() {
    console.log('🧪 Testing Authentication System...\n');

    try {
        // Test 1: Get a test user
        console.log('1️⃣ Testing user retrieval...');
        const testUser = await getUserByEmail('test@example.com');
        if (testUser) {
            console.log('✅ User found:', testUser.name, '(' + testUser.email + ')');
        } else {
            console.log('❌ Test user not found');
            return;
        }

        // Test 2: Test password verification with wrong password
        console.log('\n2️⃣ Testing authentication with wrong password...');
        const wrongResult = await authService.authenticateUser('test@example.com', 'wrongpassword', getUserByEmail);
        console.log('Result:', wrongResult.success ? '✅ Success' : '❌ Failed (Expected)');
        console.log('Message:', wrongResult.message);

        // Test 3: Test password verification with correct password
        console.log('\n3️⃣ Testing authentication with correct password...');
        // We need to know what the correct password is. Let's try common test passwords
        const testPasswords = ['password', 'test123', 'Test123!', 'testpassword'];
        
        let authSuccess = false;
        for (const password of testPasswords) {
            const result = await authService.authenticateUser('test@example.com', password, getUserByEmail);
            if (result.success) {
                console.log('✅ Authentication successful with password:', password);
                console.log('Token generated:', result.token ? 'Yes' : 'No');
                console.log('User data:', result.user);
                authSuccess = true;
                
                // Test 4: Test token verification
                console.log('\n4️⃣ Testing token verification...');
                try {
                    const decoded = authService.tokenService.verifyToken(result.token);
                    console.log('✅ Token verification successful');
                    console.log('Decoded payload:', decoded);
                } catch (error) {
                    console.log('❌ Token verification failed:', error.message);
                }
                break;
            }
        }

        if (!authSuccess) {
            console.log('❌ Could not authenticate with any test password');
            console.log('💡 You may need to set a known password for the test user');
        }

        // Test 5: Test password hashing
        console.log('\n5️⃣ Testing password hashing...');
        const testPassword = 'NewTestPassword123!';
        const hashedPassword = await authService.passwordService.hashPassword(testPassword);
        console.log('✅ Password hashed successfully');
        console.log('Hash starts with $2:', hashedPassword.startsWith('$2'));

        const isValid = await authService.passwordService.verifyPassword(testPassword, hashedPassword);
        console.log('✅ Password verification:', isValid ? 'Success' : 'Failed');

        // Test 6: Test password strength validation
        console.log('\n6️⃣ Testing password strength validation...');
        const weakPassword = '123';
        const strongPassword = 'StrongPass123!';
        
        const weakValidation = authService.passwordService.validatePasswordStrength(weakPassword);
        const strongValidation = authService.passwordService.validatePasswordStrength(strongPassword);
        
        console.log('Weak password validation:', weakValidation.isValid ? '❌ Unexpected success' : '✅ Failed as expected');
        console.log('Weak password errors:', weakValidation.errors);
        
        console.log('Strong password validation:', strongValidation.isValid ? '✅ Success' : '❌ Failed');
        console.log('Strong password errors:', strongValidation.errors);

        console.log('\n🎉 Authentication system testing completed!');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Run the test
testAuthentication();