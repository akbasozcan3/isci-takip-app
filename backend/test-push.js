// OneSignal Push Notification Test Script
// Kullanım: node test-push.js

const https = require('https');

const ONESIGNAL_APP_ID = '4a846145-621c-4a0d-a29f-0598da946c50';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

if (!ONESIGNAL_REST_API_KEY) {
  console.error('❌ ONESIGNAL_REST_API_KEY environment variable bulunamadı!');
  console.log('💡 .env dosyasına ONESIGNAL_REST_API_KEY ekleyin');
  process.exit(1);
}

// Test bildirimi gönder
const sendTestNotification = () => {
  const notification = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: '🎉 Test Bildirimi' },
    contents: { en: 'Backend\'den gönderilen test bildirimi başarılı!' },
    included_segments: ['All'],
    data: {
      deepLink: 'bavaxe://home',
      type: 'test'
    }
  };

  const authHeader = Buffer.from(`${ONESIGNAL_REST_API_KEY}:`).toString('base64');
  
  const options = {
    hostname: 'onesignal.com',
    port: 443,
    path: '/api/v1/notifications',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authHeader}`
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Bildirim başarıyla gönderildi!');
          console.log('📊 Response:', JSON.stringify(parsed, null, 2));
          console.log(`\n🔗 OneSignal Dashboard: https://dashboard.onesignal.com/apps/${ONESIGNAL_APP_ID}/push`);
        } else {
          console.error('❌ Hata:', parsed);
        }
      } catch (error) {
        console.error('❌ Response parse hatası:', error.message);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request hatası:', error.message);
  });

  req.write(JSON.stringify(notification));
  req.end();
};

console.log('🚀 OneSignal Test Bildirimi Gönderiliyor...\n');
sendTestNotification();

