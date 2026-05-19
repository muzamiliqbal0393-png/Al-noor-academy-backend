// routes/achievements.js
const express2 = require('express');
const router2 = express2.Router();
const { getAchievements, awardAchievement, deleteAchievement } = require('../controllers/achievementController');
const { protect: p, authorize: a } = require('../middleware/auth');
router2.use(p);
router2.get('/', getAchievements);
router2.post('/', a('teacher', 'admin'), awardAchievement);
router2.delete('/:id', a('teacher', 'admin'), deleteAchievement);
module.exports = router2;
