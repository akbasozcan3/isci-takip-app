const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptPath = process.argv[2];
if (!scriptPath) {
  process.exit(1);
}

function findPythonInterpreter() {
  const roots = [path.join(__dirname, '..'), __dirname, process.cwd()];
  const folders = ['.venv', 'venv'];
  const binaries = process.platform === 'win32'
    ? [['Scripts', 'python.exe']]
    : [['bin', 'python3'], ['bin', 'python']];

  for (const root of roots) {
    for (const folder of folders) {
      for (const bin of binaries) {
        const candidate = path.join(root, folder, ...bin);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }

  return process.platform === 'win32' ? 'py' : 'python3';
}

const pythonInterpreter = findPythonInterpreter();

const child = spawn(pythonInterpreter, [scriptPath], {
  cwd: path.dirname(scriptPath),
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  detached: false,
  shell: false
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('error', (err) => {
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
