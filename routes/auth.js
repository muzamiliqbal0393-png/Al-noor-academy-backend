const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { sendEmail } = require('../utils/sendEmail');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for Avatar Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../uploads/avatars');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, `user-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Please upload an image file'), false);
        }
    }
});
// ===== VALIDATION RULES =====
const registerValidation = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and number'),
    body('role').isIn(['teacher', 'student', 'parent']).withMessage('Invalid role'),
];

const loginValidation = [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required')
];

// Helper
const sendValidationErrors = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
// ─────────────────────────────────────────────
router.post('/register', upload.single('degree'), registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role, phone, country } = req.body;

    try {
        // Check existing
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Create user
        const user = await User.create({ name, email, password, role, phone, country });

        // Create role-specific profile
        if (role === 'teacher') {
            const degreeUrl = req.file ? `/uploads/avatars/${req.file.filename}` : null;
            if (!degreeUrl) {
                 // The user requested degree upload is mandatory
                 await User.findByIdAndDelete(user._id); // rollback user creation
                 return res.status(400).json({ success: false, message: 'Degree/Certificate file is required for Teachers' });
            }
            await Teacher.create({
                user: user._id,
                specializations: req.body.specializations ? req.body.specializations.split(',') : [],
                experience: req.body.experience || 0,
                degreeFile: degreeUrl
            });
        } else if (role === 'student') {
            const student = await Student.create({
                user: user._id,
                age: req.body.age,
                gender: req.body.gender
            });

            // Link to parent if parentId provided
            if (req.body.parentId) {
                await Parent.findByIdAndUpdate(req.body.parentId, {
                    $push: { children: student._id }
                });
                student.parent = req.body.parentId;
                await student.save();
            }
        } else if (role === 'parent') {
            await Parent.create({
                user: user._id,
                subscriptionPlan: req.body.plan || 'single'
            });
        }

        // Welcome notification
        await Notification.create({
            recipient: user._id,
            title: 'Welcome to Al-Noor Academy! 🕌',
            body: 'Your account has been created successfully. Assalam Alaikum!',
            type: 'announcement'
        });

        // Welcome email
        await sendEmail({
            to: email,
            subject: 'Welcome to Al-Noor Quran Academy! 🕌',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                    <h2 style="color:#1a5c38">Assalam Alaikum, ${name}! 🤲</h2>
                    <p>Welcome to <strong>Al-Noor Quran Academy</strong>!</p>
                    <p>Your account has been created successfully as a <strong>${role}</strong>.</p>
                    <p>Please verify your email to get started.</p>
                    <a href="${process.env.CLIENT_URL}/verify" style="background:#1a5c38;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Verify Email</a>
                </div>
            `
        });

        const token = user.getSignedToken();

        res.status(201).json({
            success: true,
            message: 'Account created successfully! Check your email.',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        });

    } catch (err) {
        console.error('Register Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
// ─────────────────────────────────────────────
router.post('/login', loginValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Account deactivated. Contact admin.' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        const token = user.getSignedToken();

        // Get role-specific data
        let roleData = null;
        if (user.role === 'teacher') {
            roleData = await Teacher.findOne({ user: user._id });
        } else if (user.role === 'student') {
            roleData = await Student.findOne({ user: user._id }).populate('enrolledCourses.course', 'name category');
        } else if (user.role === 'parent') {
            roleData = await Parent.findOne({ user: user._id }).populate('children', 'user level xpPoints streak');
        }

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                phone: user.phone,
                country: user.country,
                lastLogin: user.lastLogin
            },
            profile: roleData
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
// ─────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        let profile = null;

        if (user.role === 'teacher') {
            profile = await Teacher.findOne({ user: user._id })
                .populate('students', 'user level')
                .populate('courses', 'name category');
        } else if (user.role === 'student') {
            profile = await Student.findOne({ user: user._id })
                .populate('enrolledCourses.course')
                .populate('parent');
        } else if (user.role === 'parent') {
            profile = await Parent.findOne({ user: user._id })
                .populate({
                    path: 'children',
                    populate: { path: 'user', select: 'name avatar' }
                });
        }

        res.json({ success: true, user, profile });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   PUT /api/auth/update-profile
// @desc    Update user profile
// @access  Private
// ─────────────────────────────────────────────
router.put('/update-profile', protect, async (req, res) => {
    try {
        const { name, phone, country, timezone, language, notifications } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name, phone, country, timezone, language, notifications },
            { new: true, runValidators: true }
        );

        res.json({ success: true, message: 'Profile updated', user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/auth/avatar
// @desc    Upload profile picture
// @access  Private
// ─────────────────────────────────────────────
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an image file' });
        }
        
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { avatar: avatarUrl },
            { new: true }
        );
        
        res.json({ success: true, message: 'Profile picture updated', avatar: avatarUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   DELETE /api/auth/avatar
// @desc    Remove profile picture
// @access  Private
// ─────────────────────────────────────────────
router.delete('/avatar', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user.avatar && user.avatar.startsWith('/uploads/avatars/')) {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, '../', user.avatar);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        user.avatar = null;
        await user.save();
        
        res.json({ success: true, message: 'Profile picture removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
// ─────────────────────────────────────────────
router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id).select('+password');
        const isMatch = await user.matchPassword(currentPassword);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        // Notify
        await sendEmail({
            to: user.email,
            subject: 'Password Changed — Al-Noor Academy',
            html: `<p>Your password was changed. If this wasn't you, contact us immediately.</p>`
        });

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
// ─────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with this email' });
        }

        const resetToken = user.getPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

        await sendEmail({
            to: user.email,
            subject: 'Password Reset — Al-Noor Academy',
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password (valid for 10 minutes):</p>
                <a href="${resetUrl}" style="background:#1a5c38;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Reset Password</a>
                <p>If you didn't request this, ignore this email.</p>
            `
        });

        res.json({ success: true, message: 'Password reset email sent!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/auth/logout
// @desc    Logout (client clears token)
// @access  Private
// ─────────────────────────────────────────────
router.post('/logout', protect, (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;