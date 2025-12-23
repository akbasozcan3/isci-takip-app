const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// Public route
router.post('/', contactController.submitContact);

// Admin route
router.get('/all', contactController.getAllMessages);

module.exports = router;
