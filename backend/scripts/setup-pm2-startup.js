const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 PM2 Startup Script Kurulumu');
console.log('================================\n');

try {
  console.log('[1/3] PM2 startup script oluşturuluyor...');
  
  if (process.platform === 'win32') {
    console.log('⚠️  Windows için manuel kurulum gerekli:');
    console.log('   1. PM2 ile servisleri başlat: npm run start:prod');
    console.log('   2. PM2 save: pm2 save');
    console.log('   3. Windows Task Scheduler ile otomatik başlatma ayarla');
  } else {
    const output = execSync('pm2 startup', { encoding: 'utf-8' });
    console.log(output);
    console.log('\n[2/3] Mevcut PM2 process\'leri kaydediliyor...');
    execSync('pm2 save', { stdio: 'inherit' });
    console.log('\n✅ PM2 startup script kuruldu!');
    console.log('   Sistem yeniden başlatıldığında servisler otomatik başlayacak.');
  }
} catch (error) {
  console.error('❌ Hata:', error.message);
  console.log('\nManuel kurulum için:');
  console.log('  pm2 startup');
  console.log('  pm2 save');
  process.exit(1);
}

