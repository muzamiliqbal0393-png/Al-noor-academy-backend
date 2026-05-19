// routes/progress.js
const express = require('express');
const router = express.Router();
const { getProgress, getMonthlyReport, updateProgress } = require('../controllers/progressController');
const { protect, authorize } = require('../middleware/auth');
router.use(protect);
router.get('/:childId', getProgress);
router.get('/:childId/report/:month/:year', getMonthlyReport);
router.post('/:childId', authorize('teacher', 'admin'), updateProgress);
module.exports = router;