const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');

// ─────────────────────────────────────────────
// @route   POST /api/wallet/pay-teacher
// @desc    Student pays a teacher. Admin takes 20%, teacher gets 80%
// @access  Student
// ─────────────────────────────────────────────
router.post('/pay-teacher', protect, authorize('student'), async (req, res) => {
    try {
        const { teacherId, amount, description, paymentMethod, referenceNumber } = req.body;

        if (!teacherId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Teacher ID and valid amount required.' });
        }

        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== 'teacher') {
            return res.status(404).json({ success: false, message: 'Teacher not found.' });
        }

        const adminCommission = Math.round(amount * 0.20 * 100) / 100;
        const teacherEarning  = Math.round(amount * 0.80 * 100) / 100;

        // Record the transaction
        const transaction = await Transaction.create({
            student: req.user._id,
            teacher: teacherId,
            amount,
            adminCommission,
            teacherEarning,
            description: description || `Payment to ${teacher.name}`,
            paymentMethod: paymentMethod || 'easypaisa',
            referenceNumber
        });

        // Credit teacher wallet (Teacher model has earnings.total)
        await Teacher.findOneAndUpdate(
            { user: teacherId },
            {
                $inc: {
                    'earnings.total': teacherEarning,
                    'earnings.thisMonth': teacherEarning
                }
            }
        );

        // Notify teacher
        await Notification.create({
            recipient: teacherId,
            title: `💰 Payment Received!`,
            body: `You received PKR ${teacherEarning} (80%) from a student payment of PKR ${amount}. Admin fee: PKR ${adminCommission}.`,
            type: 'payment'
        });

        // Notify student
        await Notification.create({
            recipient: req.user._id,
            title: `✅ Payment Sent Successfully`,
            body: `Your payment of PKR ${amount} to ${teacher.name} was recorded. Ref: ${referenceNumber || 'N/A'}`,
            type: 'payment'
        });

        res.status(201).json({
            success: true,
            message: `Payment recorded! Teacher receives PKR ${teacherEarning}, Admin fee PKR ${adminCommission}.`,
            data: transaction
        });

    } catch (err) {
        console.error('Wallet pay-teacher error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/wallet/withdraw
// @desc    Teacher requests a withdrawal
// @access  Teacher
// ─────────────────────────────────────────────
router.post('/withdraw', protect, authorize('teacher'), async (req, res) => {
    try {
        const { amount, method, accountDetails } = req.body;

        if (!amount || amount <= 0 || !accountDetails) {
            return res.status(400).json({ success: false, message: 'Amount and account details required.' });
        }

        const teacherProfile = await Teacher.findOne({ user: req.user._id });
        if (!teacherProfile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
        }

        if (teacherProfile.earnings.total < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available: PKR ${teacherProfile.earnings.total}`
            });
        }

        const withdrawal = await Withdrawal.create({
            teacher: req.user._id,
            amount,
            method: method || 'easypaisa',
            accountDetails
        });

        // Notify admin
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await Notification.create({
                recipient: admin._id,
                title: `💸 Withdrawal Request`,
                body: `${req.user.name} requested PKR ${amount} withdrawal via ${method || 'easypaisa'}.`,
                type: 'payment'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted. Admin will process within 24-48 hours.',
            data: withdrawal
        });

    } catch (err) {
        console.error('Withdrawal error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/wallet/approve-withdrawal/:id
// @desc    Admin approves/rejects a withdrawal
// @access  Admin
// ─────────────────────────────────────────────
router.post('/approve-withdrawal/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { action, adminNote } = req.body; // action: 'approve' | 'reject'

        const withdrawal = await Withdrawal.findById(req.params.id).populate('teacher', 'name email');
        if (!withdrawal) {
            return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
        }

        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Request already processed.' });
        }

        if (action === 'approve') {
            withdrawal.status = 'approved';
            // Deduct from teacher wallet
            await Teacher.findOneAndUpdate(
                { user: withdrawal.teacher._id },
                { $inc: { 'earnings.total': -withdrawal.amount } }
            );
            await Notification.create({
                recipient: withdrawal.teacher._id,
                title: '✅ Withdrawal Approved!',
                body: `Your PKR ${withdrawal.amount} withdrawal has been approved and sent to your account.`,
                type: 'payment'
            });
        } else {
            withdrawal.status = 'rejected';
            await Notification.create({
                recipient: withdrawal.teacher._id,
                title: '❌ Withdrawal Rejected',
                body: adminNote || 'Your withdrawal request was rejected. Please contact admin.',
                type: 'payment'
            });
        }

        withdrawal.adminNote = adminNote;
        withdrawal.processedAt = new Date();
        withdrawal.processedBy = req.user._id;
        await withdrawal.save();

        res.json({ success: true, message: `Withdrawal ${withdrawal.status}.`, data: withdrawal });

    } catch (err) {
        console.error('Approve withdrawal error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/wallet/my-transactions
// @desc    Get all transactions for logged-in user
// @access  All
// ─────────────────────────────────────────────
router.get('/my-transactions', protect, async (req, res) => {
    try {
        const query = req.user.role === 'teacher'
            ? { teacher: req.user._id }
            : { student: req.user._id };

        const transactions = await Transaction.find(query)
            .populate('student', 'name email')
            .populate('teacher', 'name email')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: transactions.length, data: transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/wallet/my-withdrawals
// @desc    Teacher: get own withdrawal history
// @access  Teacher
// ─────────────────────────────────────────────
router.get('/my-withdrawals', protect, authorize('teacher'), async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ teacher: req.user._id }).sort({ createdAt: -1 });
        const teacherProfile = await Teacher.findOne({ user: req.user._id });
        res.json({
            success: true,
            balance: teacherProfile ? teacherProfile.earnings.total : 0,
            count: withdrawals.length,
            data: withdrawals
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/wallet/admin-overview
// @desc    Admin: all transactions, pending withdrawals, earnings
// @access  Admin
// ─────────────────────────────────────────────
router.get('/admin-overview', protect, authorize('admin'), async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .populate('student', 'name email')
            .populate('teacher', 'name email')
            .sort({ createdAt: -1 });

        const pendingWithdrawals = await Withdrawal.find({ status: 'pending' })
            .populate('teacher', 'name email')
            .sort({ createdAt: -1 });

        const allWithdrawals = await Withdrawal.find()
            .populate('teacher', 'name email')
            .sort({ createdAt: -1 });

        const totalRevenue = transactions.reduce((s, t) => s + t.amount, 0);
        const adminEarnings = transactions.reduce((s, t) => s + t.adminCommission, 0);
        const teacherEarnings = transactions.reduce((s, t) => s + t.teacherEarning, 0);

        res.json({
            success: true,
            data: {
                totalRevenue,
                adminEarnings,
                teacherEarnings,
                totalTransactions: transactions.length,
                transactions,
                pendingWithdrawals,
                allWithdrawals
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
