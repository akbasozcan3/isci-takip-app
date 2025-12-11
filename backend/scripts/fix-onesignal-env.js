/**
 * OneSignal .env File Fixer
 * Helps fix common issues with OneSignal API key in .env file
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envPath = path.join(__dirname, '../.env');

console.log('\n🔧 OneSignal .env File Fixer\n');
console.log('='.repeat(60));

// Check if .env file exists
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  console.error('💡 Create .env file first or check the path');
  process.exit(1);
}

// Read current .env file
let envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

// Find ONESIGNAL_REST_API_KEY line
let onesignalKeyLine = -1;
let currentKey = '';

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim().startsWith('ONESIGNAL_REST_API_KEY=')) {
    onesignalKeyLine = i;
    const match = lines[i].match(/ONESIGNAL_REST_API_KEY=(.+)/);
    if (match) {
      currentKey = match[1].trim().replace(/^["']|["']$/g, '');
      
      // Detect if key is clearly wrong (contains commands, spaces, etc.)
      if (currentKey.includes('npm') || currentKey.includes('run') || 
          currentKey.includes('test') || currentKey.includes(' ') ||
          currentKey.length < 20) {
        console.warn('⚠️  DETECTED INVALID KEY FORMAT!');
        console.warn('   Current value appears to be a command or invalid key');
        console.warn(`   Found: "${currentKey.substring(0, 50)}${currentKey.length > 50 ? '...' : ''}"`);
        console.warn('   This will be replaced with the correct key.\n');
        currentKey = ''; // Treat as empty to force replacement
      }
    }
    break;
  }
}

if (onesignalKeyLine === -1) {
  console.log('⚠️  ONESIGNAL_REST_API_KEY not found in .env file');
  console.log('💡 Adding new line...');
  
  // Add new line
  if (!envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += 'ONESIGNAL_REST_API_KEY=\n';
  onesignalKeyLine = lines.length;
  currentKey = '';
} else {
  console.log('📋 Current API Key found:');
  console.log(`   Length: ${currentKey.length} characters`);
  console.log(`   Prefix: ${currentKey.substring(0, 20)}...`);
  console.log(`   Suffix: ...${currentKey.substring(Math.max(0, currentKey.length - 20))}`);
  console.log('');
  
  // Check for common issues
  if (currentKey.length < 100) {
    console.warn('⚠️  WARNING: API Key seems too short (expected 100+ characters)');
  }
  
  if (currentKey.includes('"') || currentKey.includes("'")) {
    console.warn('⚠️  WARNING: API Key contains quotes - this will cause issues');
  }
  
  if (currentKey.startsWith(' ') || currentKey.endsWith(' ')) {
    console.warn('⚠️  WARNING: API Key has leading/trailing spaces');
  }
}

console.log('\n📝 Instructions:');
console.log('1. Go to https://onesignal.com → Your App');
console.log('2. Settings → Keys & IDs → REST API Key');
console.log('3. Click "Copy" button (copy the FULL key)');
console.log('4. Paste the key below (Ctrl+V, then Enter)');
console.log('5. Press Enter twice when done\n');

rl.question('Paste your OneSignal REST API Key here: ', (newKey) => {
  let cleanedKey = newKey.trim().replace(/^["']|["']$/g, '').trim();
  
  // Remove any accidental command text
  if (cleanedKey.includes('npm') || cleanedKey.includes('run')) {
    console.warn('\n⚠️  WARNING: Detected command text in key. Cleaning...');
    // Try to extract just the key part
    const keyMatch = cleanedKey.match(/os_v2_app_[a-zA-Z0-9_]+/);
    if (keyMatch) {
      cleanedKey = keyMatch[0];
      console.warn(`   Extracted key: ${cleanedKey.substring(0, 30)}...`);
    } else {
      console.error('\n❌ Could not extract valid key from input.');
      console.error('   Please paste ONLY the API key (starts with os_v2_app_)');
      rl.close();
      process.exit(1);
    }
  }
  
  if (!cleanedKey) {
    console.error('\n❌ No key provided. Exiting...');
    rl.close();
    process.exit(1);
  }
  
  if (cleanedKey.length < 50) {
    console.warn('\n⚠️  WARNING: Key seems too short. Make sure you copied the FULL key.');
    console.warn('   Expected: 100+ characters');
    console.warn(`   Got: ${cleanedKey.length} characters`);
  }
  
  if (!cleanedKey.startsWith('os_v2_app_')) {
    console.error('\n❌ ERROR: Key does not start with "os_v2_app_"');
    console.error('   This is likely not a valid OneSignal REST API Key.');
    console.error('   Please check OneSignal dashboard and copy the correct key.');
    rl.close();
    process.exit(1);
  }
  
  // Additional validation
  if (cleanedKey.includes(' ') || cleanedKey.includes('\n') || cleanedKey.includes('\t')) {
    console.warn('\n⚠️  WARNING: Key contains whitespace. Cleaning...');
    cleanedKey = cleanedKey.replace(/\s+/g, '');
  }
  
  // Update the line
  const lines = envContent.split('\n');
  if (onesignalKeyLine < lines.length) {
    lines[onesignalKeyLine] = `ONESIGNAL_REST_API_KEY=${cleanedKey}`;
  } else {
    lines.push(`ONESIGNAL_REST_API_KEY=${cleanedKey}`);
  }
  
  // Write back to file
  const newContent = lines.join('\n');
  fs.writeFileSync(envPath, newContent, 'utf8');
  
  console.log('\n✅ .env file updated successfully!');
  console.log(`   New key length: ${cleanedKey.length} characters`);
  console.log(`   New key prefix: ${cleanedKey.substring(0, 20)}...`);
  console.log('\n💡 Next steps:');
  console.log('   1. Run: npm run verify-onesignal');
  console.log('   2. If verification passes, restart backend: npm start');
  console.log('');
  
  rl.close();
});

