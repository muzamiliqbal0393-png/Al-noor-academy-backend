const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: {
        type: String,
        enum: ['easypaisa', 'jazzcash', 'bank_transfer'],
        default: 'easypaisa'
    },
    accountDetails: { type: String, required: true }, // account number / IBAN
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNote: { type: String },
    processedAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
