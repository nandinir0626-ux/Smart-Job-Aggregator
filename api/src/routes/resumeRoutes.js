const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const { authenticate } = require('../middleware/auth');
const uploadResume = require('../middleware/upload');

router.post('/', authenticate, uploadResume.single('resume'), resumeController.uploadResume);
router.get('/latest', authenticate, resumeController.getLatestResume);
router.put('/latest', authenticate, resumeController.updateResumeParsed);

module.exports = router;
