const express = require('express');
const router = express.Router();

// Compatibility shim.
// server.js mounts ./routes/payment, but the repo contains ./routes/payments.

try {
  const payments = require('./payments');
  router.use('/', payments);
} catch (e) {
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Payment routes not implemented (missing ./routes/payments.js)'
    });
  });
}

module.exports = router;

