const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    classRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    text: { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'image', 'audio', 'file', 'reaction', 'system'],
        default: 'text'
    },
    fileUrl: String,
    isPrivate: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    readAt: Date,
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String
    }],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', MessageSchema);