/**
 * OneSignal API Authentication Test Script
 * Tests different authentication methods to find the correct one
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

const appId = process.env.ONESIGNAL_APP_ID || '4a846145-621c-4a0d-a29f-0598da946c50';
const apiKey = process.env.ONESIGNAL_REST_API_KEY;

console.log('\n🧪 OneSignal API Authentication Test\n');
console.log('='.repeat(60));

if (!apiKey) {
  console.error('❌ ONESIGNAL_REST_API_KEY not found in .env file');
  process.exit(1);
}

const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '').trim();

console.log(`📋 App ID: ${appId}`);
console.log(`📋 API Key Length: ${cleanApiKey.length} characters`);
console.log(`📋 API Key Prefix: ${cleanApiKey.substring(0, 20)}...`);
console.log('');

// Test different authentication methods
const tests = [
  {
    name: 'Method 1: Key format (v2)',
    auth: `Key ${cleanApiKey}`,
    endpoint: `/apps/${appId}`
  },
  {
    name: 'Method 2: Basic Auth (app_id:api_key)',
    auth: `Basic ${Buffer.from(`${appId}:${cleanApiKey}`).toString('base64')}`,
    endpoint: `/apps/${appId}`
  },
  {
    name: 'Method 3: Basic Auth (api_key only)',
    auth: `Basic ${Buffer.from(cleanApiKey).toString('base64')}`,
    endpoint: `/apps/${appId}`
  },
  {
    name: 'Method 4: Bearer format',
    auth: `Bearer ${cleanApiKey}`,
    endpoint: `/apps/${appId}`
  }
];

// Also test different base URLs
const baseUrls = [
  'https://onesignal.com/api/v1',
  'https://api.onesignal.com/v1',
  'https://onesignal.com/api/v2'
];

async function testAuth(baseUrl, test) {
  return new Promise((resolve) => {
    const url = new URL(`${baseUrl}${test.endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': test.auth,
        'User-Agent': 'BAVAXE-Backend/2.0.0'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const result = {
          success: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          data: data,
          baseUrl: baseUrl,
          method: test.name
        };
        resolve(result);
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        baseUrl: baseUrl,
        method: test.name
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout',
        baseUrl: baseUrl,
        method: test.name
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 Testing different authentication methods...\n');
  
  let successCount = 0;
  let foundWorking = false;

  for (const baseUrl of baseUrls) {
    console.log(`\n📍 Testing base URL: ${baseUrl}`);
    console.log('-'.repeat(60));
    
    for (const test of tests) {
      process.stdout.write(`   Testing ${test.name}... `);
      
      const result = await testAuth(baseUrl, test);
      
      if (result.success) {
        console.log('✅ SUCCESS!');
        console.log(`   Status: ${result.statusCode}`);
        console.log(`   Response: ${result.data.substring(0, 100)}...`);
        successCount++;
        
        if (!foundWorking) {
          foundWorking = true;
          console.log('\n🎉 FOUND WORKING METHOD!');
          console.log(`   Base URL: ${result.baseUrl}`);
          console.log(`   Method: ${result.method}`);
          console.log(`   Auth Header: ${test.auth.substring(0, 50)}...`);
          console.log('\n💡 Update your OneSignal service to use this method.');
        }
      } else {
        if (result.statusCode) {
          console.log(`❌ Failed (${result.statusCode})`);
        } else {
          console.log(`❌ Failed (${result.error || 'Unknown error'})`);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${successCount} successful method(s) found`);
  
  if (!foundWorking) {
    console.log('\n❌ No working authentication method found');
    console.log('\n💡 Possible issues:');
    console.log('   1. API key is invalid or expired');
    console.log('   2. App ID does not match the API key');
    console.log('   3. API key has been revoked in OneSignal dashboard');
    console.log('   4. OneSignal API endpoint or format has changed');
    console.log('\n🔧 Solution:');
    console.log('   1. Go to https://onesignal.com → Your App');
    console.log('   2. Settings → Keys & IDs');
    console.log('   3. Generate a NEW REST API Key');
    console.log('   4. Copy the FULL key (100+ characters)');
    console.log('   5. Update backend/.env: ONESIGNAL_REST_API_KEY=new_key');
    console.log('   6. Run this test again: npm run test-onesignal-auth');
  } else {
    console.log('\n✅ At least one authentication method works!');
    console.log('💡 Update your OneSignal service code to use the working method.');
  }
  
  console.log('');
}

runTests().catch(err => {
  console.error('\n❌ Test error:', err.message);
  process.exit(1);
});

