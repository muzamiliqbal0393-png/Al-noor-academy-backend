const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
    child: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    scores: {
        quranReading: { type: Number, default: 0, min: 0, max: 100 },
        tajweed: { type: Number, default: 0, min: 0, max: 100 },
        memorization: { type: Number, default: 0, min: 0, max: 100 },
        arabicLetters: { type: Number, default: 0, min: 0, max: 100 },
        islamicStudies: { type: Number, default: 0, min: 0, max: 100 }
    },
    surahsCompleted: [{
        surahName: String,
        surahNumber: Number,
        completedDate: Date,
        quality: { type: String, enum: ['excellent', 'good', 'average', 'needs_improvement'] }
    }],
    classesAttended: { type: Number, default: 0 },
    totalClasses: { type: Number, default: 0 },
    teacherRemarks: String,
    areasOfImprovement: [String],
    strengths: [String],
    weeklyReports: [{ week: Number, report: String, score: Number, date: Date }],
    overallGrade: { type: String, enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'] }
}, { timestamps: true });

ProgressSchema.index({ child: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Progress', ProgressSchema);