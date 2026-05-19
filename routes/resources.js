
// routes/resources.js
const express4 = require('express');
const router4 = express4.Router();
const { getResources, createResource, updateResource, deleteResource, downloadResource } = require('../controllers/resourceController');
const { protect: p4, authorize: a4 } = require('../middleware/auth');
router4.use(p4);
router4.route('/').get(getResources).post(a4('teacher', 'admin'), createResource);
router4.route('/:id').put(a4('teacher', 'admin'), updateResource).delete(a4('admin'), deleteResource);
router4.post('/:id/download', downloadResource);
module.exports = router4;