const express = require('express');
const router = express.Router();
const {
    getChildren, getChild, addChild,
    updateChild, deleteChild, getChildStats
} = require('../controllers/childController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getChildren).post(authorize('parent', 'admin'), addChild);
router.route('/:id').get(getChild).put(updateChild).delete(deleteChild);
router.get('/:id/stats', getChildStats);

module.exports = router;