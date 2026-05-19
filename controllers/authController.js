const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Notification = require('../models/Notification');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
    const token = user.getSignedJwtToken();
    user.password = undefined;
    res.status(statusCode).json({
        success: true,
        message,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
            preferences: user.preferences
        }
    });
};

exports.register = async (req, res, next) => {
    try {
        const { name, email, password, phone, role, specialization, qualification, experience } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const user = await User.create({ name, email, password, phone, role: role || 'parent' });

        if (role === 'teacher') {
            await Teacher.create({
                user: user._id,
                specialization: specialization || [],
                qualification,
                experience: experience || 0
            });
        }

        // Welcome notification
        await Notification.create({
            user: user._id,
            title: '🕌 Welcome to Al-Noor Quran Academy!',
            message: `Assalamu Alaikum ${name}! Your account has been created successfully.`,
            type: 'announcement'
        });

        const verifyToken = user.getEmailVerifyToken();
        await user.save({ validateBeforeSave: false });

        const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email.html?token=${verifyToken}`;

        try {
            await sendEmail({
                email: user.email,
                subject: '🕌 Al-Noor Quran Academy - Verify Your Email',
                html: `
                    <div style="font-family:Arial;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
                        <div style="background:linear-gradient(135deg,#1a5c38,#2d8653);padding:40px;text-align:center;color:white">
                            <h1 style="margin:0">🕌 Al-Noor Quran Academy</h1>
                            <p style="font-family:serif;font-size:18px;margin-top:10px">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</p>
                        </div>
                        <div style="padding:40px">
                            <h2 style="color:#1a5c38">Assalamu Alaikum, ${name}!</h2>
                            <p>Welcome to Al-Noor Quran Academy. Please verify your email:</p>
                            <a href="${verifyUrl}" style="display:inline-block;background:#1a5c38;color:white;padding:15px 35px;border-radius:10px;text-decoration:none;font-weight:bold;margin:20px 0">✅ Verify Email</a>
                            <p style="color:#999;font-size:12px">Link expires in 24 hours.</p>
                        </div>
                        <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999">
                            © 2025 Al-Noor Quran Academy | جَزَاكَ اللَّهُ خَيْرًا
                        </div>
                    </div>
                `
            });
        } catch (e) {
            console.log('Email failed:', e.message);
        }

        sendTokenResponse(user, 201, res, 'Registration successful! Please verify your email.');
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email }).select('+password');

        if (!user || !await user.matchPassword(password)) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account deactivated. Contact support.' });
        }

        user.lastLogin = Date.now();
        await user.save({ validateBeforeSave: false });

        sendTokenResponse(user, 200, res, 'Login successful');
    } catch (error) {
        next(error);
    }
};

exports.logout = (req, res) => {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};

exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const { name, phone, address, preferences } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, phone, address, preferences },
            { new: true, runValidators: true }
        );
        res.status(200).json({ success: true, message: 'Profile updated', data: user });
    } catch (error) {
        next(error);
    }
};

exports.forgotPassword = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with that email' });
        }

        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

        await sendEmail({
            email: user.email,
            subject: '🔐 Al-Noor Quran Academy - Password Reset',
            html: `
                <div style="font-family:Arial;max-width:600px;margin:0 auto">
                    <div style="background:#c53030;padding:40px;text-align:center;color:white;border-radius:16px 16px 0 0">
                        <h1>🔐 Password Reset</h1>
                    </div>
                    <div style="padding:40px;background:white">
                        <h2>Hi ${user.name},</h2>
                        <p>Click below to reset your password (expires in 10 minutes):</p>
                        <a href="${resetUrl}" style="display:inline-block;background:#c53030;color:white;padding:15px 35px;border-radius:10px;text-decoration:none;font-weight:bold">🔑 Reset Password</a>
                    </div>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Password reset email sent' });
    } catch (error) {
        next(error);
    }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        sendTokenResponse(user, 200, res, 'Password reset successful');
    } catch (error) {
        next(error);
    }
};

exports.verifyEmail = async (req, res, next) => {
    try {
        const emailVerifyToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            emailVerifyToken,
            emailVerifyExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        user.isEmailVerified = true;
        user.emailVerifyToken = undefined;
        user.emailVerifyExpire = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Email verified successfully!' });
    } catch (error) {
        next(error);
    }
};

exports.updatePassword = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('+password');
        if (!await user.matchPassword(req.body.currentPassword)) {
            return res.status(400).json({ success: false, message: 'Current password incorrect' });
        }
        user.password = req.body.newPassword;
        await user.save();
        sendTokenResponse(user, 200, res, 'Password updated');
    } catch (error) {
        next(error);
    }
};