const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');


const {
    getStudentDashboard,
    getStudentProgress,
    getStudentClasses,
    getStudentAchievements,
    getStudentStreak,

    getLeaderboard,
    getStudentHomework,
    completeHomework
} = require('../controllers/studentController');

router.use(protect);

router.get('/dashboard', getStudentDashboard);
router.get('/progress/:childId', getStudentProgress);
router.get('/classes/:childId', getStudentClasses);
router.get('/achievements/:childId', getStudentAchievements);
router.get('/streak/:childId', getStudentStreak);

router.get('/leaderboard', getLeaderboard);
router.get('/homework/:childId', getStudentHomework);
router.put('/homework/:classId/complete', completeHomework);

module.exports = router;