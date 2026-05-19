const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    instructions: String,
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    type: {
        type: String,
        enum: ['audio', 'video', 'written', 'memorization', 'reading'],
        default: 'audio'
    },
    dueDate: { type: Date, required: true },
    maxScore: { type: Number, default: 100 },
    assignments: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        status: {
            type: String,
            enum: ['pending', 'submitted', 'graded', 'late', 'missing'],
            default: 'pending'
        },
        submittedAt: Date,
        submission: {
            text: String,
            fileUrl: String,
            audioUrl: String,
            videoUrl: String
        },
        grade: {
            score: Number,
            feedback: String,
            gradedAt: Date,
            gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        }
    }],
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Homework', HomeworkSchema);