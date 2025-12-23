const { networkInterfaces } = require('os');
const { spawn } = require('child_process');
const path = require('path');

function getLocalIpAddress() {
    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    // Prefer Wi-Fi or Ethernet
    const preferredOrder = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];

    for (const name of preferredOrder) {
        if (results[name] && results[name].length > 0) {
            return results[name][0];
        }
    }

    // Return the first found if no preferred interface matches
    const allIps = Object.values(results).flat();
    return allIps.length > 0 ? allIps[0] : 'localhost';
}

const ipAddress = getLocalIpAddress();
console.log('\x1b[36m%s\x1b[0m', `🚀 Detected Local IP: ${ipAddress}`);
console.log('\x1b[33m%s\x1b[0m', '⚠️  Make sure your phone is connected to the same Wi-Fi network!');

// Set environment variables
const env = {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL: `http://${ipAddress}:4000`,
    EXPO_PUBLIC_DEVICE_IP: ipAddress,
    REACT_NATIVE_PACKAGER_HOSTNAME: ipAddress
};

console.log(`Starting Expo with API Base: ${env.EXPO_PUBLIC_API_BASE_URL}`);

// Run expo start
const expoProcess = spawn('npx', ['expo', 'start', '--clear'], {
    stdio: 'inherit',
    shell: true,
    env: env
});

expoProcess.on('close', (code) => {
    process.exit(code);
});
