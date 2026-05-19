const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);

// Get all notifications
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const query = { recipient: req.user._id };
        if (unreadOnly === 'true') query.read = false;

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            read: false
        });

        res.json({ success: true, unreadCount, count: notifications.length, data: notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Mark as read
router.put('/:id/read', async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true, readAt: new Date() });
        res.json({ success: true, message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Mark all as read
router.put('/mark-all-read', async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, read: false },
            { read: true, readAt: new Date() }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Notification deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;