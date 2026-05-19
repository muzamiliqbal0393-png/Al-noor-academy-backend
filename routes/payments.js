const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const Parent = require('../models/Parent');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

router.use(protect);

const PLANS = {
    single:  { amount: 2999,  name: 'Single Child Plan',  interval: 'month' },
    family:  { amount: 4999,  name: 'Family Plan',        interval: 'month' },
    premium: { amount: 7999,  name: 'Premium Plan',       interval: 'month' }
};

// ─────────────────────────────────────────────
// @route   POST /api/payments/subscribe
// @desc    Create subscription
// @access  Parent
// ─────────────────────────────────────────────
router.post('/subscribe', authorize('parent'), async (req, res) => {
    try {
        const { plan, paymentMethodId } = req.body;

        if (!PLANS[plan]) {
            return res.status(400).json({ success: false, message: 'Invalid plan' });
        }

        const parent = await Parent.findOne({ user: req.user._id });
        const planInfo = PLANS[plan];

        // Create or get Stripe customer
        let customerId = parent.subscription?.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.name,
                metadata: { userId: req.user._id.toString(), plan }
            });
            customerId = customer.id;
        }

        // Attach payment method
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId }
        });

        // Create Stripe price
        const price = await stripe.prices.create({
            unit_amount: planInfo.amount,
            currency: 'usd',
            recurring: { interval: planInfo.interval },
            product_data: { name: planInfo.name }
        });

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: price.id }],
            expand: ['latest_invoice.payment_intent']
        });

        // Save payment record
        const payment = await Payment.create({
            parent: parent._id,
            amount: planInfo.amount / 100,
            type: 'subscription',
            plan,
            status: 'completed',
            stripePaymentIntentId: subscription.latest_invoice.payment_intent.id,
            description: planInfo.name,
            paidAt: new Date(),
            nextPaymentDate: new Date(subscription.current_period_end * 1000)
        });

        // Update parent subscription
        const endDate = new Date(subscription.current_period_end * 1000);
        await Parent.findByIdAndUpdate(parent._id, {
            subscriptionPlan: plan,
            subscription: {
                isActive: true,
                startDate: new Date(),
                endDate,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                amount: planInfo.amount / 100
            }
        });

        // Notify
        await Notification.create({
            recipient: req.user._id,
            title: `✅ Subscription Active — ${planInfo.name}`,
            body: `Your ${planInfo.name} is now active. Next payment: ${endDate.toLocaleDateString()}`,
            type: 'payment'
        });

        await sendEmail({
            to: req.user.email,
            subject: `Subscription Confirmed — Al-Noor Academy`,
            html: `
                <h2>✅ Subscription Confirmed!</h2>
                <p>Your <strong>${planInfo.name}</strong> is now active.</p>
                <p><strong>Amount:</strong> $${planInfo.amount / 100}/month</p>
                <p><strong>Next Payment:</strong> ${endDate.toLocaleDateString()}</p>
                <p>JazakAllah Khair for your trust in Al-Noor Academy! 🤲</p>
            `
        });

        res.status(201).json({
            success: true,
            message: `${planInfo.name} activated!`,
            data: {
                subscriptionId: subscription.id,
                plan,
                amount: planInfo.amount / 100,
                nextPaymentDate: endDate,
                payment
            }
        });

    } catch (err) {
        console.error('Payment Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/payments/cancel
// @desc    Cancel subscription
// @access  Parent
// ─────────────────────────────────────────────
router.post('/cancel', authorize('parent'), async (req, res) => {
    try {
        const parent = await Parent.findOne({ user: req.user._id });

        if (!parent.subscription?.stripeSubscriptionId) {
            return res.status(400).json({ success: false, message: 'No active subscription' });
        }

        await stripe.subscriptions.cancel(parent.subscription.stripeSubscriptionId);

        await Parent.findByIdAndUpdate(parent._id, {
            'subscription.isActive': false
        });

        await Notification.create({
            recipient: req.user._id,
            title: 'Subscription Cancelled',
            body: 'Your subscription has been cancelled. Access ends at billing period end.',
            type: 'payment'
        });

        res.json({ success: true, message: 'Subscription cancelled.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/payments/history
// @desc    Payment history
// @access  Parent
// ─────────────────────────────────────────────
router.get('/history', authorize('parent', 'admin'), async (req, res) => {
    try {
        const parent = await Parent.findOne({ user: req.user._id });

        const payments = await Payment.find({ parent: parent._id })
            .sort({ createdAt: -1 });

        res.json({ success: true, count: payments.length, data: payments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   POST /api/payments/webhook
// @desc    Stripe webhook handler
// @access  Public (Stripe)
// ─────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).json({ success: false, message: `Webhook error: ${err.message}` });
    }

    switch (event.type) {
        case 'invoice.payment_succeeded':
            console.log('✅ Payment succeeded:', event.data.object.id);
            break;

        case 'invoice.payment_failed':
            console.log('❌ Payment failed:', event.data.object.id);
            break;

        case 'customer.subscription.deleted':
            const sub = event.data.object;
            await Parent.findOneAndUpdate(
                { 'subscription.stripeSubscriptionId': sub.id },
                { 'subscription.isActive': false }
            );
            break;
    }

    res.json({ received: true });
});

module.exports = router;