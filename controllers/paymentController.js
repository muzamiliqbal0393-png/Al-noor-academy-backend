const Payment = require('../models/Payment');
const Notification = require('../models/Notification');

const PLANS = {
    single: { name: 'Single Child Plan', amount: 29.99, children: 1, classesPerWeek: 3 },
    family: { name: 'Family Package', amount: 49.99, children: 2, classesPerWeek: 6 },
    premium: { name: 'Premium Plan', amount: 79.99, children: 4, classesPerWeek: 12 }
};

exports.getPayments = async (req, res, next) => {
    try {
        const query = req.user.role === 'admin' ? {} : { parent: req.user.id };
        const { page = 1, limit = 10, status } = req.query;
        if (status) query.status = status;

        const [payments, total] = await Promise.all([
            Payment.find(query).populate('parent', 'name email')
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
            Payment.countDocuments(query)
        ]);

        res.status(200).json({ success: true, count: payments.length, total, data: payments });
    } catch (error) { next(error); }
};

exports.createPayment = async (req, res, next) => {
    try {
        const { plan, paymentMethod, discountCode } = req.body;
        const planDetails = PLANS[plan];
        if (!planDetails) return res.status(400).json({ success: false, message: 'Invalid plan' });

        let amount = planDetails.amount;
        let discount = null;
        if (discountCode === 'QURAN10') {
            discount = { code: discountCode, percentage: 10, amount: +(amount * 0.1).toFixed(2) };
            amount = +(amount - discount.amount).toFixed(2);
        }

        const payment = await Payment.create({
            parent: req.user.id, amount, plan,
            planDetails: { name: planDetails.name, children: planDetails.children, classesPerWeek: planDetails.classesPerWeek },
            paymentMethod: paymentMethod || 'card',
            status: 'paid',
            paidAt: Date.now(),
            billingPeriod: { from: new Date(), to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            dueDate: new Date(),
            discount
        });

        await Notification.create({
            user: req.user.id,
            title: '✅ Payment Successful',
            message: `Payment of $${amount} for ${planDetails.name} processed successfully!`,
            type: 'payment_success',
            data: { paymentId: payment._id }
        });

        req.io.to(`parent_${req.user.id}`).emit('payment_success', payment);
        res.status(201).json({ success: true, message: 'Payment successful!', data: payment });
    } catch (error) { next(error); }
};

exports.getPaymentSummary = async (req, res, next) => {
    try {
        const payments = await Payment.find({ parent: req.user.id });
        const paid = payments.filter(p => p.status === 'paid');

        res.status(200).json({
            success: true,
            data: {
                totalPaid: paid.reduce((sum, p) => sum + p.amount, 0),
                totalPayments: payments.length,
                currentPlan: paid[paid.length - 1]?.plan || null,
                lastPayment: paid[paid.length - 1],
                nextDueDate: paid[paid.length - 1]?.nextBillingDate || null
            }
        });
    } catch (error) { next(error); }
};