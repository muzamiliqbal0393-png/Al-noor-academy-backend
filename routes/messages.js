const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/messages/contacts
// @desc    Get messaging contacts (teacher and admin)
// @access  All authenticated
router.get('/contacts', async (req, res) => {
    try {
        const User = require('../models/User');
        const teacher = await User.findOne({ email: 'ibrahim@alnoor.com' }).select('_id name email avatar role');
        const admin = await User.findOne({ email: 'admin@alnoor.com' }).select('_id name email avatar role');
        res.json({ success: true, data: { teacher, admin } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/messages/send
// @desc    Send a message
// @access  All
// ─────────────────────────────────────────────
router.post('/send', async (req, res) => {
    try {
        const { receiverId, text, type, fileUrl } = req.body;

        const message = await Message.create({
            sender: req.user._id,
            receiver: receiverId,
            text,
            type: type || 'text',
            fileUrl,
            isPrivate: true
        });

        // Notify via socket if online
        if (global.sendNotification) {
            global.sendNotification(receiverId, {
                title: `New message from ${req.user.name}`,
                body: text.substring(0, 80),
                type: 'message'
            });
        }

        // DB notification
        await Notification.create({
            recipient: receiverId,
            title: `💬 New Message from ${req.user.name}`,
            body: text.substring(0, 100),
            type: 'message',
            relatedId: message._id
        });

        await message.populate('sender', 'name avatar role');

        res.status(201).json({ success: true, data: message });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/messages/inbox
// @desc    Get inbox (conversations)
// @access  All
// ─────────────────────────────────────────────
router.get('/inbox', async (req, res) => {
    try {
        const userId = req.user._id;

        // Get unique conversations
        const messages = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { receiver: userId }],
                    isPrivate: true,
                    isDeleted: false
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender', userId] },
                            '$receiver',
                            '$sender'
                        ]
                    },
                    lastMessage: { $first: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$isRead', false] }] },
                                1, 0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'contact'
                }
            },
            { $unwind: '$contact' },
            { $sort: { 'lastMessage.createdAt': -1 } }
        ]);

        res.json({ success: true, count: messages.length, data: messages });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/messages/conversation/:userId
// @desc    Get conversation with specific user
// @access  All
// ─────────────────────────────────────────────
router.get('/conversation/:userId', async (req, res) => {
    try {
        const myId = req.user._id;
        const otherId = req.params.userId;
        const { page = 1, limit = 50 } = req.query;

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ],
            isDeleted: false
        })
        .populate('sender', 'name avatar role')
        .populate('receiver', 'name avatar role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

        // Mark as read
        await Message.updateMany(
            { sender: otherId, receiver: myId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.json({
            success: true,
            count: messages.length,
            data: messages.reverse()
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   DELETE /api/messages/:id
// @desc    Delete a message
// @access  Sender only
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        message.isDeleted = true;
        await message.save();

        res.json({ success: true, message: 'Message deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;