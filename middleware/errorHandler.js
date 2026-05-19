module.exports = (err, req, res, next) => {
    let message = err.message || 'Server Error';
    let statusCode = err.statusCode || 500;

    if (err.name === 'CastError') { message = 'Resource not found'; statusCode = 404; }
    if (err.code === 11000) { message = `${Object.keys(err.keyValue)[0]} already exists`; statusCode = 400; }
    if (err.name === 'ValidationError') { message = Object.values(err.errors).map(e => e.message).join(', '); statusCode = 400; }
    if (err.name === 'JsonWebTokenError') { message = 'Invalid token'; statusCode = 401; }

    res.status(statusCode).json({ success: false, message });
};