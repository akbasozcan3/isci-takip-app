// Email Service using Gmail SMTP (App Password recommended)
const nodemailer = require('nodemailer');
const { spawn } = require('child_process');
const path = require('path');

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD;
  if (!user || !pass) return null;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    return transporter;
  } catch (e) {
    console.warn('[EmailService] Transport creation failed:', e?.message || e);
    return null;
  }
}

async function sendMail({ to, subject, html, text }) {
  const transporter = createTransport();
  if (!transporter) return { ok: false, error: 'Transport unavailable' };
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.GMAIL_USER,
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    console.warn('[EmailService] sendMail failed:', e?.message || e);
    return { ok: false, error: e?.message || 'sendMail failed' };
  }
}

function buildResetEmail(resetLink) {
  const title = 'Şifre Sıfırlama';
  const html = `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Bavaxe</title>
  </head>
  <body style="font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:20px;margin:0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.12);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#06b6d4 0%,#7c3aed 100%);color:white;padding:48px 32px;text-align:center;">
        <div style="width:80px;height:80px;background:rgba(255,255,255,0.2);border-radius:20px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:40px;">🔐</div>
        <h1 style="font-size:32px;font-weight:900;margin:0 0 8px 0;letter-spacing:0.5px;">${title}</h1>
        <p style="font-size:16px;opacity:0.95;margin:0;font-weight:500;">Bavaxe - İşçi Takip Sistemi</p>
      </div>
      
      <!-- Content -->
      <div style="padding:48px 32px;background:#ffffff;">
        <div style="color:#1f2937;font-size:20px;margin-bottom:16px;font-weight:700;">Merhaba,</div>
        <p style="color:#4b5563;font-size:16px;margin-bottom:32px;line-height:1.7;">
          Şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Bu link <strong>1 saat</strong> süreyle geçerlidir.
        </p>
        
        <!-- Button -->
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#0891b2 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 4px 12px rgba(6,182,212,0.4);">
            Şifremi Sıfırla
          </a>
        </div>
        
        <!-- Alternative Link -->
        <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:12px;border-left:4px solid #06b6d4;">
          <p style="color:#4b5563;font-size:13px;margin:0 0 8px 0;font-weight:600;">Buton çalışmıyorsa, aşağıdaki linki kopyalayıp tarayıcınıza yapıştırın:</p>
          <p style="color:#06b6d4;font-size:12px;word-break:break-all;margin:0;font-family:monospace;">${resetLink}</p>
        </div>
        
        <!-- Warning -->
        <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px solid #f59e0b;border-radius:16px;padding:20px;margin:24px 0;">
          <div style="display:flex;align-items:center;margin-bottom:12px;">
            <span style="font-size:24px;margin-right:12px;">⚠️</span>
            <span style="color:#92400e;font-size:15px;font-weight:800;text-transform:uppercase;">Güvenlik Uyarısı</span>
          </div>
          <p style="color:#92400e;font-size:14px;line-height:1.6;margin:0;font-weight:500;">
            Bu linki kimseyle paylaşmayın. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilir ve hesabınızı güvence altına alabilirsiniz.
          </p>
        </div>
        
        <!-- Expiry Info -->
        <div style="color:#4b5563;font-size:15px;margin:24px 0;padding:16px;background:#f9fafb;border-radius:12px;border-left:4px solid #06b6d4;">
          ⏱️ Bu link <strong>1 saat</strong> süreyle geçerlidir. Süre dolduktan sonra yeni bir şifre sıfırlama talebi oluşturabilirsiniz.
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px;text-align:center;color:rgba(255,255,255,0.8);">
        <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;letter-spacing:1px;">Bavaxe</div>
        <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:6px 0;line-height:1.6;">© 2024 İşçi Takip Sistemi - Tüm hakları saklıdır.</p>
        <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:6px 0;line-height:1.6;">Modern işletmeler için güvenli konum takip çözümü</p>
      </div>
    </div>
  </body>
  </html>`;
  const text = `Şifre Sıfırlama - Bavaxe

Merhaba,

Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:
${resetLink}

Bu link 1 saat süreyle geçerlidir.

⚠️ Güvenlik Uyarısı: Bu linki kimseyle paylaşmayın. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.

© 2024 İşçi Takip Sistemi - Tüm hakları saklıdır.`;
  return { subject: title, html, text };
}

async function sendResetLink(email, resetLink, token) {
  const { subject, html, text } = buildResetEmail(resetLink);
  return await sendMail({ to: email, subject, html, text });
}

// Legacy support
async function sendResetCode(email, code) {
  // For backward compatibility, create a simple email
  const title = 'Şifre Sıfırlama Kodu';
  const html = `
  <div style="font-family:Arial,sans-serif;background:#0f172a;padding:24px;color:#e2e8f0;">
    <div style="max-width:560px;margin:0 auto;background:#111827;border-radius:14px;border:1px solid #1f2937;overflow:hidden;">
      <div style="padding:20px;background:linear-gradient(135deg,#06b6d4,#0ea5a4);color:#fff;font-weight:800;font-size:18px;">${title}</div>
      <div style="padding:24px">
        <p>Şifre sıfırlama talebiniz için doğrulama kodunuz:</p>
        <div style="font-size:36px;letter-spacing:6px;font-weight:900;background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:16px;text-align:center;color:#fff">${code}</div>
        <p style="margin-top:14px;color:#94a3b8">Bu kod 30 dakika boyunca geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
      </div>
    </div>
  </div>`;
  const text = `Şifre sıfırlama kodunuz: ${code} (30 dakika geçerli)`;
  return await sendMail({ to: email, subject: title, html, text });
}

function runPythonEmailService(payload, pythonCmd = 'python') {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, '..', 'email_service.py');
    const py = spawn(pythonCmd, [script], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    py.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `Python exited with ${code}`));
      try {
        return resolve(JSON.parse(stdout));
      } catch (e) {
        return resolve({ raw: stdout });
      }
    });

    // send payload as JSON via stdin
    try {
      py.stdin.write(JSON.stringify(payload));
    } catch (e) { /* ignore */ }
    py.stdin.end();
  });
}

// örnek wrapper: mevcut email gönderme fonksiyonunuzda kullanın
async function sendEmail(payload) {
  // payload: { to, subject, body, ... }
  // pythonCmd parametresini opsiyonel olarak process.env.PYTHON_CMD ile ayarlayabilirsiniz
  const pythonCmd = process.env.PYTHON_CMD || 'python';
  return runPythonEmailService(payload, pythonCmd);
}

module.exports = {
  sendResetCode,
  sendResetLink,
  sendEmail,
};


