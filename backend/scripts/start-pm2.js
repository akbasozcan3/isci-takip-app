const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '..');

console.log('🚀 Starting backend with PM2...');
console.log(`📁 Backend directory: ${backendDir}`);

try {
  process.chdir(backendDir);
  
  console.log('🛑 Stopping existing PM2 processes...');
  try {
    execSync('pm2 stop all', { stdio: 'inherit' });
    execSync('pm2 delete all', { stdio: 'inherit' });
  } catch (e) {
    console.log('No existing PM2 processes to stop');
  }
  
  console.log('📦 Starting PM2 ecosystem...');
  execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
  
  console.log('💾 Saving PM2 configuration...');
  execSync('pm2 save', { stdio: 'inherit' });
  
  console.log('📊 PM2 Status:');
  execSync('pm2 status', { stdio: 'inherit' });
  
  console.log('\n✅ Backend started successfully with PM2!');
  console.log('📝 View logs: pm2 logs');
  console.log('📊 Monitor: pm2 monit');
  console.log('🛑 Stop: pm2 stop all');
} catch (error) {
  console.error('❌ Error starting PM2:', error.message);
  process.exit(1);
}

