const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

router.use(protect);

// ─────────────────────────────────────────────
// @route   POST /api/attendance/mark
// @desc    Mark attendance for a class
// @access  Teacher
// ─────────────────────────────────────────────
router.post('/mark', authorize('teacher'), async (req, res) => {
    try {
        const { classId, records } = req.body;
        // records: [{ studentId, status, note }]

        const teacher = await Teacher.findOne({ user: req.user._id });
        const classItem = await Class.findById(classId).populate('course', 'name');

        if (!classItem) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        const results = [];

        for (const record of records) {
            const { studentId, status, note } = record;

            const att = await Attendance.findOneAndUpdate(
                { class: classId, student: studentId },
                {
                    teacher: teacher._id,
                    date: classItem.scheduledAt || new Date(),
                    status,
                    note,
                    markedBy: req.user._id,
                    parentNotified: false
                },
                { upsert: true, new: true }
            );

            results.push(att);

            // If absent, notify parent
            if (status === 'absent') {
                const student = await Student.findById(studentId).populate('user parent');

                if (student?.parent) {
                    const parentUser = await require('../models/User').findById(student.parent.user);

                    // Notification
                    await Notification.create({
                        recipient: parentUser._id,
                        title: `⚠️ ${student.user.name} was absent`,
                        body: `${student.user.name} did not attend the ${classItem.course?.name} class today.`,
                        type: 'attendance_marked',
                        relatedId: classItem._id
                    });

                    // Email
                    await sendEmail({
                        to: parentUser.email,
                        subject: `Attendance Alert — ${student.user.name} was absent`,
                        html: `
                            <h2>⚠️ Attendance Alert</h2>
                            <p><strong>${student.user.name}</strong> was marked <strong>absent</strong> for today's ${classItem.course?.name} class.</p>
                            <p>${note ? `Teacher's note: ${note}` : ''}</p>
                            <p>Please ensure your child attends the next scheduled class.</p>
                        `
                    });

                    if (global.sendNotification) {
                        global.sendNotification(parentUser._id.toString(), {
                            title: '⚠️ Attendance Alert',
                            body: `${student.user.name} was absent today`
                        });
                    }

                    att.parentNotified = true;
                    await att.save();
                }
            }

            // Check attendance rate & send warning if below 75%
            const total = await Attendance.countDocuments({ student: studentId, teacher: teacher._id });
            const present = await Attendance.countDocuments({ student: studentId, teacher: teacher._id, status: 'present' });
            const rate = total > 0 ? (present / total) * 100 : 0;

            if (rate < 75 && total >= 5) {
                const student = await Student.findById(studentId).populate('user parent');
                if (student?.parent) {
                    const parentUser = await require('../models/User').findById(student.parent.user);
                    if (parentUser) {
                        await Notification.create({
                            recipient: parentUser._id,
                            title: `❗ Low Attendance Warning`,
                            body: `${student.user.name}'s attendance rate dropped to ${rate.toFixed(0)}%. Please contact us.`,
                            type: 'attendance_warning'
                        });
                    }
                }
            }
        }

        res.json({
            success: true,
            message: `Attendance marked for ${records.length} student(s). Parents notified.`,
            data: results
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/attendance/student/:studentId
// @desc    Get attendance for a student
// @access  Teacher / Parent / Admin
// ─────────────────────────────────────────────
router.get('/student/:studentId', async (req, res) => {
    try {
        const { month, year } = req.query;

        let query = { student: req.params.studentId };

        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 1);
            query.date = { $gte: start, $lt: end };
        }

        const attendance = await Attendance.find(query)
            .populate('class', 'title scheduledAt course')
            .sort({ date: -1 });

        // Calculate stats
        const total = attendance.length;
        const present = attendance.filter(a => a.status === 'present').length;
        const absent = attendance.filter(a => a.status === 'absent').length;
        const late = attendance.filter(a => a.status === 'late').length;
        const rate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            data: attendance,
            stats: { total, present, absent, late, rate }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;