const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },          // total amount paid by student
    adminCommission: { type: Number, required: true }, // 20%
    teacherEarning: { type: Number, required: true },  // 80%
    currency: { type: String, default: 'PKR' },
    description: { type: String, default: 'Course Payment' },
    status: {
        type: String,
        enum: ['pending', 'completed', 'refunded'],
        default: 'completed'
    },
    paymentMethod: {
        type: String,
        enum: ['easypaisa', 'jazzcash', 'bank_transfer', 'card', 'cash'],
        default: 'easypaisa'
    },
    referenceNumber: { type: String }, // student-provided receipt number
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', TransactionSchema);
