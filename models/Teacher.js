const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    specializations: [{
        type: String,
        enum: ['Tajweed', 'Hifz', 'Quran Reading', 'Arabic Language', 'Islamic Studies', 'Tafseer']
    }],
    experience: {
        type: Number, // years
        default: 0
    },
    education: [{
        degree: String,
        institution: String,
        year: Number
    }],
    certifications: [{
        name: String,
        issuer: String,
        year: Number,
        file: String // URL
    }],
    // Qualification text provided by teacher application
    qualificationText: {
        type: String,
        maxlength: [2000, 'Qualification text cannot exceed 2000 characters'],
        default: ''
    },

    // Multiple uploaded qualification documents (degree/certificates)
    qualificationFiles: [{
        type: String // URL to uploaded file
    }],

    // Backward compatibility (old single file field)
    degreeFile: {
        type: String, // URL to the uploaded degree/certificate
        required: false
    },
    bio: {
        type: String,
        maxlength: [1000, 'Bio cannot exceed 1000 characters']
    },
    languages: [String],
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    courses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }],
    schedule: [{
        day: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        },
        startTime: String, // "10:00"
        endTime: String    // "10:45"
    }],
    earnings: {
        total: { type: Number, default: 0 },
        thisMonth: { type: Number, default: 0 },
        ratePerClass: { type: Number, default: 46 }
    },
    stats: {
        totalClasses: { type: Number, default: 0 },
        totalStudents: { type: Number, default: 0 },
        attendanceRate: { type: Number, default: 0 },
        bestTeacherAwards: { type: Number, default: 0 }
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    approvedByAdmin: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Virtual for active students count
TeacherSchema.virtual('activeStudentsCount').get(function() {
    return this.students.length;
});

module.exports = mongoose.model('Teacher', TeacherSchema);

