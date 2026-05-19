const express = require('express');
const router = express.Router();

// Compatibility shim.
// server.js mounts ./routes/notification, but the repo contains ./routes/notifications.

try {
  const notifications = require('./notifications');
  router.use('/', notifications);
} catch (e) {
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Notification routes not implemented (missing ./routes/notifications.js)'
    });
  });
}

module.exports = router;

