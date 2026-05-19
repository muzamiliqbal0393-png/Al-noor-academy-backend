const Child = require('../models/Child');
const Class = require('../models/Class');
const Progress = require('../models/Progress');
const Achievement = require('../models/Achievement');
const Notification = require('../models/Notification');
const User = require('../models/User');
const moment = require('moment');

// @desc Get student dashboard data
// @route GET /api/student/dashboard
exports.getStudentDashboard = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .populate({
                path: 'children',
                populate: {
                    path: 'teacher',
                    populate: { path: 'user', select: 'name avatar email' }
                }
            });

        if (!user.children?.length) {
            return res.status(200).json({
                success: true,
                data: { message: 'No children enrolled', children: [] }
            });
        }

        const child = user.children[0];
        const now = moment();

        const [
            todayClasses,
            progressData,
            achievements,
            notifications
        ] = await Promise.all([
            Class.find({
                child: child._id,
                scheduledAt: {
                    $gte: now.startOf('day').toDate(),
                    $lte: now.endOf('day').toDate()
                }
            }).populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar' } }),

            Progress.findOne({ child: child._id })
                .sort({ year: -1, month: -1 }),

            Achievement.find({ child: child._id }).sort({ earnedAt: -1 }),

            Notification.find({ user: req.user.id, isRead: false }).limit(5)
        ]);

        const totalPoints = achievements.reduce((sum, a) => sum + a.points, 0);
        const attendanceRate = child.stats.totalClasses > 0
            ? Math.round((child.stats.attendedClasses / child.stats.totalClasses) * 100)
            : 0;

        res.status(200).json({
            success: true,
            data: {
                child,
                todayClasses,
                progress: progressData,
                achievements,
                notifications,
                stats: {
                    totalPoints,
                    attendanceRate,
                    surahsMemorized: child.stats.surahsMemorized,
                    totalClasses: child.stats.totalClasses,
                    attendedClasses: child.stats.attendedClasses,
                    totalAchievements: achievements.length
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get leaderboard
// @route GET /api/student/leaderboard
exports.getLeaderboard = async (req, res, next) => {
    try {
        const children = await Child.find({ isActive: true })
            .select('name stats level parent')
            .populate('parent', 'name')
            .sort({ 'stats.totalPoints': -1 })
            .limit(20);

        const leaderboard = children.map((child, index) => ({
            rank: index + 1,
            name: child.name,
            points: child.stats.totalPoints || 0,
            level: child.level,
            surahsMemorized: child.stats.surahsMemorized || 0,
            isCurrentUser: child.parent?._id?.toString() === req.user.id
        }));

        const myRank = leaderboard.find(l => l.isCurrentUser);

        res.status(200).json({
            success: true,
            data: leaderboard,
            myRank: myRank?.rank || null
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get student homework
// @route GET /api/student/homework/:childId
exports.getStudentHomework = async (req, res, next) => {
    try {
        const classes = await Class.find({
            child: req.params.childId,
            'homework.assigned': { $exists: true, $ne: null }
        })
        .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
        .sort({ scheduledAt: -1 })
        .limit(20);

        const homework = classes.map(cls => ({
            classId: cls._id,
            assignment: cls.homework.assigned,
            dueDate: cls.homework.dueDate,
            isCompleted: cls.homework.isCompleted,
            subject: cls.subject,
            teacher: cls.teacher?.user?.name,
            scheduledAt: cls.scheduledAt
        }));

        const pending = homework.filter(h => !h.isCompleted).length;

        res.status(200).json({
            success: true,
            count: homework.length,
            pending,
            data: homework
        });
    } catch (error) {
        next(error);
    }
};

// @desc Complete homework
// @route PUT /api/student/homework/:classId/complete
exports.completeHomework = async (req, res, next) => {
    try {
        const classItem = await Class.findByIdAndUpdate(
            req.params.classId,
            { 'homework.isCompleted': true },
            { new: true }
        );

        if (!classItem) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        await Child.findByIdAndUpdate(classItem.child, {
            $inc: { 'stats.totalPoints': 10 }
        });

        await Notification.create({
            user: req.user.id,
            title: '✅ Homework Completed! +10 XP',
            message: `Great job completing your ${classItem.subject} homework! MashaAllah!`,
            type: 'achievement',
            priority: 'low'
        });

        req.io.to(`parent_${req.user.id}`).emit('homework_completed', {
            classId: classItem._id,
            subject: classItem.subject
        });

        res.status(200).json({
            success: true,
            message: 'Homework completed! +10 XP earned!',
            data: classItem
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get student streak
// @route GET /api/student/streak/:childId
exports.getStudentStreak = async (req, res, next) => {
    try {
        const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

        const classes = await Class.find({
            child: req.params.childId,
            scheduledAt: { $gte: thirtyDaysAgo },
            'attendance.studentPresent': true
        }).select('scheduledAt').sort({ scheduledAt: -1 });

        let streak = 0;
        let currentDate = moment().startOf('day');
        const attendedDates = new Set(
            classes.map(c => moment(c.scheduledAt).format('YYYY-MM-DD'))
        );

        while (attendedDates.has(currentDate.format('YYYY-MM-DD'))) {
            streak++;
            currentDate.subtract(1, 'day');
        }

        res.status(200).json({
            success: true,
            data: { streak, attendedDates: Array.from(attendedDates) }
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get student progress
// @route GET /api/student/progress/:childId
exports.getStudentProgress = async (req, res, next) => {
    try {
        const progress = await Progress.find({ child: req.params.childId })
            .sort({ year: -1, month: -1 })
            .limit(6)
            .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });

        res.status(200).json({
            success: true,
            count: progress.length,
            latest: progress[0] || null,
            history: progress
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get student classes
// @route GET /api/student/classes/:childId
exports.getStudentClasses = async (req, res, next) => {
    try {
        const { status, limit = 20, page = 1 } = req.query;
        const query = { child: req.params.childId };
        if (status) query.status = status;

        const skip = (page - 1) * limit;

        const [classes, total] = await Promise.all([
            Class.find(query)
                .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar' } })
                .sort({ scheduledAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Class.countDocuments(query)
        ]);

        res.status(200).json({
            success: true, count: classes.length,
            total, totalPages: Math.ceil(total / limit),
            data: classes
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get student achievements
// @route GET /api/student/achievements/:childId
exports.getStudentAchievements = async (req, res, next) => {
    try {
        const achievements = await Achievement.find({ child: req.params.childId })
            .sort({ earnedAt: -1 });

        const totalPoints = achievements.reduce((sum, a) => sum + a.points, 0);
        const byTier = {
            bronze: achievements.filter(a => a.tier === 'bronze').length,
            silver: achievements.filter(a => a.tier === 'silver').length,
            gold: achievements.filter(a => a.tier === 'gold').length,
            platinum: achievements.filter(a => a.tier === 'platinum').length
        };

        res.status(200).json({
            success: true,
            count: achievements.length,
            totalPoints,
            byTier,
            data: achievements
        });
    } catch (error) {
        next(error);
    }
};