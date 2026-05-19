const express6 = require('express');
const router6 = express6.Router();
const { protect: p6 } = require('../middleware/auth');
router6.use(p6);
router6.get('/dashboard', async (req, res) => {
    try {
        const Child = require('../models/Child');
        const Class = require('../models/Class');
        const Payment = require('../models/Payment');
        const Notification = require('../models/Notification');
        const moment = require('moment');

        const today = moment().startOf('day');
        const todayEnd = moment().endOf('day');

        const [children, todayClasses, payments, unreadNotifications] = await Promise.all([
            Child.find({ parent: req.user.id, isActive: true })
                .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar' } }),
            Class.find({ parent: req.user.id, scheduledAt: { $gte: today.toDate(), $lte: todayEnd.toDate() } })
                .populate('child', 'name avatar')
                .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
                .sort({ scheduledAt: 1 }),
            Payment.findOne({ parent: req.user.id, status: 'paid' }).sort({ paidAt: -1 }),
            Notification.countDocuments({ user: req.user.id, isRead: false })
        ]);

        res.json({
            success: true,
            data: { children, todayClasses, lastPayment: payments, unreadNotifications }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
module.exports = router6;