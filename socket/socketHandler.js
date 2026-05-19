const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) return next(new Error('Auth required'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (!user) return next(new Error('User not found'));
            socket.userId = user._id.toString();
            socket.userRole = user.role;
            socket.userName = user.name;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    const onlineUsers = new Map();

    io.on('connection', (socket) => {
        console.log(`🟢 Connected: ${socket.userName} [${socket.userRole}]`);

        onlineUsers.set(socket.userId, { userId: socket.userId, name: socket.userName, role: socket.userRole });
        socket.join(`user_${socket.userId}`);
        if (socket.userRole === 'parent') socket.join(`parent_${socket.userId}`);
        if (socket.userRole === 'teacher') socket.join(`teacher_${socket.userId}`);

        io.emit('users_online', Array.from(onlineUsers.values()));

        socket.on('join_class', (classId) => {
            socket.join(`class_${classId}`);
            socket.to(`class_${classId}`).emit('user_joined_class', { userId: socket.userId, name: socket.userName });
        });

        socket.on('leave_class', (classId) => {
            socket.leave(`class_${classId}`);
            socket.to(`class_${classId}`).emit('user_left_class', { userId: socket.userId });
        });

        socket.on('typing', ({ receiverId }) => {
            socket.to(`user_${receiverId}`).emit('user_typing', { userId: socket.userId, name: socket.userName });
        });

        socket.on('stop_typing', ({ receiverId }) => {
            socket.to(`user_${receiverId}`).emit('user_stop_typing', { userId: socket.userId });
        });

        socket.on('send_message', (data) => {
            io.to(`user_${data.receiverId}`).emit('new_message', { ...data, senderId: socket.userId, senderName: socket.userName });
        });

        socket.on('disconnect', () => {
            console.log(`🔴 Disconnected: ${socket.userName}`);
            onlineUsers.delete(socket.userId);
            io.emit('users_online', Array.from(onlineUsers.values()));
        });
    });
};