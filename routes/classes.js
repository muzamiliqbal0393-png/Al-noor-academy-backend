const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

router.use(protect);

// ─────────────────────────────────────────────
// @route   POST /api/classes/create
// @desc    Schedule a new class
// @access  Teacher / Admin
// ─────────────────────────────────────────────
router.post('/create', authorize('teacher', 'admin'), async (req, res) => {
    try {
        const {
            title, courseId, studentIds, type,
            scheduledAt, duration, topic
        } = req.body;

        const teacher = await Teacher.findOne({ user: req.user._id });
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }

        // Build students array
        const students = studentIds.map(id => ({ student: id }));

        const newClass = await Class.create({
            title,
            course: courseId,
            teacher: teacher._id,
            students,
            type: type || 'one-on-one',
            scheduledAt: new Date(scheduledAt),
            duration: duration || 45,
            topic,
            status: 'scheduled'
        });

        // Notify all students & parents
        for (const studentId of studentIds) {
            const student = await Student.findById(studentId).populate('user').populate('parent');

            // Notify student
            await Notification.create({
                recipient: student.user._id,
                title: `Class Scheduled: ${title} 📅`,
                body: `Your ${topic} class is scheduled for ${new Date(scheduledAt).toLocaleString()}`,
                type: 'class_reminder',
                relatedId: newClass._id,
                relatedModel: 'Class'
            });

            // Notify parent
            if (student.parent) {
                const parentUser = await require('../models/User').findOne({
                    _id: { $in: [student.parent.user] }
                });

                if (parentUser) {
                    await Notification.create({
                        recipient: parentUser._id,
                        title: `Class Scheduled for ${student.user.name} 📅`,
                        body: `${title} — ${new Date(scheduledAt).toLocaleString()}`,
                        type: 'class_reminder',
                        relatedId: newClass._id,
                        relatedModel: 'Class'
                    });

                    // Email parent
                    await sendEmail({
                        to: parentUser.email,
                        subject: `Class Scheduled — ${title}`,
                        html: `
                            <h2>📅 Class Scheduled</h2>
                            <p>A class has been scheduled for <strong>${student.user.name}</strong>:</p>
                            <ul>
                                <li><strong>Title:</strong> ${title}</li>
                                <li><strong>Topic:</strong> ${topic}</li>
                                <li><strong>Date & Time:</strong> ${new Date(scheduledAt).toLocaleString()}</li>
                                <li><strong>Duration:</strong> ${duration} minutes</li>
                            </ul>
                            <a href="${process.env.CLIENT_URL}/join/${newClass.roomId}" style="background:#1a5c38;color:white;padding:10px 20px;border-radius:8px;text-decoration:none">Join Class</a>
                        `
                    });
                }
            }

            // Push notification
            if (global.sendNotification) {
                global.sendNotification(student.user._id.toString(), {
                    title: 'Class Scheduled! 📅',
                    body: `${title} — ${new Date(scheduledAt).toLocaleString()}`
                });
            }
        }

        await newClass.populate([
            { path: 'course', select: 'name category' },
            { path: 'students.student', populate: { path: 'user', select: 'name avatar' } }
        ]);

        res.status(201).json({
            success: true,
            message: 'Class scheduled! Students notified.',
            data: newClass
        });

    } catch (err) {
        console.error('Create Class Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/classes/:id/start
// @desc    Start a live class
// @access  Teacher
// ─────────────────────────────────────────────
router.post('/:id/start', authorize('teacher'), async (req, res) => {
    try {
        const classItem = await Class.findById(req.params.id)
            .populate('students.student', 'user')
            .populate('course', 'name');

        if (!classItem) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        classItem.status = 'live';
        classItem.startedAt = new Date();
        await classItem.save();

        // Notify all students
        for (const s of classItem.students) {
            const student = await Student.findById(s.student).populate('user');
            if (student) {
                await Notification.create({
                    recipient: student.user._id,
                    title: `🔴 Class is Starting Now!`,
                    body: `${classItem.title} — Join now!`,
                    type: 'class_started',
                    relatedId: classItem._id,
                    actionUrl: `/join/${classItem.roomId}`
                });

                if (global.sendNotification) {
                    global.sendNotification(student.user._id.toString(), {
                        title: '🔴 Class Starting Now!',
                        body: `${classItem.title} — Join!`,
                        type: 'class_started'
                    });
                }
            }
        }

        // Emit via Socket.IO
        const io = req.app.get('io');
        io.emit(`class_live_${classItem._id}`, {
            classId: classItem._id,
            roomId: classItem.roomId,
            startedAt: classItem.startedAt
        });

        res.json({
            success: true,
            message: 'Class started! Students notified.',
            data: classItem,
            joinUrl: `/join/${classItem.roomId}`
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/classes/:id/end
// @desc    End a live class
// @access  Teacher
// ─────────────────────────────────────────────
router.post('/:id/end', authorize('teacher'), async (req, res) => {
    try {
        const { teacherNotes, teacherRating, recordingUrl } = req.body;

        const classItem = await Class.findById(req.params.id)
            .populate('students.student');

        classItem.status = 'completed';
        classItem.endedAt = new Date();
        classItem.teacherNotes = teacherNotes;
        classItem.teacherRating = teacherRating;
        if (recordingUrl) classItem.recordingUrl = recordingUrl;

        await classItem.save();

        // Update teacher stats
        await Teacher.findByIdAndUpdate(classItem.teacher, {
            $inc: { 'stats.totalClasses': 1, 'earnings.thisMonth': 46, 'earnings.total': 46 }
        });

        // Mark attendance for present students
        for (const s of classItem.students) {
            if (s.attended) {
                await Attendance.findOneAndUpdate(
                    { class: classItem._id, student: s.student._id },
                    {
                        status: 'present',
                        joinedAt: s.joinedAt,
                        leftAt: s.leftAt,
                        duration: s.duration
                    },
                    { upsert: true, new: true }
                );

                // Give XP to student
                await Student.findByIdAndUpdate(s.student._id, {
                    $inc: { xpPoints: 50 }
                });
            }
        }

        // Notify parents with summary
        for (const s of classItem.students) {
            const student = await Student.findById(s.student._id).populate('user parent');
            if (student?.parent) {
                await Notification.create({
                    recipient: student.parent.user,
                    title: `✅ ${classItem.title} Completed`,
                    body: teacherNotes || `${student.user.name}'s class completed`,
                    type: 'class_completed',
                    relatedId: classItem._id
                });
            }
        }

        res.json({ success: true, message: 'Class ended. Reports sent.', data: classItem });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/classes/schedule
// @desc    Get user's class schedule
// @access  All
// ─────────────────────────────────────────────
router.get('/schedule', async (req, res) => {
    try {
        const { week, month } = req.query;
        let query = {};

        if (req.user.role === 'teacher') {
            const teacher = await Teacher.findOne({ user: req.user._id });
            query.teacher = teacher._id;
        } else if (req.user.role === 'student') {
            const student = await Student.findOne({ user: req.user._id });
            query['students.student'] = student._id;
        } else if (req.user.role === 'parent') {
            const Parent = require('../models/Parent');
            const parent = await Parent.findOne({ user: req.user._id });
            query['students.student'] = { $in: parent.children };
        }

        // Date filter
        if (week === 'current') {
            const start = new Date();
            start.setHours(0,0,0,0);
            start.setDate(start.getDate() - start.getDay());
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            query.scheduledAt = { $gte: start, $lte: end };
        }

        const classes = await Class.find(query)
            .populate('course', 'name category thumbnail')
            .populate('teacher', 'user rating')
            .populate('students.student', 'user level')
            .sort({ scheduledAt: 1 });

        res.json({ success: true, count: classes.length, data: classes });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/classes/join/:roomId
// @desc    Get class by room ID (to join)
// @access  All
// ─────────────────────────────────────────────
router.get('/join/:roomId', async (req, res) => {
    try {
        const classItem = await Class.findOne({ roomId: req.params.roomId })
            .populate('course', 'name category')
            .populate({
                path: 'teacher',
                populate: { path: 'user', select: 'name avatar' }
            })
            .populate({
                path: 'students.student',
                populate: { path: 'user', select: 'name avatar' }
            });

        if (!classItem) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        if (classItem.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Class was cancelled' });
        }

        res.json({ success: true, data: classItem });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/classes/live
// @desc    Fetch active live class for the user
// @access  Private
// ─────────────────────────────────────────────
router.get('/live', async (req, res) => {
    try {
        let liveClass = null;

        if (req.user.role === 'teacher') {
            const teacher = await Teacher.findOne({ user: req.user._id });
            if (teacher) {
                liveClass = await Class.findOne({ teacher: teacher._id, status: 'live' })
                    .populate('course', 'name')
                    .populate('students.student');
            }
        } else if (req.user.role === 'student') {
            const student = await Student.findOne({ user: req.user._id });
            if (student) {
                liveClass = await Class.findOne({ 'students.student': student._id, status: 'live' })
                    .populate('course', 'name')
                    .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });
            }
        } else if (req.user.role === 'parent') {
            const parent = await Parent.findOne({ user: req.user._id }).populate('children');
            if (parent && parent.children.length > 0) {
                const childIds = parent.children.map(c => c._id);
                liveClass = await Class.findOne({ 'students.student': { $in: childIds }, status: 'live' })
                    .populate('course', 'name')
                    .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });
            }
        }

        if (!liveClass) {
            return res.json({ success: true, message: 'No live class found', data: null });
        }

        res.json({ success: true, data: liveClass });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   PUT /api/classes/:id/start
// @desc    Start a class (Set to live)
// @access  Teacher
// ─────────────────────────────────────────────
router.put('/:id/start', authorize('teacher', 'admin'), async (req, res) => {
    try {
        const classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ success: false, message: 'Class not found' });
        
        // Jitsi Room ID generation
        if (!classItem.roomId) {
            classItem.roomId = `ALNOOR-${classItem._id}`;
        }

        classItem.status = 'live';
        classItem.startedAt = new Date();
        await classItem.save();

        res.json({ success: true, message: 'Class started successfully', data: classItem });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   PUT /api/classes/:id/end
// @desc    End a live class
// @access  Teacher
// ─────────────────────────────────────────────
router.put('/:id/end', authorize('teacher', 'admin'), async (req, res) => {
    try {
        const classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ success: false, message: 'Class not found' });

        classItem.status = 'completed';
        classItem.endedAt = new Date();
        await classItem.save();

        res.json({ success: true, message: 'Class ended successfully', data: classItem });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;