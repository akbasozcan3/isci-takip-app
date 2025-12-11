const fs = require('fs');
const path = require('path');

console.log('🔍 Backend Deployment Check\n');

const checks = {
  server: fs.existsSync(path.join(__dirname, 'server.js')),
  packageJson: fs.existsSync(path.join(__dirname, 'package.json')),
  database: fs.existsSync(path.join(__dirname, 'config/database.js')),
  routes: fs.existsSync(path.join(__dirname, 'routes/index.js')),
  logger: fs.existsSync(path.join(__dirname, 'core/utils/logger.js')),
  loggerHelper: fs.existsSync(path.join(__dirname, 'core/utils/loggerHelper.js')),
  dockerfile: fs.existsSync(path.join(__dirname, 'Dockerfile'))
};

let allPassed = true;
for (const [name, exists] of Object.entries(checks)) {
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (!exists) allPassed = false;
}

console.log('\n📦 Checking critical modules...');
try {
  require('./server.js');
  require('./config/database.js');
  require('./routes/index.js');
  require('./core/utils/loggerHelper.js');
  console.log('✅ All critical modules load successfully');
} catch (err) {
  console.error('❌ Module load error:', err.message);
  allPassed = false;
}

console.log('\n🌍 Environment check...');
const requiredEnv = ['JWT_SECRET'];
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
  allPassed = false;
} else if (missing.length > 0) {
  console.warn(`⚠️  Missing env vars (using defaults): ${missing.join(', ')}`);
} else {
  console.log('✅ Environment variables OK');
}

if (allPassed) {
  console.log('\n✅ Backend is ready for deployment');
  process.exit(0);
} else {
  console.log('\n❌ Backend has issues that need to be fixed');
  process.exit(1);
}
