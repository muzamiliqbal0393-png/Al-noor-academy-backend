const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    nameArabic: String,
    description: String,
    category: {
        type: String,
        enum: ['Tajweed', 'Hifz', 'Quran Reading', 'Arabic Language', 'Islamic Studies', 'Tafseer'],
        required: true
    },
    level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    duration: {
        sessionsTotal: { type: Number, default: 30 },
        minutesPerSession: { type: Number, default: 45 }
    },
    curriculum: [{
        week: Number,
        topic: String,
        description: String,
        resources: [String]
    }],
    price: {
        amount: Number,
        currency: { type: String, default: 'USD' }
    },
    thumbnail: String,
    isActive: { type: Boolean, default: true },
    enrolledCount: { type: Number, default: 0 },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Course', CourseSchema);