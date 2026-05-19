const express = require('express');
const router = express.Router();

// This project currently mounts class routes from ./routes/class.js
// but the repository may also contain ./routes/classes.js.
// We re-export the existing implementation if available.

try {
  const classes = require('./classes');
  router.use('/', classes);
} catch (e) {
  // Fallback: keep server bootable even if classes route is missing.
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Class routes not implemented (missing ./routes/classes.js)'
    });
  });
}

module.exports = router;

