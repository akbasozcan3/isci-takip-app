const path = require('path');
const db = require('../config/database');

console.log('🗑️  Tüm kullanıcılar ve giriş yapılmış hesaplar siliniyor...');

const beforeStats = {
  users: Object.keys(db.data.users || {}).length,
  tokens: Object.keys(db.data.tokens || {}).length,
  emailPasswords: Object.keys(db.data.emailPasswords || {}).length,
  emailVerifications: Object.keys(db.data.emailVerifications || {}).length,
  passwordResetTokens: Object.keys(db.data.passwordResetTokens || {}).length
};

console.log('📊 Silinmeden önce:');
console.log(`   - Kullanıcılar: ${beforeStats.users}`);
console.log(`   - Aktif tokenlar: ${beforeStats.tokens}`);
console.log(`   - E-posta şifreleri: ${beforeStats.emailPasswords}`);
console.log(`   - E-posta doğrulamaları: ${beforeStats.emailVerifications}`);
console.log(`   - Şifre sıfırlama tokenları: ${beforeStats.passwordResetTokens}`);

db.data.users = {};
db.data.tokens = {};
db.data.emailPasswords = {};
db.data.emailVerifications = {};
db.data.emailResets = {};
db.data.passwordResetTokens = {};
db.data.resendMeta = {};

db.save();

console.log('✅ Tüm kullanıcılar ve giriş verileri silindi!');
console.log('📊 Şu anki durum:');
console.log(`   - Kullanıcılar: ${Object.keys(db.data.users).length}`);
console.log(`   - Aktif tokenlar: ${Object.keys(db.data.tokens).length}`);

process.exit(0);

