// Compatibility shim
// Some routes import ../utils/email, while the actual implementation lives in ../utils/sendEmail.js.
// This file re-exports sendEmail as `sendEmail` to keep server bootable.

module.exports = require('./sendEmail');

