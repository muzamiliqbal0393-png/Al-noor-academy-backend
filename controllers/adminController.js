const User = require('../models/User');
const Child = require('../models/Child');
const Class = require('../models/Class');
const Payment = require('../models/Payment');
const Teacher = require('../models/Teacher');

exports.getDashboardStats = async (req, res, next) => {
    try {
        const [totalUsers, totalStudents, totalTeachers, totalClasses, totalPayments,
               activeClasses, pendingPayments] = await Promise.all([
            User.countDocuments({ isActive: true }),
            Child.countDocuments({ isActive: true }),
            Teacher.countDocuments(),
            Class.countDocuments(),
            Payment.find({ status: 'paid' }),
            Class.countDocuments({ status: 'scheduled' }),
            Payment.countDocuments({ status: 'pending' })
        ]);

        const totalRevenue = totalPayments.reduce((sum, p) => sum + p.amount, 0);

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt');
        const recentPayments = await Payment.find({ status: 'paid' }).sort({ paidAt: -1 }).limit(5)
            .populate('parent', 'name email');

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalUsers, totalStudents, totalTeachers, totalClasses,
                    totalRevenue: totalRevenue.toFixed(2), activeClasses, pendingPayments
                },
                recentUsers, recentPayments
            }
        });
    } catch (error) { next(error); }
};

exports.getAllUsers = async (req, res, next) => {
    try {
        const { role, page = 1, limit = 20, search } = req.query;
        const query = {};
        if (role) query.role = role;
        if (search) query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];

        const [users, total] = await Promise.all([
            User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
            User.countDocuments(query)
        ]);

        res.status(200).json({ success: true, count: users.length, total, data: users });
    } catch (error) { next(error); }
};

exports.updateUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, data: user });
    } catch (error) { next(error); }
};

exports.deleteUser = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { isActive: false });
        res.status(200).json({ success: true, message: 'User deactivated' });
    } catch (error) { next(error); }
};

exports.getAllPayments = async (req, res, next) => {
    try {
        const payments = await Payment.find().populate('parent', 'name email').sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: payments.length, data: payments });
    } catch (error) { next(error); }
};

exports.sendBroadcast = async (req, res, next) => {
    try {
        const { title, message, role, type } = req.body;
        const query = role ? { role } : {};
        const users = await User.find(query).select('_id');

        const Notification = require('../models/Notification');
        const notifications = users.map(u => ({
            user: u._id, title, message, type: type || 'announcement'
        }));

        await Notification.insertMany(notifications);
        req.io.emit('broadcast_notification', { title, message });

        res.status(200).json({ success: true, message: `Broadcast sent to ${users.length} users` });
    } catch (error) { next(error); }
};