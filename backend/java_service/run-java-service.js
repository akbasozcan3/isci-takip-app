const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const javaServiceDir = __dirname;

function findMavenBinary() {
  const commonPaths = [
    'C:\\Program Files\\Apache\\maven\\bin\\mvn.cmd',
    'C:\\apache-maven\\bin\\mvn.cmd',
    path.join(process.env.USERPROFILE || '', 'apache-maven', 'bin', 'mvn.cmd'),
    path.join(process.env.LOCALAPPDATA || '', 'Apache', 'maven', 'bin', 'mvn.cmd')
  ];
  
  for (const mvnPath of commonPaths) {
    if (fs.existsSync(mvnPath)) {
      return mvnPath;
    }
  }
  
  try {
    const { execSync } = require('child_process');
    const result = execSync('where mvn', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (result.trim()) {
      return result.trim().split('\n')[0];
    }
  } catch (e) {}
  
  return 'mvn';
}

const mvnBinary = findMavenBinary();

const child = spawn(mvnBinary, ['spring-boot:run'], {
  cwd: javaServiceDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  detached: false,
  shell: false,
  env: { 
    ...process.env, 
    SERVER_PORT: process.env.SERVER_PORT || '7000',
    SPRING_PROFILES_ACTIVE: process.env.SPRING_PROFILES_ACTIVE || 'development'
  }
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('error', (err) => {
  console.error('Java service error:', err);
  setTimeout(() => process.exit(1), 1000);
});

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Java service exited with code ${code}`);
    setTimeout(() => process.exit(1), 1000);
  }
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
