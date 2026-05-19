const Child = require('../models/Child');
const Notification = require('../models/Notification');

exports.getChildren = async (req, res, next) => {
    try {
        const query = req.user.role === 'admin'
            ? { isActive: true }
            : { parent: req.user.id, isActive: true };

        const children = await Child.find(query)
            .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar email' } });

        res.status(200).json({ success: true, count: children.length, data: children });
    } catch (error) { next(error); }
};

exports.getChild = async (req, res, next) => {
    try {
        const child = await Child.findById(req.params.id)
            .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar email phone' } });

        if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

        if (child.parent.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        res.status(200).json({ success: true, data: child });
    } catch (error) { next(error); }
};

exports.addChild = async (req, res, next) => {
    try {
        req.body.parent = req.user.id;
        const child = await Child.create(req.body);

        await Notification.create({
            user: req.user.id,
            title: '✅ Child Enrolled Successfully',
            message: `${child.name} has been enrolled! A teacher will be assigned shortly.`,
            type: 'announcement'
        });

        req.io.to(`parent_${req.user.id}`).emit('child_added', child);
        res.status(201).json({ success: true, message: 'Child enrolled successfully', data: child });
    } catch (error) { next(error); }
};

exports.updateChild = async (req, res, next) => {
    try {
        let child = await Child.findById(req.params.id);
        if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

        if (child.parent.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        child = await Child.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ success: true, message: 'Child updated', data: child });
    } catch (error) { next(error); }
};

exports.deleteChild = async (req, res, next) => {
    try {
        const child = await Child.findById(req.params.id);
        if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

        if (child.parent.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        child.isActive = false;
        await child.save();
        res.status(200).json({ success: true, message: 'Child removed from enrollment' });
    } catch (error) { next(error); }
};

exports.getChildStats = async (req, res, next) => {
    try {
        const child = await Child.findById(req.params.id);
        if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

        const [Class, Progress, Achievement] = [
            require('../models/Class'),
            require('../models/Progress'),
            require('../models/Achievement')
        ];

        const [classes, progressData, achievements] = await Promise.all([
            Class.find({ child: child._id }),
            Progress.find({ child: child._id }).sort({ year: -1, month: -1 }).limit(6),
            Achievement.find({ child: child._id })
        ]);

        const attended = classes.filter(c => c.attendance.studentPresent).length;

        res.status(200).json({
            success: true,
            data: {
                child,
                stats: {
                    totalClasses: classes.length,
                    attendedClasses: attended,
                    attendanceRate: classes.length ? Math.round((attended / classes.length) * 100) : 0,
                    totalAchievements: achievements.length,
                    totalPoints: achievements.reduce((sum, a) => sum + a.points, 0),
                    progressHistory: progressData
                }
            }
        });
    } catch (error) { next(error); }
};