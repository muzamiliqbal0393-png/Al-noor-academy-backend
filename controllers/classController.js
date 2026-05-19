const Class = require('../models/Class');
const Child = require('../models/Child');
const Notification = require('../models/Notification');
const moment = require('moment');

exports.getClasses = async (req, res, next) => {
    try {
        const { status, childId, from, to, page = 1, limit = 20 } = req.query;
        let query = {};

        if (req.user.role === 'parent') query.parent = req.user.id;
        else if (req.user.role === 'teacher') {
            const Teacher = require('../models/Teacher');
            const teacher = await Teacher.findOne({ user: req.user.id });
            if (teacher) query.teacher = teacher._id;
        }

        if (status) query.status = status;
        if (childId) query.child = childId;
        if (from || to) {
            query.scheduledAt = {};
            if (from) query.scheduledAt.$gte = new Date(from);
            if (to) query.scheduledAt.$lte = new Date(to);
        }

        const skip = (page - 1) * limit;
        const [classes, total] = await Promise.all([
            Class.find(query)
                .populate('child', 'name age avatar gender')
                .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar' } })
                .sort({ scheduledAt: 1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Class.countDocuments(query)
        ]);

        res.status(200).json({
            success: true, count: classes.length, total,
            totalPages: Math.ceil(total / limit), currentPage: parseInt(page), data: classes
        });
    } catch (error) { next(error); }
};

exports.getTodayClasses = async (req, res, next) => {
    try {
        const today = moment().startOf('day').toDate();
        const tomorrow = moment().endOf('day').toDate();
        let query = { scheduledAt: { $gte: today, $lte: tomorrow } };

        if (req.user.role === 'parent') query.parent = req.user.id;
        else if (req.user.role === 'teacher') {
            const Teacher = require('../models/Teacher');
            const teacher = await Teacher.findOne({ user: req.user.id });
            if (teacher) query.teacher = teacher._id;
        }

        const classes = await Class.find(query)
            .populate('child', 'name age avatar gender')
            .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar email' } })
            .sort({ scheduledAt: 1 });

        res.status(200).json({ success: true, count: classes.length, data: classes });
    } catch (error) { next(error); }
};

exports.scheduleClass = async (req, res, next) => {
    try {
        const { childId, teacherId, subject, scheduledAt, duration, notes } = req.body;

        const child = await Child.findOne({ _id: childId, parent: req.user.id });
        if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

        const meetingId = Math.random().toString(36).substr(2, 9);

        const newClass = await Class.create({
            child: childId,
            teacher: teacherId,
            parent: req.user.id,
            subject,
            scheduledAt,
            duration: duration || 60,
            meetingLink: `https://meet.alnoor.com/room/${meetingId}`,
            meetingId,
            meetingPassword: Math.random().toString(36).substr(2, 6).toUpperCase(),
            notes: { parent: notes }
        });

        await Child.findByIdAndUpdate(childId, { $inc: { 'stats.totalClasses': 1 } });

        await Notification.create({
            user: req.user.id,
            title: '📅 Class Scheduled',
            message: `Class for ${child.name} on ${moment(scheduledAt).format('MMM DD [at] h:mm A')}`,
            type: 'class_reminder',
            data: { classId: newClass._id }
        });

        await newClass.populate([
            { path: 'child', select: 'name age avatar' },
            { path: 'teacher', populate: { path: 'user', select: 'name avatar' } }
        ]);

        req.io.to(`parent_${req.user.id}`).emit('class_scheduled', newClass);
        res.status(201).json({ success: true, message: 'Class scheduled!', data: newClass });
    } catch (error) { next(error); }
};

exports.updateClass = async (req, res, next) => {
    try {
        let classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ success: false, message: 'Class not found' });

        classItem = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, data: classItem });
    } catch (error) { next(error); }
};

exports.cancelClass = async (req, res, next) => {
    try {
        const classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ success: false, message: 'Class not found' });

        if (classItem.parent.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        classItem.status = 'cancelled';
        classItem.notes.parent = req.body.reason || 'Cancelled by parent';
        await classItem.save();

        req.io.to(`class_${classItem._id}`).emit('class_cancelled', { classId: classItem._id });
        res.status(200).json({ success: true, message: 'Class cancelled', data: classItem });
    } catch (error) { next(error); }
};

exports.rescheduleClass = async (req, res, next) => {
    try {
        const classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ success: false, message: 'Class not found' });

        classItem.scheduledAt = req.body.newScheduledAt;
        classItem.status = 'scheduled';
        await classItem.save();

        res.status(200).json({ success: true, message: 'Class rescheduled', data: classItem });
    } catch (error) { next(error); }
};

exports.submitFeedback = async (req, res, next) => {
    try {
        const classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ success: false, message: 'Class not found' });

        classItem.feedback = { rating: req.body.rating, comment: req.body.comment, givenAt: Date.now() };
        await classItem.save();

        res.status(200).json({ success: true, message: 'Feedback submitted', data: classItem });
    } catch (error) { next(error); }
};

exports.markAttendance = async (req, res, next) => {
    try {
        const classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ success: false, message: 'Class not found' });

        classItem.attendance = {
            studentPresent: req.body.studentPresent,
            teacherPresent: req.body.teacherPresent,
            joinedAt: req.body.joinedAt || Date.now()
        };
        classItem.status = 'completed';
        await classItem.save();

        if (req.body.studentPresent) {
            await Child.findByIdAndUpdate(classItem.child, { $inc: { 'stats.attendedClasses': 1 } });
        }

        res.status(200).json({ success: true, message: 'Attendance marked', data: classItem });
    } catch (error) { next(error); }
};

exports.getAttendance = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const currentDate = moment();
        const startDate = moment(`${year || currentDate.year()}-${month || currentDate.month() + 1}-01`).startOf('month');
        const endDate = moment(startDate).endOf('month');

        const classes = await Class.find({
            child: req.params.childId,
            scheduledAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        }).select('scheduledAt status attendance');

        const total = classes.length;
        const present = classes.filter(c => c.attendance.studentPresent).length;
        const cancelled = classes.filter(c => c.status === 'cancelled').length;

        res.status(200).json({
            success: true,
            data: {
                total, present, absent: total - present - cancelled, cancelled,
                upcoming: classes.filter(c => c.status === 'scheduled').length,
                rate: (total - cancelled) > 0 ? Math.round((present / (total - cancelled)) * 100) : 0,
                classes
            }
        });
    } catch (error) { next(error); }
};