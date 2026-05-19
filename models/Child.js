const mongoose = require('mongoose');

const childSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent'
    },

    name: { type: String, default: '' },
    age: { type: Number, default: 0 },
    gender: { type: String, enum: ['male', 'female'], default: 'male' },

    level: { type: String, default: 'beginner' },
    currentSurah: {
      _id: false,
      name: { type: String, default: '' }
    },

    stats: {
      type: {
        totalClasses: { type: Number, default: 0 },
        attendedClasses: { type: Number, default: 0 },
        surahsMemorized: { type: Number, default: 0 },
        overallProgress: { type: Number, default: 0 },
        totalPoints: { type: Number, default: 0 },
        xpPoints: { type: Number, default: 0 },
        streak: { type: Number, default: 0 }
      },
      default: {}
    },

    isActive: { type: Boolean, default: true },

    // keep controller compatibility
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },

    // misc fields referenced in some controllers
    enrolledCourses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Child', childSchema);

