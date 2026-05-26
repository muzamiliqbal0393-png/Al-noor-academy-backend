const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Homework = require('../models/Homework');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');

// All routes require auth
router.use(protect);

// ─────────────────────────────────────────────
// @route   GET /api/teachers/dashboard
// @desc    Get teacher dashboard data
// @access  Teacher
// ─────────────────────────────────────────────
router.get('/dashboard', authorize('teacher', 'admin'), async (req, res) => {
    // Block teacher until admin verification
    const me = await Teacher.findOne({ user: req.user._id });
    if (me && me.approvedByAdmin !== true) {
        return res.status(403).json({ success:false, message:'Teacher verification pending' });
    }
    try {
        const teacher = await Teacher.findOne({ user: req.user._id })
            .populate('students', 'user level xpPoints streak stats')
            .populate('courses', 'name category');

        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }

        // Today's classes
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaysClasses = await Class.find({
            teacher: teacher._id,
            scheduledAt: { $gte: today, $lt: tomorrow }
        })
        .populate('students.student', 'user')
        .populate('course', 'name category')
        .sort({ scheduledAt: 1 });

        // Stats
        const totalClasses = await Class.countDocuments({
            teacher: teacher._id,
            status: 'completed'
        });

        const pendingHomework = await Homework.aggregate([
            { $match: { teacher: teacher._id } },
            { $unwind: '$assignments' },
            { $match: { 'assignments.status': 'submitted' } },
            { $count: 'total' }
        ]);

        const unreadMessages = await require('../models/Message').countDocuments({
            receiver: req.user._id,
            isRead: false
        });

        res.json({
            success: true,
            data: {
                teacher,
                todaysClasses,
                stats: {
                    totalStudents: teacher.students.length,
                    totalClasses,
                    pendingHomework: pendingHomework[0]?.total || 0,
                    unreadMessages,
                    rating: teacher.rating,
                    earnings: teacher.earnings
                }
            }
        });

    } catch (err) {
        console.error('Teacher Dashboard Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/teachers/students
// @desc    Get all students of teacher
// @access  Teacher
// ─────────────────────────────────────────────
router.get('/students', authorize('teacher', 'admin'), async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ user: req.user._id });

        const students = await Student.find({ _id: { $in: teacher.students } })
            .populate('user', 'name email avatar phone country')
            .populate('enrolledCourses.course', 'name category')
            .populate('parent');

        // Add attendance rates
        const studentsWithStats = await Promise.all(students.map(async (student) => {
            const attendanceCount = await Attendance.countDocuments({
                student: student._id,
                teacher: teacher._id,
                status: 'present'
            });
            const totalAttendance = await Attendance.countDocuments({
                student: student._id,
                teacher: teacher._id
            });

            return {
                ...student.toObject(),
                attendanceRate: totalAttendance > 0
                    ? Math.round((attendanceCount / totalAttendance) * 100)
                    : 0
            };
        }));

        res.json({ success: true, count: students.length, data: studentsWithStats });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   PUT /api/teachers/profile
// @desc    Update teacher profile
// @access  Teacher
// ─────────────────────────────────────────────
router.put('/profile', authorize('teacher'), async (req, res) => {
    try {
        const { specializations, experience, bio, languages, schedule } = req.body;

        const teacher = await Teacher.findOneAndUpdate(
            { user: req.user._id },
            { specializations, experience, bio, languages, schedule },
            { new: true, runValidators: true }
        ).populate('user', 'name email avatar');

        res.json({ success: true, message: 'Profile updated', data: teacher });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/teachers/rate/:teacherId
// @desc    Rate a teacher (parent only)
// @access  Parent
// ─────────────────────────────────────────────
router.post('/rate/:teacherId', authorize('parent'), async (req, res) => {
    try {
        const { rating, comment } = req.body;

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1-5' });
        }

        const teacher = await Teacher.findById(req.params.teacherId);
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }

        // Update rating
        teacher.rating.total += rating;
        teacher.rating.count += 1;
        teacher.rating.average = (teacher.rating.total / teacher.rating.count).toFixed(1);
        await teacher.save();

        // Notify teacher
        await Notification.create({
            recipient: teacher.user,
            title: 'New Rating Received! ⭐',
            body: `You received a ${rating}-star rating! ${comment || ''}`,
            type: 'rating'
        });

        if (global.sendNotification) {
            global.sendNotification(teacher.user.toString(), {
                title: 'New Rating! ⭐',
                body: `${rating}-star rating received`,
                type: 'rating'
            });
        }

        res.json({ success: true, message: 'Rating submitted!', newRating: teacher.rating.average });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/teachers/earnings
// @desc    Get teacher earnings
// @access  Teacher
// ─────────────────────────────────────────────
router.get('/earnings', authorize('teacher'), async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ user: req.user._id });

        // Classes this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const classesThisMonth = await Class.find({
            teacher: teacher._id,
            status: 'completed',
            endedAt: { $gte: startOfMonth }
        }).countDocuments();

        const monthlyEarnings = classesThisMonth * teacher.earnings.ratePerClass;

        // Monthly breakdown (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyBreakdown = await Class.aggregate([
            {
                $match: {
                    teacher: teacher._id,
                    status: 'completed',
                    endedAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$endedAt' },
                        month: { $month: '$endedAt' }
                    },
                    classes: { $sum: 1 },
                    earnings: { $sum: teacher.earnings.ratePerClass }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                currentMonth: { classes: classesThisMonth, earnings: monthlyEarnings },
                totalEarnings: teacher.earnings.total,
                ratePerClass: teacher.earnings.ratePerClass,
                monthlyBreakdown
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;