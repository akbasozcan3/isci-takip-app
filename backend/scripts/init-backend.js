const fs = require('fs');
const path = require('path');

const requiredDirs = [
  'logs',
  'backups'
];

console.log('🔧 Backend initialization...');

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`✓ Directory exists: ${dir}`);
  }
});

const dataFile = path.join(__dirname, '..', 'data.json');
if (!fs.existsSync(dataFile)) {
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
    groups: {},
    groupMembers: {},
    groupRequests: {}
  };
  fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2), 'utf8');
  console.log('✅ Created data.json');
} else {
  console.log('✓ data.json exists');
}

console.log('✅ Backend initialization complete!');

