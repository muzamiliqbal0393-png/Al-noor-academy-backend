const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
    title: { type: String, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    students: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        attended: { type: Boolean, default: false },
        joinedAt: Date,
        leftAt: Date,
        duration: Number // minutes
    }],
    type: {
        type: String,
        enum: ['one-on-one', 'group'],
        default: 'one-on-one'
    },
    scheduledAt: { type: Date, required: true },
    duration: { type: Number, default: 45 }, // minutes
    topic: String,
    status: {
        type: String,
        enum: ['scheduled', 'live', 'completed', 'cancelled', 'missed'],
        default: 'scheduled'
    },
    roomId: { type: String, unique: true },
    startedAt: Date,
    endedAt: Date,
    recordingUrl: String,
    teacherNotes: String,
    teacherRating: {
        tajweedAccuracy: Number,
        pronunciation: Number,
        focus: Number,
        overall: Number,
        comment: String
    },
    homework: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
    chatMessages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        type: {
            type: String,
            enum: ['text', 'reaction', 'system'],
            default: 'text'
        },
        sentAt: { type: Date, default: Date.now }
    }],
    isParentObserving: { type: Boolean, default: false },
    observers: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: String
    }]
}, {
    timestamps: true
});

// Generate room ID before save
ClassSchema.pre('save', function(next) {
    if (!this.roomId) {
        this.roomId = `ALN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
    next();
});

module.exports = mongoose.model('Class', ClassSchema);