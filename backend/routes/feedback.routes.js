const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// Public route
router.post('/', feedbackController.submitFeedback);

// Admin route
router.get('/all', feedbackController.getAllFeedback);

module.exports = router;
