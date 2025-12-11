/**
 * OneSignal API Key Verification Script
 * Verifies if the API key in .env file is correct
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

const appId = process.env.ONESIGNAL_APP_ID || '4a846145-621c-4a0d-a29f-0598da946c50';
const apiKey = process.env.ONESIGNAL_REST_API_KEY;

console.log('\n🔍 OneSignal API Key Verification\n');
console.log('='.repeat(60));

if (!apiKey) {
  console.error('❌ ONESIGNAL_REST_API_KEY not found in .env file');
  console.error('💡 Add ONESIGNAL_REST_API_KEY=your_key_here to backend/.env');
  process.exit(1);
}

console.log(`📋 App ID: ${appId}`);
console.log(`📋 API Key Length: ${apiKey.length} characters`);
console.log(`📋 API Key Prefix: ${apiKey.substring(0, 20)}...`);
console.log(`📋 API Key Suffix: ...${apiKey.substring(apiKey.length - 20)}`);
console.log('');

// Clean API key
const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '').trim();

if (cleanApiKey !== apiKey) {
  console.warn('⚠️  API Key was cleaned (removed quotes/spaces)');
  console.warn(`   Original: ${apiKey.length} chars → Cleaned: ${cleanApiKey.length} chars\n`);
}

// Test with Key format
console.log('🧪 Testing with "Key" format...');
testKeyFormat(cleanApiKey, appId).then(success => {
  if (success) {
    console.log('\n✅ SUCCESS: API Key is valid!');
    console.log('✅ OneSignal service should work correctly.');
    process.exit(0);
  } else {
    console.log('\n🔄 Key format failed, trying Basic Auth format...');
    testBasicAuth(cleanApiKey, appId).then(basicSuccess => {
      if (basicSuccess) {
        console.log('\n✅ SUCCESS: Basic Auth format works!');
        console.log('⚠️  Note: Your API key works with Basic Auth format.');
        console.log('💡 Consider updating OneSignal service to use Basic Auth.');
        process.exit(0);
      } else {
        console.log('\n❌ FAILED: Both formats failed');
        console.log('\n💡 SOLUTION:');
        console.log('   1. Go to https://onesignal.com');
        console.log('   2. Settings → Keys & IDs');
        console.log('   3. Copy the REST API Key (full key, not truncated)');
        console.log('   4. Update backend/.env: ONESIGNAL_REST_API_KEY=full_key_here');
        console.log('   5. Make sure key has NO quotes, NO spaces');
        console.log('   6. Restart backend server');
        process.exit(1);
      }
    });
  }
}).catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

function testKeyFormat(apiKey, appId) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'onesignal.com',
      port: 443,
      path: `/api/v1/apps/${appId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`,
        'User-Agent': 'BAVAXE-Backend/2.0.0'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('   ✅ Key format works!');
          resolve(true);
        } else {
          console.log(`   ❌ Key format failed (${res.statusCode})`);
          if (res.statusCode === 403) {
            console.log('   💡 API key is invalid or expired');
          }
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      console.log('   ❌ Network error');
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('   ❌ Request timeout');
      resolve(false);
    });

    req.end();
  });
}

function testBasicAuth(apiKey, appId) {
  return new Promise((resolve) => {
    const basicAuth = Buffer.from(`${appId}:${apiKey}`).toString('base64');
    
    const options = {
      hostname: 'onesignal.com',
      port: 443,
      path: `/api/v1/apps/${appId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
        'User-Agent': 'BAVAXE-Backend/2.0.0'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('   ✅ Basic Auth format works!');
          resolve(true);
        } else {
          console.log(`   ❌ Basic Auth format failed (${res.statusCode})`);
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      console.log('   ❌ Network error');
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('   ❌ Request timeout');
      resolve(false);
    });

    req.end();
  });
}

