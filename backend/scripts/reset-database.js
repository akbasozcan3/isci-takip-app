const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data.json');

const defaultData = {
  users: {},
  tokens: {},
  emailPasswords: {},
  emailVerifications: {},
  emailResets: {},
  passwordResetTokens: {},
  resendMeta: {},
  store: {},
  articles: {},
  notifications: {},
  billingEvents: {},
  receipts: {},
  groups: {},
  groupMembers: {},
  groupRequests: {},
  locationShares: {},
  liveLocations: {},
  familyMembers: {},
  deliveries: {},
  routes: {},
  pageShares: {},
  steps: {},
  activities: [],
  transactions: []
};

fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2), 'utf8');
console.log('✅ Database sıfırlandı - Tüm kullanıcı verileri silindi');
