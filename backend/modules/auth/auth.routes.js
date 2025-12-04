const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('../../core/middleware/auth.middleware');

router.post('/pre-verify-email', authController.preVerifyEmail.bind(authController));
router.post('/pre-verify-email/verify', authController.verifyEmailCode.bind(authController));
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.get('/profile', requireAuth, authController.getProfile.bind(authController));
router.put('/profile', requireAuth, authController.updateProfile.bind(authController));
router.delete('/account', requireAuth, authController.deleteAccount.bind(authController));

module.exports = router;

