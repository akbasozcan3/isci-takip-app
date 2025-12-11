// OneSignal API Key Test Script
require('dotenv').config();
const onesignalService = require('./services/onesignalService');

async function testOneSignal() {
  console.log('\n🧪 OneSignal API Key Test Başlatılıyor...\n');
  
  // Service status
  const status = onesignalService.getStatus();
  console.log('📊 Service Status:');
  console.log('  - Enabled:', status.enabled);
  console.log('  - App ID:', status.appId);
  console.log('  - API Key Configured:', status.apiKeyConfigured);
  console.log('  - API Key Prefix:', status.apiKeyPrefix);
  console.log('  - Base URL:', status.baseUrl);
  console.log('');
  
  // Test API key
  console.log('🔐 Testing API Key...');
  const testResult = await onesignalService.testApiKey();
  
  if (testResult.success) {
    console.log('\n✅ BAŞARILI! OneSignal API Key çalışıyor.\n');
    console.log('📱 App Info:', JSON.stringify(testResult.data, null, 2));
    process.exit(0);
  } else {
    console.log('\n❌ BAŞARISIZ! OneSignal API Key çalışmıyor.\n');
    console.log('❌ Hata:', testResult.error);
    console.log('\n💡 Çözüm adımları:');
    console.log('  1. OneSignal Dashboard → Settings → Keys & IDs');
    console.log('  2. REST API Key\'i kopyalayın (Key ID değil!)');
    console.log('  3. .env dosyasına yapıştırın: ONESIGNAL_REST_API_KEY=...');
    console.log('  4. Backend\'i yeniden başlatın\n');
    process.exit(1);
  }
}

testOneSignal().catch(error => {
  console.error('\n❌ Test sırasında hata:', error);
  process.exit(1);
});

