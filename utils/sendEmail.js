const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendEmail = async ({ to, subject, html, text }) => {
    try {
        const info = await transporter.sendMail({
            from: `"Al-Noor Quran Academy 🕌" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: html || `<p>${text}</p>`,
            text
        });

        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error(`❌ Email failed to ${to}:`, err.message);
        // Don't throw — email failure shouldn't break the API
    }
};