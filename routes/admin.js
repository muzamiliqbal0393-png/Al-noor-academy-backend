const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

// ─────────────────────────────────────────────
// @route   GET /api/admin/dashboard
// @desc    Admin dashboard stats
// @access  Admin
// ─────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const [
            totalUsers, totalTeachers, totalStudents, totalParents,
            totalClasses, liveClasses, totalRevenue
        ] = await Promise.all([
            User.countDocuments({ isActive: true }),
            Teacher.countDocuments(),
            Student.countDocuments(),
            Parent.countDocuments(),
            Class.countDocuments({ status: 'completed' }),
            Class.countDocuments({ status: 'live' }),
            Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        // Today stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayClasses = await Class.countDocuments({
            scheduledAt: { $gte: today },
            status: { $in: ['scheduled', 'live'] }
        });

        // Monthly revenue
        const startOfMonth = new Date();
        startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
        const monthlyRevenue = await Payment.aggregate([
            { $match: { status: 'completed', paidAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Recent users
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('name email role avatar createdAt isActive');

        // Top teachers
        const topTeachers = await Teacher.find()
            .populate('user', 'name avatar')
            .sort({ 'rating.average': -1 })
            .limit(5);

        res.json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    totalTeachers,
                    totalStudents,
                    totalParents,
                    totalClasses,
                    liveClasses,
                    todayClasses,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    monthlyRevenue: monthlyRevenue[0]?.total || 0
                },
                recentUsers,
                topTeachers
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/admin/users
// @desc    Get all users (with filters)
// @access  Admin
// ─────────────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const { role, search, page = 1, limit = 20, isActive } = req.query;

        const query = {};
        if (role) query.role = role;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            data: users
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   PUT /api/admin/users/:id/toggle-active
// @desc    Activate/deactivate user
// @access  Admin
// ─────────────────────────────────────────────
router.put('/users/:id/toggle-active', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.isActive = !user.isActive;
        await user.save({ validateBeforeSave: false });

        res.json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
            isActive: user.isActive
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/admin/approve-teacher/:id
// @desc    Approve a teacher
// @access  Admin
// ─────────────────────────────────────────────
router.post('/approve-teacher/:id', async (req, res) => {
    try {
        const teacher = await Teacher.findByIdAndUpdate(
            req.params.id,
            { approvedByAdmin: true },
            { new: true }
        ).populate('user', 'name email');

        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }

        await Notification.create({
            recipient: teacher.user._id,
            title: '✅ Application Approved!',
            body: 'Congratulations! Your teacher application has been approved. You can now start teaching. Masha Allah!',
            type: 'announcement'
        });

        if (global.sendNotification) {
            global.sendNotification(teacher.user._id.toString(), {
                title: '✅ Application Approved!',
                body: 'Welcome to Al-Noor Academy teaching team! 🕌'
            });
        }

        res.json({ success: true, message: `${teacher.user.name} approved as teacher!`, data: teacher });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/admin/assign-teacher
// @desc    Assign teacher to student
// @access  Admin
// ─────────────────────────────────────────────
router.post('/assign-teacher', async (req, res) => {
    try {
        const { teacherId, studentId, courseId } = req.body;

        const teacher = await Teacher.findById(teacherId);
        const student = await Student.findById(studentId);

        if (!teacher || !student) {
            return res.status(404).json({ success: false, message: 'Teacher or student not found' });
        }

        // Add student to teacher
        if (!teacher.students.includes(studentId)) {
            teacher.students.push(studentId);
            await teacher.save();
        }

        // Update student enrollment
        const alreadyEnrolled = student.enrolledCourses.some(
            e => e.course.toString() === courseId
        );

        if (!alreadyEnrolled) {
            student.enrolledCourses.push({
                course: courseId,
                teacher: teacherId,
                enrolledAt: new Date()
            });
            await student.save();
        }

        // Notify teacher
        const teacherUser = await User.findById(teacher.user);
        const studentUser = await User.findById(student.user);

        await Notification.create({
            recipient: teacher.user,
            title: `👨‍🎓 New Student Assigned: ${studentUser.name}`,
            body: `${studentUser.name} has been assigned to your class. First class will be scheduled soon.`,
            type: 'new_student',
            relatedId: student._id
        });

        if (global.sendNotification) {
            global.sendNotification(teacher.user.toString(), {
                title: '👨‍🎓 New Student!',
                body: `${studentUser.name} has been assigned to you`
            });
        }

        res.json({ success: true, message: `${studentUser.name} assigned to ${teacherUser.name}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/admin/broadcast
// @desc    Send announcement to all users
// @access  Admin
// ─────────────────────────────────────────────
router.post('/broadcast', async (req, res) => {
    try {
        const { title, body, roles } = req.body;

        const query = roles?.length ? { role: { $in: roles } } : {};
        const users = await User.find({ ...query, isActive: true }).select('_id');

        const notifications = users.map(u => ({
            recipient: u._id,
            title,
            body,
            type: 'announcement'
        }));

        await Notification.insertMany(notifications);

        // Push to all online users
        if (global.sendNotification) {
            users.forEach(u => {
                global.sendNotification(u._id.toString(), { title, body, type: 'announcement' });
            });
        }

        res.json({
            success: true,
            message: `Announcement sent to ${users.length} users!`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;