const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    date: { type: Date, required: true },
    status: {
        type: String,
        enum: ['present', 'absent', 'late', 'excused'],
        default: 'absent'
    },
    joinedAt: Date,
    leftAt: Date,
    duration: Number, // minutes attended
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    parentNotified: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Compound index to prevent duplicate attendance
AttendanceSchema.index({ class: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);