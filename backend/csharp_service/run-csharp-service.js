const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const csharpServiceDir = __dirname;

function findDotnetBinary() {
  const commonPaths = [
    'C:\\Program Files\\dotnet\\dotnet.exe',
    'C:\\Program Files (x86)\\dotnet\\dotnet.exe',
    path.join(process.env.USERPROFILE || '', '.dotnet', 'dotnet.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'dotnet', 'dotnet.exe'),
    path.join(process.env.PROGRAMFILES || '', 'dotnet', 'dotnet.exe')
  ];
  
  for (const dotnetPath of commonPaths) {
    if (fs.existsSync(dotnetPath)) {
      return dotnetPath;
    }
  }
  
  try {
    const { execSync } = require('child_process');
    const result = execSync('where dotnet', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (result.trim()) {
      return result.trim().split('\n')[0];
    }
  } catch (e) {}
  
  return 'dotnet';
}

const dotnetBinary = findDotnetBinary();

const child = spawn(dotnetBinary, ['run', '--urls', 'http://0.0.0.0:6000'], {
  cwd: csharpServiceDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  detached: false,
  shell: false,
  env: { 
    ...process.env, 
    ASPNETCORE_ENVIRONMENT: process.env.ASPNETCORE_ENVIRONMENT || 'Development',
    ASPNETCORE_URLS: process.env.ASPNETCORE_URLS || 'http://0.0.0.0:6000'
  }
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('error', (err) => {
  console.error('C# service error:', err);
  setTimeout(() => process.exit(1), 1000);
});

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`C# service exited with code ${code}`);
    setTimeout(() => process.exit(1), 1000);
  }
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
