const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'teacher', 'student', 'parent'],
        required: true
    },
    avatar: {
        type: String,
        default: null
    },
    phone: {
        type: String,
        default: null
    },
    country: {
        type: String,
        default: null
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerifyToken: String,
    passwordResetToken: String,
    passwordResetExpire: Date,
    lastLogin: Date,
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false }
    },
    language: {
        type: String,
        default: 'en'
    }
}, {
    timestamps: true
});

// Hash password before save
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT
UserSchema.methods.getSignedToken = function() {
    return jwt.sign(
        { id: this._id, role: this.role, name: this.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// Generate reset token
UserSchema.methods.getPasswordResetToken = function() {
    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4();
    this.passwordResetToken = require('bcryptjs').hashSync(token, 10);
    this.passwordResetExpire = Date.now() + 10 * 60 * 1000; // 10 min
    return token;
};

module.exports = mongoose.model('User', UserSchema);