const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['pdf', 'video', 'audio', 'image', 'link'], required: true },
    category: { type: String, enum: ['tajweed', 'hifz', 'arabic', 'quran', 'islamic_studies', 'general'], required: true },
    url: String,
    fileSize: Number,
    thumbnailUrl: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Child' }],
    isPublic: { type: Boolean, default: false },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all'] },
    downloads: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    tags: [String]
}, { timestamps: true });

module.exports = mongoose.model('Resource', ResourceSchema);