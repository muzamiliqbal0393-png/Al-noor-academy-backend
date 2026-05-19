const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    type: {
        type: String,
        enum: ['subscription', 'course', 'one-time'],
        default: 'subscription'
    },
    plan: String,
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    stripePaymentIntentId: String,
    stripeInvoiceId: String,
    description: String,
    paidAt: Date,
    nextPaymentDate: Date,
    refundedAt: Date,
    refundAmount: Number,
    invoiceUrl: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', PaymentSchema);