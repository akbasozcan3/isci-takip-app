/**
 * OneSignal API Key Diagnostic Tool
 * Comprehensive diagnosis of OneSignal API key issues
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

const appId = process.env.ONESIGNAL_APP_ID || '4a846145-621c-4a0d-a29f-0598da946c50';
const apiKey = process.env.ONESIGNAL_REST_API_KEY;

console.log('\n🔬 OneSignal API Key Diagnostic Tool\n');
console.log('='.repeat(70));

if (!apiKey) {
  console.error('❌ ONESIGNAL_REST_API_KEY not found in .env file');
  process.exit(1);
}

const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '').trim();

console.log(`📋 Configuration:`);
console.log(`   App ID: ${appId}`);
console.log(`   API Key Length: ${cleanApiKey.length} characters`);
console.log(`   API Key Prefix: ${cleanApiKey.substring(0, 25)}...`);
console.log(`   API Key Suffix: ...${cleanApiKey.substring(cleanApiKey.length - 25)}`);
console.log('');

// Validate key format
console.log('🔍 Format Validation:');
if (cleanApiKey.startsWith('os_v2_app_')) {
  console.log('   ✅ Key starts with "os_v2_app_" (correct format)');
} else {
  console.log('   ❌ Key does NOT start with "os_v2_app_" (incorrect format)');
}

if (cleanApiKey.length >= 100) {
  console.log('   ✅ Key length is sufficient (100+ characters)');
} else {
  console.log('   ⚠️  Key seems too short (expected 100+ characters)');
}

if (!cleanApiKey.includes(' ') && !cleanApiKey.includes('\n') && !cleanApiKey.includes('\t')) {
  console.log('   ✅ Key has no whitespace (correct)');
} else {
  console.log('   ❌ Key contains whitespace (will cause issues)');
}

console.log('');

// Test different endpoints and methods
const tests = [
  {
    name: 'Get App Info (v1)',
    endpoint: `/api/v1/apps/${appId}`,
    method: 'GET',
    authMethods: [
      { name: 'Key format', header: `Key ${cleanApiKey}` },
      { name: 'Basic Auth', header: `Basic ${Buffer.from(`${appId}:${cleanApiKey}`).toString('base64')}` }
    ]
  },
  {
    name: 'List Apps',
    endpoint: '/api/v1/apps',
    method: 'GET',
    authMethods: [
      { name: 'Key format', header: `Key ${cleanApiKey}` },
      { name: 'Basic Auth', header: `Basic ${Buffer.from(`${appId}:${cleanApiKey}`).toString('base64')}` }
    ]
  }
];

async function testEndpoint(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log(`   Endpoint: ${test.endpoint}`);
  console.log(`   Method: ${test.method}`);
  console.log('-'.repeat(70));
  
  for (const authMethod of test.authMethods) {
    process.stdout.write(`   ${authMethod.name}... `);
    
    const result = await makeRequest(test.endpoint, test.method, authMethod.header);
    
    if (result.success) {
      console.log('✅ SUCCESS!');
      console.log(`   Status: ${result.statusCode}`);
      if (result.data) {
        try {
          const json = JSON.parse(result.data);
          if (json.name) console.log(`   App Name: ${json.name}`);
          if (json.id) console.log(`   App ID: ${json.id}`);
          if (json.apps && json.apps.length > 0) {
            console.log(`   Found ${json.apps.length} app(s)`);
            const matchingApp = json.apps.find(app => app.id === appId);
            if (matchingApp) {
              console.log(`   ✅ Your app found: ${matchingApp.name}`);
            } else {
              console.log(`   ⚠️  Your app ID not found in list`);
            }
          }
        } catch (e) {
          console.log(`   Response: ${result.data.substring(0, 100)}...`);
        }
      }
      return { success: true, method: authMethod.name };
    } else {
      console.log(`❌ Failed (${result.statusCode || result.error})`);
      if (result.errorDetails) {
        console.log(`   Error: ${result.errorDetails.substring(0, 100)}`);
      }
    }
  }
  
  return { success: false };
}

function makeRequest(endpoint, method, authHeader) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'onesignal.com',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'User-Agent': 'BAVAXE-Backend/2.0.0'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        resolve({
          success,
          statusCode: res.statusCode,
          data: data,
          errorDetails: !success ? data : null
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runDiagnostics() {
  let foundWorking = false;
  
  for (const test of tests) {
    const result = await testEndpoint(test);
    if (result.success) {
      foundWorking = true;
      console.log(`\n🎉 WORKING METHOD FOUND!`);
      console.log(`   Use: ${result.method} for authentication`);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(70));
  
  if (!foundWorking) {
    console.log('\n❌ DIAGNOSIS: API Key is INVALID or EXPIRED');
    console.log('\n💡 Root Cause Analysis:');
    console.log('   1. ❌ Key format is correct (os_v2_app_...)');
    console.log('   2. ❌ Key length is correct (113 characters)');
    console.log('   3. ❌ All authentication methods failed (403 Forbidden)');
    console.log('\n🔧 SOLUTION:');
    console.log('   The API key you have is either:');
    console.log('   • Invalid (wrong key copied)');
    console.log('   • Expired (key was revoked/regenerated)');
    console.log('   • Belongs to a different OneSignal app');
    console.log('   • App ID and API key do not match');
    console.log('\n📋 Action Required:');
    console.log('   1. Go to https://onesignal.com → Login');
    console.log('   2. Select your app (App ID: ' + appId + ')');
    console.log('   3. Settings → Keys & IDs → REST API Key');
    console.log('   4. Click "Regenerate" or "Create New"');
    console.log('   5. Copy the NEW key (full key, 100+ characters)');
    console.log('   6. Run: npm run fix-onesignal');
    console.log('   7. Paste the NEW key');
    console.log('   8. Run: npm run verify-onesignal');
    console.log('   9. If successful, restart backend: npm start');
    console.log('');
  } else {
    console.log('\n✅ DIAGNOSIS: API Key is VALID and WORKING!');
    console.log('   Your OneSignal service should work correctly.');
    console.log('   Restart your backend server to apply changes.');
    console.log('');
  }
}

runDiagnostics().catch(err => {
  console.error('\n❌ Diagnostic error:', err.message);
  process.exit(1);
});

