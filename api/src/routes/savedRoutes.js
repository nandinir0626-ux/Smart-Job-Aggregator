const express = require('express');
const router = express.Router();
const savedController = require('../controllers/savedController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, savedController.saveJob);
router.get('/', authenticate, savedController.getSavedJobs);
router.patch('/:id', authenticate, savedController.updateSavedJob);
router.delete('/:id', authenticate, savedController.deleteSavedJob);

module.exports = router;
