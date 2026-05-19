const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
        type: String,
        enum: [
            'class_reminder', 'class_started', 'class_completed',
            'homework_assigned', 'homework_submitted', 'homework_graded',
            'attendance_marked', 'attendance_warning',
            'message', 'payment', 'new_student',
            'rating', 'achievement', 'announcement', 'general'
        ],
        default: 'general'
    },
    relatedId: mongoose.Schema.Types.ObjectId,
    relatedModel: String,
    read: { type: Boolean, default: false },
    readAt: Date,
    icon: String,
    actionUrl: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);