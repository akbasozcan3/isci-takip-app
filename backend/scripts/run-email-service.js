const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isWin = process.platform === 'win32';
const backendDir = path.join(__dirname, '..');
const projectRoot = path.join(backendDir, '..');
const emailServicePath = path.join(backendDir, 'email_service.py');

const pathCandidates = [];

function pushVenvCandidates(rootDir) {
  const folders = ['venv', '.venv'];
  const bin = isWin ? ['Scripts', 'python.exe'] : ['bin', 'python3'];
  const altBin = isWin ? ['Scripts', 'python.exe'] : ['bin', 'python'];

  folders.forEach((folder) => {
    const primary = path.join(rootDir, folder, ...bin);
    const secondary = path.join(rootDir, folder, ...altBin);
    pathCandidates.push(primary);
    pathCandidates.push(secondary);
  });
}

pushVenvCandidates(projectRoot);
pushVenvCandidates(backendDir);

const commandQueue = pathCandidates.filter((candidate) => fs.existsSync(candidate));

// Fallbacks (their existence will be checked during spawn)
commandQueue.push(isWin ? 'py' : 'python3');
commandQueue.push('python');

function launchInterpreter(queue) {
  const cmd = queue.shift();
  if (!cmd) {
    console.error('❌ Uygun bir Python yorumlayıcısı bulunamadı. Python kurulu olduğundan emin olun.');
    process.exit(1);
  }

  console.log(`📧 Email servis başlatılıyor: "${cmd}"`);
  const child = spawn(cmd, [emailServicePath], {
    stdio: 'inherit',
    env: process.env,
    cwd: backendDir,
  });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.warn(`⚠️  "${cmd}" komutu bulunamadı, bir sonraki seçenek denenecek...`);
      launchInterpreter(queue);
      return;
    }
    console.error(`❌ Email servisi başlatılırken hata oluştu (${cmd}):`, err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

launchInterpreter(commandQueue);

