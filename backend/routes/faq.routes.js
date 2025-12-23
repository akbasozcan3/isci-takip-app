const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');

// Public routes
router.get('/', faqController.getAllFAQs);

// Admin routes (add authentication middleware later)
router.post('/', faqController.createFAQ);
router.put('/:id', faqController.updateFAQ);
router.delete('/:id', faqController.deleteFAQ);

module.exports = router;
