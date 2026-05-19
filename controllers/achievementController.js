const Achievement = require('../models/Achievement');
const Child = require('../models/Child');
const Notification = require('../models/Notification');

exports.getAchievements = async (req, res, next) => {
    try {
        const { childId } = req.query;
        const query = childId ? { child: childId } : {};
        const achievements = await Achievement.find(query)
            .populate('child', 'name avatar')
            .sort({ earnedAt: -1 });
        res.status(200).json({ success: true, count: achievements.length, data: achievements });
    } catch (error) { next(error); }
};

exports.awardAchievement = async (req, res, next) => {
    try {
        const { childId, title, description, icon, category, tier, points } = req.body;

        const child = await Child.findById(childId);
        if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

        const achievement = await Achievement.create({
            child: childId, title, description, icon,
            category, tier: tier || 'bronze',
            points: points || 10, awardedBy: req.user.id
        });

        await Child.findByIdAndUpdate(childId, { $inc: { 'stats.totalPoints': points || 10 } });

        await Notification.create({
            user: child.parent,
            title: `🏆 Achievement Unlocked!`,
            message: `${child.name} earned "${title}" badge! MashaAllah!`,
            type: 'achievement',
            data: { achievementId: achievement._id, childId }
        });

        req.io.to(`parent_${child.parent}`).emit('achievement_earned', achievement);
        res.status(201).json({ success: true, message: 'Achievement awarded!', data: achievement });
    } catch (error) { next(error); }
};

exports.deleteAchievement = async (req, res, next) => {
    try {
        await Achievement.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Achievement deleted' });
    } catch (error) { next(error); }
};