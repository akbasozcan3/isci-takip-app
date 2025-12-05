const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const goServiceDir = __dirname;
const exePath = path.join(goServiceDir, 'main.exe');
const goPath = path.join(goServiceDir, 'main.go');

function findGoBinary() {
  const commonPaths = [
    'C:\\Program Files\\Go\\bin\\go.exe',
    'C:\\Go\\bin\\go.exe',
    path.join(process.env.USERPROFILE || '', 'go', 'bin', 'go.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Go', 'bin', 'go.exe')
  ];
  
  for (const goPath of commonPaths) {
    if (fs.existsSync(goPath)) {
      return goPath;
    }
  }
  
  try {
    const { execSync } = require('child_process');
    const result = execSync('where go', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (result.trim()) {
      return result.trim().split('\n')[0];
    }
  } catch (e) {}
  
  return 'go';
}

const goBinary = findGoBinary();

if (!fs.existsSync(exePath)) {
  try {
    const { execSync } = require('child_process');
    console.log('Go mod downloading...');
    execSync(`${goBinary} mod download`, { 
      cwd: goServiceDir, 
      stdio: 'inherit',
      env: { ...process.env, PORT: process.env.PORT || '8080' }
    });
    console.log('Go mod download completed');
  } catch (err) {
    console.error('Go mod download failed:', err.message);
  }
}

if (fs.existsSync(exePath)) {
  const child = spawn(exePath, [], {
    cwd: goServiceDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: false,
    shell: false,
    env: { ...process.env, PORT: process.env.PORT || '8080' }
  });
  
  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  child.on('error', (err) => {
    console.error('Go service error:', err);
    setTimeout(() => process.exit(1), 1000);
  });
  
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Go service exited with code ${code}`);
      setTimeout(() => process.exit(1), 1000);
    }
  });
  
  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });
} else {
  const child = spawn(goBinary, ['run', 'main.go'], {
    cwd: goServiceDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: false,
    shell: false,
    env: { ...process.env, PORT: process.env.PORT || '8080' }
  });
  
  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  child.on('error', (err) => {
    console.error('Go service error:', err);
    setTimeout(() => process.exit(1), 1000);
  });
  
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Go service exited with code ${code}`);
      setTimeout(() => process.exit(1), 1000);
    }
  });
  
  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });
}
