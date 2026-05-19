const mongoose = require('mongoose');

const AchievementSchema = new mongoose.Schema({
    child: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
    title: { type: String, required: true },
    description: String,
    icon: String,
    category: { type: String, enum: ['memorization', 'attendance', 'progress', 'behavior', 'special'], required: true },
    tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    points: { type: Number, default: 10 },
    earnedAt: { type: Date, default: Date.now },
    awardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Achievement', AchievementSchema);