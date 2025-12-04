const { execSync } = require('child_process');

function checkPM2Process(name) {
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf-8' });
    const processes = JSON.parse(output);
    return processes.find(p => p.name === name && p.pm2_env.status === 'online');
  } catch (error) {
    return null;
  }
}

function startPM2Process(name) {
  try {
    console.log(`🔄 ${name} başlatılıyor...`);
    execSync(`pm2 start ecosystem.config.js --only ${name}`, { 
      stdio: 'pipe', 
      cwd: __dirname + '/..',
      windowsHide: true
    });
    return true;
  } catch (error) {
    console.error(`❌ ${name} başlatılamadı:`, error.message);
    return false;
  }
}

console.log('🔍 PM2 Process Kontrolü');
console.log('========================\n');

const apiProcess = checkPM2Process('isci-takip-api');
const emailProcess = checkPM2Process('email-service');

let needsRestart = false;

if (!apiProcess) {
  console.log('⚠️  isci-takip-api çalışmıyor');
  needsRestart = true;
} else {
  console.log('✅ isci-takip-api çalışıyor (PID: ' + apiProcess.pid + ')');
}

if (!emailProcess) {
  console.log('⚠️  email-service çalışmıyor');
  needsRestart = true;
} else {
  console.log('✅ email-service çalışıyor (PID: ' + emailProcess.pid + ')');
}

if (needsRestart) {
  console.log('\n🔄 Eksik servisler başlatılıyor...\n');
  if (!apiProcess) startPM2Process('isci-takip-api');
  if (!emailProcess) startPM2Process('email-service');
  console.log('\n✅ Tüm servisler çalışıyor!');
} else {
  console.log('\n✅ Tüm servisler çalışıyor!');
}

