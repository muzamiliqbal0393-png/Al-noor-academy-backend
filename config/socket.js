// Compatibility shim: older server.js expects ./config/socket
// The repo actually has backend/socket/socketHandler.js

module.exports = require('../socket/socketHandler');

