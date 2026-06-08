/**
 * Email templates for authentication system
 * Supports both Arabic and English languages
 */

/**
 * Password reset email template
 * @param {Object} options - Template options
 * @param {string} options.name - User's name
 * @param {string} options.resetLink - Password reset link
 * @param {string} options.language - Language ('ar' or 'en')
 * @returns {Object} - Email template with subject and html
 */
function getPasswordResetTemplate({ name, resetLink, language = 'en' }) {
    const templates = {
        en: {
            subject: 'Reset Your Nabeeh Password',
            html: `
                <!DOCTYPE html>
                <html lang="en" dir="ltr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Reset Your Password</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px 20px; background-color: #f9fafb; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
                        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 Nabeeh - Smart Teaching Assistant</h1>
                        </div>
                        <div class="content">
                            <h2>Reset Your Password</h2>
                            <p>Hello ${name},</p>
                            <p>We received a request to reset your password for your Nabeeh account. If you made this request, click the button below to reset your password:</p>
                            
                            <div style="text-align: center;">
                                <a href="${resetLink}" class="button">Reset My Password</a>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important Security Information:</strong>
                                <ul>
                                    <li>This link will expire in 1 hour for your security</li>
                                    <li>If you didn't request this reset, please ignore this email</li>
                                    <li>Never share this link with anyone</li>
                                </ul>
                            </div>
                            
                            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">
                                ${resetLink}
                            </p>
                            
                            <p>If you have any questions or need help, please contact our support team.</p>
                            
                            <p>Best regards,<br>The Nabeeh Team</p>
                        </div>
                        <div class="footer">
                            <p>© 2025 Nabeeh - Smart Teaching Assistant. All rights reserved.</p>
                            <p>This is an automated message, please do not reply to this email.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        },
        ar: {
            subject: 'إعادة تعيين كلمة مرور نبيه',
            html: `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>إعادة تعيين كلمة المرور</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.6; color: #333; direction: rtl; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px 20px; background-color: #f9fafb; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
                        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 نبيه - المساعد الذكي للتدريس</h1>
                        </div>
                        <div class="content">
                            <h2>إعادة تعيين كلمة المرور</h2>
                            <p>مرحباً ${name}،</p>
                            <p>تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في نبيه. إذا كنت قد قمت بهذا الطلب، انقر على الزر أدناه لإعادة تعيين كلمة المرور:</p>
                            
                            <div style="text-align: center;">
                                <a href="${resetLink}" class="button">إعادة تعيين كلمة المرور</a>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ معلومات أمنية مهمة:</strong>
                                <ul>
                                    <li>ستنتهي صلاحية هذا الرابط خلال ساعة واحدة لأمانك</li>
                                    <li>إذا لم تطلب إعادة التعيين، يرجى تجاهل هذا البريد الإلكتروني</li>
                                    <li>لا تشارك هذا الرابط مع أي شخص</li>
                                </ul>
                            </div>
                            
                            <p>إذا لم يعمل الزر، يمكنك نسخ ولصق هذا الرابط في متصفحك:</p>
                            <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">
                                ${resetLink}
                            </p>
                            
                            <p>إذا كان لديك أي أسئلة أو تحتاج إلى مساعدة، يرجى الاتصال بفريق الدعم لدينا.</p>
                            
                            <p>مع أطيب التحيات،<br>فريق نبيه</p>
                        </div>
                        <div class="footer">
                            <p>© 2025 نبيه - المساعد الذكي للتدريس. جميع الحقوق محفوظة.</p>
                            <p>هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        }
    };

    return templates[language] || templates.en;
}

/**
 * Welcome email template for new users
 * @param {Object} options - Template options
 * @param {string} options.name - User's name
 * @param {string} options.loginLink - Login page link
 * @param {string} options.language - Language ('ar' or 'en')
 * @returns {Object} - Email template with subject and html
 */
function getWelcomeTemplate({ name, loginLink, language = 'en' }) {
    const templates = {
        en: {
            subject: 'Welcome to Nabeeh - Your Smart Teaching Assistant',
            html: `
                <!DOCTYPE html>
                <html lang="en" dir="ltr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to Nabeeh</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px 20px; background-color: #f9fafb; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
                        .features { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 Welcome to Nabeeh!</h1>
                        </div>
                        <div class="content">
                            <h2>Hello ${name}!</h2>
                            <p>Welcome to Nabeeh, your smart teaching assistant! We're excited to help you streamline your teaching workflow and enhance your students' learning experience.</p>
                            
                            <div style="text-align: center;">
                                <a href="${loginLink}" class="button">Start Teaching with Nabeeh</a>
                            </div>
                            
                            <div class="features">
                                <h3>🚀 What you can do with Nabeeh:</h3>
                                <ul>
                                    <li>📊 Track student attendance and performance</li>
                                    <li>📝 Manage grades and assessments</li>
                                    <li>💬 Communicate with parents via WhatsApp</li>
                                    <li>📈 Generate detailed progress reports</li>
                                    <li>🤖 Get AI-powered teaching insights</li>
                                </ul>
                            </div>
                            
                            <p>If you have any questions or need help getting started, our support team is here to assist you.</p>
                            
                            <p>Happy teaching!<br>The Nabeeh Team</p>
                        </div>
                        <div class="footer">
                            <p>© 2025 Nabeeh - Smart Teaching Assistant. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        },
        ar: {
            subject: 'مرحباً بك في نبيه - مساعدك الذكي للتدريس',
            html: `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>مرحباً بك في نبيه</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.6; color: #333; direction: rtl; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px 20px; background-color: #f9fafb; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
                        .features { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 مرحباً بك في نبيه!</h1>
                        </div>
                        <div class="content">
                            <h2>مرحباً ${name}!</h2>
                            <p>مرحباً بك في نبيه، مساعدك الذكي للتدريس! نحن متحمسون لمساعدتك في تبسيط سير عملك التعليمي وتعزيز تجربة التعلم لطلابك.</p>
                            
                            <div style="text-align: center;">
                                <a href="${loginLink}" class="button">ابدأ التدريس مع نبيه</a>
                            </div>
                            
                            <div class="features">
                                <h3>🚀 ما يمكنك فعله مع نبيه:</h3>
                                <ul>
                                    <li>📊 تتبع حضور الطلاب وأدائهم</li>
                                    <li>📝 إدارة الدرجات والتقييمات</li>
                                    <li>💬 التواصل مع أولياء الأمور عبر واتساب</li>
                                    <li>📈 إنشاء تقارير تقدم مفصلة</li>
                                    <li>🤖 الحصول على رؤى تعليمية مدعومة بالذكاء الاصطناعي</li>
                                </ul>
                            </div>
                            
                            <p>إذا كان لديك أي أسئلة أو تحتاج إلى مساعدة للبدء، فريق الدعم لدينا هنا لمساعدتك.</p>
                            
                            <p>تدريس سعيد!<br>فريق نبيه</p>
                        </div>
                        <div class="footer">
                            <p>© 2025 نبيه - المساعد الذكي للتدريس. جميع الحقوق محفوظة.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        }
    };

    return templates[language] || templates.en;
}

module.exports = {
    getPasswordResetTemplate,
    getWelcomeTemplate
};