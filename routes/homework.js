const express = require('express');
const router = express.Router();
const Homework = require('../models/Homework');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

router.use(protect);

// ─────────────────────────────────────────────
// @route   POST /api/homework/assign
// @desc    Assign homework to students
// @access  Teacher
// ─────────────────────────────────────────────
router.post('/assign', authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { title, description, instructions, courseId, classId, type, dueDate, studentIds } = req.body;

        const teacher = await Teacher.findOne({ user: req.user._id });

        // Build assignments
        const assignments = studentIds.map(studentId => ({
            student: studentId,
            status: 'pending'
        }));

        const homework = await Homework.create({
            title,
            description,
            instructions,
            course: courseId,
            teacher: teacher._id,
            class: classId,
            type: type || 'audio',
            dueDate: new Date(dueDate),
            assignments
        });

        // Notify each student & parent
        for (const studentId of studentIds) {
            const student = await Student.findById(studentId).populate('user parent');

            // Notify student
            await Notification.create({
                recipient: student.user._id,
                title: `📝 New Homework: ${title}`,
                body: `Due: ${new Date(dueDate).toLocaleDateString()} — ${type} assignment`,
                type: 'homework_assigned',
                relatedId: homework._id
            });

            if (global.sendNotification) {
                global.sendNotification(student.user._id.toString(), {
                    title: '📝 New Homework Assigned!',
                    body: `${title} — Due ${new Date(dueDate).toLocaleDateString()}`
                });
            }

            // Notify parent
            if (student.parent) {
                const parentUser = await require('../models/User').findById(student.parent.user);
                if (parentUser) {
                    await Notification.create({
                        recipient: parentUser._id,
                        title: `📝 Homework Assigned to ${student.user.name}`,
                        body: `${title} — Due ${new Date(dueDate).toLocaleDateString()}`,
                        type: 'homework_assigned'
                    });

                    await sendEmail({
                        to: parentUser.email,
                        subject: `Homework Assigned — ${title}`,
                        html: `
                            <h2>📝 New Homework for ${student.user.name}</h2>
                            <p><strong>${title}</strong></p>
                            <p>${description || ''}</p>
                            <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
                            <p><strong>Type:</strong> ${type}</p>
                        `
                    });
                }
            }
        }

        res.status(201).json({
            success: true,
            message: `Homework assigned to ${studentIds.length} student(s)!`,
            data: homework
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/homework/:id/submit
// @desc    Submit homework (student)
// @access  Student
// ─────────────────────────────────────────────
router.post('/:id/submit', authorize('student'), async (req, res) => {
    try {
        const { text, fileUrl, audioUrl, videoUrl } = req.body;
        const student = await Student.findOne({ user: req.user._id });

        const homework = await Homework.findById(req.params.id);
        if (!homework) {
            return res.status(404).json({ success: false, message: 'Homework not found' });
        }

        // Find this student's assignment
        const assignment = homework.assignments.find(
            a => a.student.toString() === student._id.toString()
        );

        if (!assignment) {
            return res.status(400).json({ success: false, message: 'This homework was not assigned to you' });
        }

        if (assignment.status === 'graded') {
            return res.status(400).json({ success: false, message: 'Already graded' });
        }

        const isLate = new Date() > new Date(homework.dueDate);

        assignment.status = isLate ? 'late' : 'submitted';
        assignment.submittedAt = new Date();
        assignment.submission = { text, fileUrl, audioUrl, videoUrl };

        await homework.save();

        // Update student stats
        await Student.findByIdAndUpdate(student._id, {
            $inc: { 'stats.homeworkSubmitted': 1 }
        });

        // Notify teacher
        const teacher = await Teacher.findById(homework.teacher).populate('user');
        await Notification.create({
            recipient: teacher.user._id,
            title: `📬 Homework Submitted`,
            body: `${req.user.name} submitted "${homework.title}"${isLate ? ' (LATE)' : ''}`,
            type: 'homework_submitted',
            relatedId: homework._id
        });

        if (global.sendNotification) {
            global.sendNotification(teacher.user._id.toString(), {
                title: '📬 New Submission!',
                body: `${req.user.name} submitted ${homework.title}`
            });
        }

        res.json({
            success: true,
            message: isLate ? 'Submitted (late). Teacher notified.' : 'Homework submitted successfully!',
            data: assignment
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   PUT /api/homework/:id/grade/:studentId
// @desc    Grade a student's homework
// @access  Teacher
// ─────────────────────────────────────────────
router.put('/:id/grade/:studentId', authorize('teacher'), async (req, res) => {
    try {
        const { score, feedback } = req.body;

        const homework = await Homework.findById(req.params.id);
        if (!homework) {
            return res.status(404).json({ success: false, message: 'Homework not found' });
        }

        const assignment = homework.assignments.find(
            a => a.student.toString() === req.params.studentId
        );

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Student assignment not found' });
        }

        assignment.status = 'graded';
        assignment.grade = {
            score,
            feedback,
            gradedAt: new Date(),
            gradedBy: req.user._id
        };

        await homework.save();

        // Give XP based on score
        const xpEarned = Math.round(score / 2);
        await Student.findByIdAndUpdate(req.params.studentId, {
            $inc: { xpPoints: xpEarned }
        });

        // Notify student
        const student = await Student.findById(req.params.studentId).populate('user parent');
        await Notification.create({
            recipient: student.user._id,
            title: `✅ Homework Graded: ${score}/${homework.maxScore}`,
            body: feedback || `Your homework "${homework.title}" has been graded!`,
            type: 'homework_graded',
            relatedId: homework._id
        });

        // Notify parent
        if (student.parent) {
            await Notification.create({
                recipient: student.parent.user,
                title: `📊 ${student.user.name}'s Homework Graded`,
                body: `"${homework.title}" — Score: ${score}/${homework.maxScore}`,
                type: 'homework_graded'
            });
        }

        res.json({
            success: true,
            message: 'Homework graded! Student notified.',
            data: { score, feedback, xpEarned }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/homework/my
// @desc    Get homework for current user
// @access  All
// ─────────────────────────────────────────────
router.get('/my', async (req, res) => {
    try {
        let homework = [];

        if (req.user.role === 'teacher') {
            const teacher = await Teacher.findOne({ user: req.user._id });
            homework = await Homework.find({ teacher: teacher._id })
                .populate('course', 'name')
                .populate('assignments.student', 'user')
                .sort({ createdAt: -1 });
        } else if (req.user.role === 'student') {
            const student = await Student.findOne({ user: req.user._id });
            homework = await Homework.find({
                'assignments.student': student._id
            })
            .populate('course', 'name')
            .populate('teacher')
            .sort({ dueDate: 1 });
        }

        res.json({ success: true, count: homework.length, data: homework });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;