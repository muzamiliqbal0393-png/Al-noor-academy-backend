const express = require('express');
const router = express.Router();

// Compatibility shim.
// server.js mounts ./routes/message, but the repo contains ./routes/messages.
// Re-export the existing routes so the app can boot.

try {
  const messages = require('./messages');
  router.use('/', messages);
} catch (e) {
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Message routes not implemented (missing ./routes/messages.js)'
    });
  });
}

module.exports = router;

