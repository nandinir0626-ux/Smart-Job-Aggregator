const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.put('/preferences', authenticate, userController.updatePreferences);

module.exports = router;
