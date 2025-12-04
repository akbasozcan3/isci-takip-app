const path = require('path');
const db = require('../config/database');

console.log('🗑️  TÜM KULLANICI VERİLERİ SİLİNİYOR...\n');

const beforeStats = {
  users: Object.keys(db.data.users || {}).length,
  tokens: Object.keys(db.data.tokens || {}).length,
  emailPasswords: Object.keys(db.data.emailPasswords || {}).length,
  emailVerifications: Object.keys(db.data.emailVerifications || {}).length,
  passwordResetTokens: Object.keys(db.data.passwordResetTokens || {}).length,
  groups: Object.keys(db.data.groups || {}).length,
  groupMembers: Object.keys(db.data.groupMembers || {}).length,
  groupRequests: Object.keys(db.data.groupRequests || {}).length,
  store: Object.keys(db.data.store || {}).length,
  billingEvents: Object.keys(db.data.billingEvents || {}).length,
  notifications: Object.keys(db.data.notifications || {}).length
};

console.log('📊 Silinmeden önce:');
console.log(`   - Kullanıcılar: ${beforeStats.users}`);
console.log(`   - Aktif tokenlar: ${beforeStats.tokens}`);
console.log(`   - E-posta şifreleri: ${beforeStats.emailPasswords}`);
console.log(`   - E-posta doğrulamaları: ${beforeStats.emailVerifications}`);
console.log(`   - Şifre sıfırlama tokenları: ${beforeStats.passwordResetTokens}`);
console.log(`   - Gruplar: ${beforeStats.groups}`);
console.log(`   - Grup üyeleri: ${beforeStats.groupMembers}`);
console.log(`   - Grup istekleri: ${beforeStats.groupRequests}`);
console.log(`   - Konum verileri (store): ${beforeStats.store}`);
console.log(`   - Faturalama olayları: ${beforeStats.billingEvents}`);
console.log(`   - Bildirimler: ${beforeStats.notifications}\n`);

// Tüm kullanıcı verilerini temizle
db.data.users = {};
db.data.tokens = {};
db.data.emailPasswords = {};
db.data.emailVerifications = {};
db.data.emailResets = {};
db.data.passwordResetTokens = {};
db.data.resendMeta = {};

// Grup verilerini temizle
db.data.groups = {};
db.data.groupMembers = {};
db.data.groupRequests = {};

// Konum verilerini temizle
db.data.store = {};

// Faturalama ve bildirimleri temizle
db.data.billingEvents = {};
db.data.notifications = {};

// Articles ve diğer sistem verilerini koru (içerik verileri)

db.save();

console.log('✅ TÜM KULLANICI VERİLERİ SİLİNDİ!\n');
console.log('📊 Şu anki durum:');
console.log(`   - Kullanıcılar: ${Object.keys(db.data.users).length}`);
console.log(`   - Aktif tokenlar: ${Object.keys(db.data.tokens).length}`);
console.log(`   - Gruplar: ${Object.keys(db.data.groups).length}`);
console.log(`   - Konum verileri: ${Object.keys(db.data.store).length}`);
console.log(`   - Articles (korundu): ${Object.keys(db.data.articles || {}).length}\n`);

console.log('✅ Veritabanı sıfırlandı! Backend\'i yeniden başlatabilirsiniz.');

process.exit(0);

