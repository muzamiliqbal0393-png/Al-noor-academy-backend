const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const query = { user: req.user.id };
        if (unreadOnly === 'true') query.isRead = false;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
            Notification.countDocuments(query),
            Notification.countDocuments({ user: req.user.id, isRead: false })
        ]);

        res.status(200).json({ success: true, count: notifications.length, total, unreadCount, data: notifications });
    } catch (error) { next(error); }
};

exports.markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isRead: true, readAt: Date.now() },
            { new: true }
        );
        if (!notification) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, data: notification });
    } catch (error) { next(error); }
};

exports.markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true, readAt: Date.now() });
        res.status(200).json({ success: true, message: 'All marked as read' });
    } catch (error) { next(error); }
};

exports.deleteNotification = async (req, res, next) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) { next(error); }
};

exports.createNotification = async (req, res, next) => {
    try {
        const notification = await Notification.create({ ...req.body, user: req.body.userId || req.user.id });
        req.io.to(`user_${notification.user}`).emit('new_notification', notification);
        res.status(201).json({ success: true, data: notification });
    } catch (error) { next(error); }
};