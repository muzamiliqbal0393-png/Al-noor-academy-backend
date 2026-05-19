const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const io = socketIO(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST']
    }
});

// Make io accessible in routes
app.set('io', io);

// ===== MIDDLEWARE =====
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for profile pictures
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100,
    message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter);

// Auth limiter (strict)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: { success: false, message: 'Too many login attempts. Try after 1 hour.' }
});
app.use('/api/auth/login', authLimiter);

// ===== DATABASE =====
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Error:', err.message);
        process.exit(1);
    });

// ===== ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teachers', require('./routes/teacher'));
app.use('/api/students', require('./routes/student'));
app.use('/api/parents', require('./routes/parent'));
app.use('/api/classes', require('./routes/class'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/messages', require('./routes/message'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/notifications', require('./routes/notification'));

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🕌 Al-Noor Quran Academy API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ===== SOCKET.IO LOGIC =====
require('./config/socket')(io);

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, server, io };