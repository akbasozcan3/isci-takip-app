const emailVerificationService = require('./emailVerificationService');

async function sendResetLink(email, resetLink, token) {
  try {
    await emailVerificationService.sendResetLinkEmail(email, resetLink, token);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function sendResetCode(email, code) {
  try {
    await emailVerificationService.sendVerificationEmail(email, code);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function sendEmail(payload) {
  if (payload.code) {
    return await sendResetCode(payload.email || payload.to, payload.code);
  }
  if (payload.resetLink) {
    return await sendResetLink(payload.email || payload.to, payload.resetLink, payload.token);
  }
  return { ok: false, error: 'Invalid email payload' };
}

module.exports = {
  sendResetCode,
  sendResetLink,
  sendEmail
};
