const mongoose = require('mongoose');

const ParentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    children: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    subscriptionPlan: {
        type: String,
        enum: ['single', 'family', 'premium'],
        default: 'single'
    },
    subscription: {
        isActive: { type: Boolean, default: false },
        startDate: Date,
        endDate: Date,
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        amount: Number
    },
    preferredLanguage: {
        type: String,
        default: 'en'
    },
    emergencyContact: {
        name: String,
        phone: String,
        relation: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Parent', ParentSchema);