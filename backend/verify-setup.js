const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
} else {
  console.log('❌ .env dosyası bulunamadı!');
  process.exit(1);
}

const correctAppId = '4a846145-621c-4a0d-a29f-0598da946c50';
const correctApiKey = 'os_v2_app_jkcgcrlcdrfa3iu7awmnvfdmkcctfawalebefpvzgzqmeqr6i366rzjtwoznrcj4f733oxeaavwcxvyh6b63d6w36wl2i57cc5wjyri';

let appId = '';
let apiKey = '';

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...values] = trimmed.split('=');
    if (key && values.length) {
      const value = values.join('=').trim();
      if (key.trim() === 'ONESIGNAL_APP_ID') {
        appId = value;
      }
      if (key.trim() === 'ONESIGNAL_REST_API_KEY') {
        apiKey = value;
      }
    }
  }
});

console.log('\n🔍 OneSignal Yapılandırma Kontrolü\n');
console.log('='.repeat(50));

if (!appId || appId !== correctAppId) {
  console.log('⚠️  ONESIGNAL_APP_ID eksik veya yanlış!');
  console.log(`   Mevcut: ${appId || 'YOK'}`);
  console.log(`   Olması gereken: ${correctAppId}`);
  envContent = envContent.replace(/ONESIGNAL_APP_ID=.*/g, '');
  envContent += `\nONESIGNAL_APP_ID=${correctAppId}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log('✅ ONESIGNAL_APP_ID düzeltildi\n');
} else {
  console.log('✅ ONESIGNAL_APP_ID doğru');
}

if (!apiKey || apiKey === 'YOUR_ONESIGNAL_REST_API_KEY' || apiKey === correctAppId) {
  console.log('⚠️  ONESIGNAL_REST_API_KEY eksik veya yanlış!');
  console.log(`   Mevcut: ${apiKey ? apiKey.substring(0, 30) + '...' : 'YOK'}`);
  console.log(`   Olması gereken: ${correctApiKey.substring(0, 30)}...`);
  envContent = envContent.replace(/ONESIGNAL_REST_API_KEY=.*/g, '');
  envContent += `ONESIGNAL_REST_API_KEY=${correctApiKey}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log('✅ ONESIGNAL_REST_API_KEY düzeltildi\n');
} else {
  console.log('✅ ONESIGNAL_REST_API_KEY doğru');
}

console.log('\n📤 Test bildirimi gönderiliyor...\n');

const notification = {
  app_id: correctAppId,
  headings: { en: '🎉 Test Bildirimi' },
  contents: { en: 'OneSignal entegrasyonu başarıyla çalışıyor! Grup bildirimleri aktif.' },
  included_segments: ['All'],
  data: {
    type: 'test',
    deepLink: 'bavaxe://home'
  }
};

const authHeader = Buffer.from(`${correctApiKey}:`).toString('base64');

const req = https.request({
  hostname: 'onesignal.com',
  port: 443,
  path: '/api/v1/notifications',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${authHeader}`
  },
  timeout: 30000
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`📊 HTTP Status: ${res.statusCode}\n`);
    try {
      const parsed = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log('✅ BAŞARILI! Bildirim gönderildi!');
        console.log(`📱 Notification ID: ${parsed.id}`);
        console.log(`📊 Recipients: ${parsed.recipients || 'N/A'}`);
        console.log('\n📱 Uygulamada bildirimi kontrol edin!');
        console.log(`\n🔗 Dashboard: https://dashboard.onesignal.com/apps/${correctAppId}/notifications`);
      } else {
        console.log('❌ HATA:');
        console.log(JSON.stringify(parsed, null, 2));
        if (parsed.errors) {
          console.log('\n💡 Hata detayları:');
          parsed.errors.forEach(err => console.log(`   - ${err}`));
        }
      }
    } catch (e) {
      console.log('❌ Parse hatası:', e.message);
      console.log('Raw:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request hatası:', e.message);
});

req.on('timeout', () => {
  req.destroy();
  console.error('❌ Request timeout');
});

req.write(JSON.stringify(notification));
req.end();
