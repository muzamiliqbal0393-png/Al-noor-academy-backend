const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const crypto = require('crypto');

const getConvId = (id1, id2) => {
    return crypto.createHash('md5')
        .update([id1.toString(), id2.toString()].sort().join('_'))
        .digest('hex');
};

exports.getConversations = async (req, res, next) => {
    try {
        const messages = await Message.find({
            $or: [{ sender: req.user.id }, { receiver: req.user.id }]
        }).sort({ createdAt: -1 });

        const convMap = {};
        messages.forEach(msg => {
            if (!convMap[msg.conversationId]) {
                convMap[msg.conversationId] = msg;
            }
        });

        const conversations = await Message.populate(Object.values(convMap), [
            { path: 'sender', select: 'name avatar role' },
            { path: 'receiver', select: 'name avatar role' }
        ]);

        res.status(200).json({ success: true, count: conversations.length, data: conversations });
    } catch (error) { next(error); }
};

exports.getMessages = async (req, res, next) => {
    try {
        const conversationId = getConvId(req.user.id, req.params.userId);
        const { page = 1, limit = 50 } = req.query;

        const messages = await Message.find({ conversationId })
            .populate('sender', 'name avatar')
            .populate('receiver', 'name avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        await Message.updateMany(
            { conversationId, receiver: req.user.id, isRead: false },
            { isRead: true, readAt: Date.now() }
        );

        res.status(200).json({ success: true, count: messages.length, data: messages.reverse() });
    } catch (error) { next(error); }
};

exports.sendMessage = async (req, res, next) => {
    try {
        const { receiverId, content, messageType, childId } = req.body;
        const receiver = await User.findById(receiverId);
        if (!receiver) return res.status(404).json({ success: false, message: 'Receiver not found' });

        const conversationId = getConvId(req.user.id, receiverId);

        const message = await Message.create({
            sender: req.user.id, receiver: receiverId,
            content, messageType: messageType || 'text',
            child: childId, conversationId
        });

        await message.populate([
            { path: 'sender', select: 'name avatar' },
            { path: 'receiver', select: 'name avatar' }
        ]);

        await Notification.create({
            user: receiverId,
            title: `💬 New message from ${req.user.name}`,
            message: content.substring(0, 100),
            type: 'new_message',
            data: { senderId: req.user.id }
        });

        req.io.to(`user_${receiverId}`).emit('new_message', message);
        req.io.to(`user_${req.user.id}`).emit('message_sent', message);

        res.status(201).json({ success: true, data: message });
    } catch (error) { next(error); }
};

exports.deleteMessage = async (req, res, next) => {
    try {
        await Message.findOneAndDelete({ _id: req.params.id, sender: req.user.id });
        res.status(200).json({ success: true, message: 'Message deleted' });
    } catch (error) { next(error); }
};

exports.getUnreadCount = async (req, res, next) => {
    try {
        const count = await Message.countDocuments({ receiver: req.user.id, isRead: false });
        res.status(200).json({ success: true, data: { count } });
    } catch (error) { next(error); }
};