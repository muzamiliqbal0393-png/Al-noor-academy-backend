const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Parent'
    },
    age: Number,
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other']
    },
    level: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    xpPoints: {
        type: Number,
        default: 0
    },
    streak: {
        current: { type: Number, default: 0 },
        longest: { type: Number, default: 0 },
        lastClassDate: Date
    },
    enrolledCourses: [{
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        enrolledAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 }, // 0-100
        status: {
            type: String,
            enum: ['active', 'completed', 'paused'],
            default: 'active'
        }
    }],
    memorization: {
        surahsCompleted: [String],
        juzCompleted: [Number],
        currentSurah: String,
        totalVerses: { type: Number, default: 0 }
    },
    grades: [{
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        month: String,
        year: Number,
        grade: String,
        percentage: Number,
        teacherComment: String,
        reportedAt: Date
    }],
    certificates: [{
        name: String,
        issuedBy: String,
        issuedAt: Date,
        fileUrl: String
    }],
    stats: {
        totalClasses: { type: Number, default: 0 },
        attendedClasses: { type: Number, default: 0 },
        attendanceRate: { type: Number, default: 0 },
        homeworkSubmitted: { type: Number, default: 0 },
        homeworkTotal: { type: Number, default: 0 },
        globalRank: Number
    }
}, {
    timestamps: true
});

// Update level based on XP
StudentSchema.methods.updateLevel = function() {
    const xp = this.xpPoints;
    if (xp >= 5000) this.level = 10;
    else if (xp >= 3500) this.level = 9;
    else if (xp >= 2500) this.level = 8;
    else if (xp >= 1800) this.level = 7;
    else if (xp >= 1200) this.level = 6;
    else if (xp >= 800) this.level = 5;
    else if (xp >= 500) this.level = 4;
    else if (xp >= 300) this.level = 3;
    else if (xp >= 150) this.level = 2;
    else this.level = 1;
};

module.exports = mongoose.model('Student', StudentSchema);