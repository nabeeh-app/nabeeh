/**
 * Email templates — Elicit Design System
 *
 * Colors (from globals.css):
 *   ink:      #083d44   (text)
 *   primary:  #026370   (buttons, header)
 *   accent:   #e5ff97   (highlights)
 *   canvas:   #fcfcf8   (body bg)
 *   sage:     #f3f6e4   (card bg)
 *   cool:     #e8eced   (muted bg)
 */

const COLORS = {
    ink: '#083d44',
    inkDeep: '#09272b',
    primary: '#026370',
    accent: '#e5ff97',
    canvas: '#fcfcf8',
    sage: '#f3f6e4',
    cool: '#e8eced',
    white: '#ffffff',
};

const FONTS = {
    en: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
    ar: "'Segoe UI', Tahoma, 'Arial', sans-serif",
};

/**
 * Shared HTML wrapper for all emails.
 */
function wrap({ dir, lang, title, content }) {
    const isRtl = dir === 'rtl';
    const font = FONTS[lang] || FONTS.en;
    const textAlign = isRtl ? 'right' : 'left';

    return `
<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.canvas};font-family:${font};color:${COLORS.ink};line-height:1.6;direction:${dir};text-align:${textAlign};">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.canvas};padding:20px 0;direction:${dir};">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;direction:${dir};">
                    <!-- Header -->
                    <tr>
                        <td style="background-color:${COLORS.primary};padding:24px 32px;text-align:center;font-family:${font};">
                            <span style="font-size:28px;font-weight:bold;color:${COLORS.accent};letter-spacing:0.5px;">${isRtl ? 'نبيه' : 'Nabeeh'}</span>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="background-color:${COLORS.white};padding:32px;border:1px solid ${COLORS.cool};border-top:none;text-align:${textAlign};direction:${dir};font-family:${font};">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color:${COLORS.sage};padding:20px 32px;text-align:center;border:1px solid ${COLORS.cool};border-top:none;font-family:${font};">
                            <p style="margin:0;font-size:13px;color:${COLORS.ink};opacity:0.6;">
                                &copy; 2025 ${isRtl ? 'نبيه — المساعد الذكي للتدريس' : 'Nabeeh — Smart Teaching Assistant'}
                            </p>
                            <p style="margin:4px 0 0;font-size:12px;color:${COLORS.ink};opacity:0.4;">
                                ${isRtl ? 'هذه رسالة تلقائية، يرجى عدم الرد عليها.' : 'This is an automated message, please do not reply.'}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Password reset email template
 */
function getPasswordResetTemplate({ name, resetLink, language = 'en' }) {
    const isAr = language === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const align = isAr ? 'right' : 'left';
    const padSide = isAr ? 'padding-right' : 'padding-left';
    const font = FONTS[language] || FONTS.en;

    return {
        subject: isAr ? 'إعادة تعيين كلمة مرور نبيه' : 'Reset Your Nabeeh Password',
        html: wrap({
            dir,
            lang: language,
            title: isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Your Password',
            content: `
                <h2 style="margin:0 0 16px;font-size:22px;color:${COLORS.ink};font-family:${font};text-align:${align};">
                    ${isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Your Password'}
                </h2>
                <p style="margin:0 0 12px;color:${COLORS.ink};font-family:${font};text-align:${align};">
                    ${isAr ? `مرحباً ${name}،` : `Hello ${name},`}
                </p>
                <p style="margin:0 0 20px;color:${COLORS.ink};opacity:0.8;font-family:${font};text-align:${align};">
                    ${isAr
                        ? 'تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في نبيه. إذا كنت قد قمت بهذا الطلب، اضغط على الزر أدناه:'
                        : 'We received a request to reset your Nabeeh account password. If you made this request, click the button below:'}
                </p>

                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="${align}" style="padding:0 0 24px;">
                            <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background-color:${COLORS.primary};color:${COLORS.white};text-decoration:none;font-weight:bold;font-size:15px;border-radius:0;font-family:${font};">
                                ${isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
                            </a>
                        </td>
                    </tr>
                </table>

                <div style="background-color:${COLORS.sage};border-${isAr ? 'right' : 'left'}:3px solid ${COLORS.primary};padding:16px;margin:0 0 20px;text-align:${align};">
                    <p style="margin:0;font-weight:bold;color:${COLORS.ink};font-family:${font};">
                        ${isAr ? 'ملاحظة أمنية:' : 'Security note:'}
                    </p>
                    <ul style="margin:8px 0 0;${padSide}:18px;color:${COLORS.ink};opacity:0.8;font-family:${font};">
                        <li>${isAr ? 'ستنتهي صلاحية هذا الرابط خلال ساعة واحدة' : 'This link expires in 1 hour'}</li>
                        <li>${isAr ? 'إذا لم تطلب إعادة التعيين، تجاهل هذا البريد' : "If you didn't request this, ignore this email"}</li>
                    </ul>
                </div>

                <p style="margin:0 0 8px;font-size:13px;color:${COLORS.ink};opacity:0.6;font-family:${font};text-align:${align};">
                    ${isAr ? 'أو انسخ هذا الرابط إلى متصفحك:' : 'Or paste this link into your browser:'}
                </p>
                <p style="margin:0 0 24px;word-break:break-all;font-size:12px;background-color:${COLORS.cool};padding:10px;border-radius:0;color:${COLORS.ink};opacity:0.7;font-family:${font};text-align:${align};">
                    ${resetLink}
                </p>

                <p style="margin:0;color:${COLORS.ink};opacity:0.7;font-family:${font};text-align:${align};">
                    ${isAr ? 'مع أطيب التحيات،<br>مصطفى — مؤسس نبيه' : 'Best regards,<br>Mustafa — Founder of Nabeeh'}
                </p>
            `,
        }),
    };
}

/**
 * Welcome email template
 */
function getWelcomeTemplate({ name, loginLink, language = 'en' }) {
    const isAr = language === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const align = isAr ? 'right' : 'left';
    const padSide = isAr ? 'padding-right' : 'padding-left';
    const font = FONTS[language] || FONTS.en;

    return {
        subject: isAr ? 'مرحباً بك في نبيه!' : 'Welcome to Nabeeh!',
        html: wrap({
            dir,
            lang: language,
            title: isAr ? 'مرحباً بك في نبيه' : 'Welcome to Nabeeh',
            content: `
                <h2 style="margin:0 0 16px;font-size:22px;color:${COLORS.ink};font-family:${font};text-align:${align};">
                    ${isAr ? `أهلاً ${name}،` : `Hey ${name},`}
                </h2>
                <p style="margin:0 0 12px;color:${COLORS.ink};opacity:0.8;font-family:${font};text-align:${align};">
                    ${isAr
                        ? 'أنا مصطفى — مؤسس نبيه. بنينا نبيه لأننا عايزين طريقة أسهل للمعلمين يسيروا طلابهم وحضورهم ودرجاتهم — كلهم في مكان واحد.'
                        : "I'm Mustafa — founder of Nabeeh. We built this because we wanted a better way for teachers to manage students, attendance, and grades — all in one place."}
                </p>
                <p style="margin:0 0 12px;color:${COLORS.ink};opacity:0.8;font-family:${font};text-align:${align};">
                    ${isAr ? 'إليك 3 نصائح للبدء:' : 'Here are 3 tips to get started:'}
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                        <td style="padding:12px 16px;background-color:${COLORS.sage};text-align:${align};">
                            <strong style="color:${COLORS.primary};font-family:${font};">${isAr ? '١.' : '1.'}</strong>
                            <span style="color:${COLORS.ink};font-family:${font};">
                                ${isAr
                                    ? '<strong>أضف أول طالب</strong> — روح لصفحة الطلاب وأضف ملف شخصي'
                                    : '<strong>Add your first student</strong> — go to Students and create a profile'}
                            </span>
                        </td>
                    </tr>
                    <tr><td style="height:8px;"></td></tr>
                    <tr>
                        <td style="padding:12px 16px;background-color:${COLORS.sage};text-align:${align};">
                            <strong style="color:${COLORS.primary};font-family:${font};">${isAr ? '٢.' : '2.'}</strong>
                            <span style="color:${COLORS.ink};font-family:${font};">
                                ${isAr
                                    ? '<strong>أنشئ دورة</strong> — حضّر العروض والمجموعات بتاعتك'
                                    : '<strong>Create a course</strong> — set up your offerings and groups'}
                            </span>
                        </td>
                    </tr>
                    <tr><td style="height:8px;"></td></tr>
                    <tr>
                        <td style="padding:12px 16px;background-color:${COLORS.sage};text-align:${align};">
                            <strong style="color:${COLORS.primary};font-family:${font};">${isAr ? '٣.' : '3.'}</strong>
                            <span style="color:${COLORS.ink};font-family:${font};">
                                ${isAr
                                    ? '<strong>جرّب بوت واتساب</strong> — خلي أولياء الأمور يسألوا عن الدرجات تلقائياً'
                                    : '<strong>Try the WhatsApp bot</strong> — let parents ask about grades automatically'}
                            </span>
                        </td>
                    </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="${align}" style="padding:0 0 24px;">
                            <a href="${loginLink}" style="display:inline-block;padding:12px 28px;background-color:${COLORS.primary};color:${COLORS.white};text-decoration:none;font-weight:bold;font-size:15px;border-radius:0;font-family:${font};">
                                ${isAr ? 'افتح نبيه' : 'Open Nabeeh'}
                            </a>
                        </td>
                    </tr>
                </table>

                <p style="margin:0 0 20px;color:${COLORS.ink};opacity:0.8;font-family:${font};text-align:${align};">
                    ${isAr
                        ? 'رد عليا وقولي إيه اللي جابك هنا — أنا بقرأ كل إيميل.'
                        : 'Hit "Reply" and let me know what brought you here — I read every email.'}
                </p>

                <p style="margin:0;color:${COLORS.ink};opacity:0.7;font-family:${font};text-align:${align};">
                    ${isAr ? 'مع تحياتي،<br>مصطفى' : 'Cheers,<br>Mustafa'}
                </p>
            `,
        }),
    };
}

/**
 * Assistant invite email template
 */
function getAssistantInviteTemplate({ teacherName, inviteLink, language = 'en' }) {
    const isAr = language === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const align = isAr ? 'right' : 'left';
    const padSide = isAr ? 'padding-right' : 'padding-left';
    const font = FONTS[language] || FONTS.en;

    return {
        subject: isAr
            ? `${teacherName} دعاك للانضمام إلى نبيه كمساعد تعليمي`
            : `${teacherName} invited you to join Nabeeh as an Assistant`,
        html: wrap({
            dir,
            lang: language,
            title: isAr ? 'دعوة للانضمام كمساعد' : 'Assistant Invitation',
            content: `
                <h2 style="margin:0 0 16px;font-size:22px;color:${COLORS.ink};font-family:${font};text-align:${align};">
                    ${isAr ? 'لقد تمت دعوتك!' : "You've Been Invited!"}
                </h2>
                <p style="margin:0 0 12px;color:${COLORS.ink};opacity:0.8;font-family:${font};text-align:${align};">
                    ${isAr
                        ? `<strong>${teacherName}</strong> دعاك للانضمام إلى فريقهم على نبيه كمساعد تعليمي.`
                        : `<strong>${teacherName}</strong> has invited you to join their team on Nabeeh as a teaching assistant.`}
                </p>
                <p style="margin:0 0 20px;color:${COLORS.ink};opacity:0.8;font-family:${font};text-align:${align};">
                    ${isAr
                        ? 'بصفتك مساعداً، ستتمكن من المساعدة في إدارة الطلاب والحضور والدرجات والتواصل مع أولياء الأمور.'
                        : "As an assistant, you'll be able to help manage students, attendance, grades, and communicate with parents."}
                </p>

                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="${align}" style="padding:0 0 24px;">
                            <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;background-color:${COLORS.accent};color:${COLORS.ink};text-decoration:none;font-weight:bold;font-size:15px;border-radius:0;font-family:${font};">
                                ${isAr ? 'قبول الدعوة' : 'Accept Invitation'}
                            </a>
                        </td>
                    </tr>
                </table>

                <div style="background-color:${COLORS.sage};border-${isAr ? 'right' : 'left'}:3px solid ${COLORS.primary};padding:16px;margin:0 0 20px;text-align:${align};">
                    <p style="margin:0;font-weight:bold;color:${COLORS.ink};font-family:${font};">
                        ${isAr ? 'ملاحظة:' : 'Note:'}
                    </p>
                    <ul style="margin:8px 0 0;${padSide}:18px;color:${COLORS.ink};opacity:0.8;font-family:${font};">
                        <li>${isAr ? 'هذه الدعوة تنتهي صلاحيتها خلال 48 ساعة' : 'This invitation expires in 48 hours'}</li>
                        <li>${isAr ? 'ستحتاج لإنشاء حساب أو تسجيل الدخول للقبول' : "You'll need to create an account or log in to accept"}</li>
                        <li>${isAr ? 'إذا لم تكن متوقعاً هذه الدعوة، يمكنك تجاهلها بأمان' : "If you weren't expecting this, you can safely ignore it"}</li>
                    </ul>
                </div>

                <p style="margin:0 0 8px;font-size:13px;color:${COLORS.ink};opacity:0.6;font-family:${font};text-align:${align};">
                    ${isAr ? 'أو انسخ هذا الرابط إلى متصفحك:' : 'Or paste this link into your browser:'}
                </p>
                <p style="margin:0 0 24px;word-break:break-all;font-size:12px;background-color:${COLORS.cool};padding:10px;border-radius:0;color:${COLORS.ink};opacity:0.7;font-family:${font};text-align:${align};">
                    ${inviteLink}
                </p>

                <p style="margin:0;color:${COLORS.ink};opacity:0.7;font-family:${font};text-align:${align};">
                    ${isAr ? 'مع أطيب التحيات،<br>فريق نبيه' : 'Best regards,<br>The Nabeeh Team'}
                </p>
            `,
        }),
    };
}

module.exports = {
    getPasswordResetTemplate,
    getWelcomeTemplate,
    getAssistantInviteTemplate,
};
