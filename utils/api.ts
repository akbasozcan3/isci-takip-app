import { Platform } from 'react-native';

// Safe Constants import with fallback
let Constants: any;
try {
  Constants = require('expo-constants').default;
} catch (e) {
  Constants = null;
}

export function getApiBase(): string {
  // FORCE LOCAL ONLY - NO DOMAIN, NO CACHE
  // Android emulator uses 10.0.2.2 to reach host machine's localhost
  if (Platform.OS === 'android') {
    console.log('[API] Using Android emulator localhost: http://10.0.2.2:4000');
    return 'http://10.0.2.2:4000';
  }
  
  // iOS simulator and web use localhost directly
  console.log('[API] Using localhost: http://localhost:4000');
  return 'http://localhost:4000';
}

// Base URL for PHP API (PHPMailer service)
// Priority: EXPO_PUBLIC_PHP_API_BASE -> extra.phpApiBaseDev (dev) / extra.phpApiBase -> fallback to getApiBase()
// Removed legacy PHP mailer API base (no longer used)


