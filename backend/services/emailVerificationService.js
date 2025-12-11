const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

let transporter = null;
let logoBase64 = null;
let brandConfig = null;
let smtpInitialized = false;

function initializeEmailService() {
  if (smtpInitialized && transporter) {
    return transporter;
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();
  const smtpSecure = process.env.SMTP_SECURE === '1' || smtpPort === 465;

  if (!smtpUser || !smtpPass) {
    console.warn('[Email Service] SMTP credentials not configured');
    smtpInitialized = true;
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
    });

  brandConfig = {
    name: process.env.BRAND_NAME || 'Bavaxe',
    colorPrimary: process.env.BRAND_COLOR_PRIMARY || '#06b6d4',
    colorSecondary: process.env.BRAND_COLOR_SECONDARY || '#7c3aed',
    logoUrl: process.env.EMAIL_LOGO_URL || 'https://via.placeholder.com/150x150/06b6d4/ffffff?text=BAVAXE'
  };

  loadLogo();

    if (logoBase64) {
      console.log(`[Email Service] ✓ Logo ready for email templates (Base64 length: ${logoBase64.length} chars)`);
    } else {
      console.warn(`[Email Service] ⚠ Logo not loaded, using placeholder URL`);
    }

    console.log(`[Email Service] SMTP initialized: ${smtpHost}:${smtpPort} (User: ${smtpUser})`);
    smtpInitialized = true;
  return transporter;
  } catch (err) {
    console.error('[Email Service] Failed to initialize transporter:', err.message);
    smtpInitialized = true;
    return null;
  }
}

async function verifySMTPConnection() {
  if (!transporter) {
    transporter = initializeEmailService();
    if (!transporter) {
      return { success: false, error: 'SMTP not configured' };
    }
  }

  try {
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified' };
  } catch (error) {
    console.error('[Email Service] SMTP verification failed:', error.message);
    return { success: false, error: error.message };
  }
}

function loadLogo() {
  const projectRoot = path.resolve(__dirname, '../..');
  const logoPaths = [
    path.join(projectRoot, 'Nexora (2).png'),
    path.join(__dirname, '../../Nexora (2).png'),
    path.join(__dirname, '../../app/assets/logo/Nexora.png'),
    path.join(__dirname, '../../app/(tabs)/assets/logo/Nexora.png'),
    path.join(__dirname, '../Nexora (2).png'),
    path.join(__dirname, '../../assets/images/logo.png'),
    path.join(__dirname, '../../assets/logo.png'),
    path.join(__dirname, '../../logo.png')
  ];

  for (const logoPath of logoPaths) {
    try {
      const normalizedPath = path.normalize(logoPath);
      if (fs.existsSync(normalizedPath)) {
        const logoData = fs.readFileSync(normalizedPath);
        const base64String = logoData.toString('base64');
        logoBase64 = `data:image/png;base64,${base64String}`;
        console.log(`[Email Service] ✓ Logo loaded successfully from: ${normalizedPath}`);
        console.log(`[Email Service] Logo size: ${(logoData.length / 1024).toFixed(2)} KB, Base64 length: ${base64String.length} chars`);
        return;
      }
    } catch (err) {
      console.warn(`[Email Service] Failed to load logo from ${logoPath}:`, err.message);
      continue;
    }
  }

  if (!logoBase64) {
    console.warn('[Email Service] ⚠ Logo file "Nexora (2).png" not found in any expected location.');
    console.warn('[Email Service] Expected locations:');
    logoPaths.forEach(p => console.warn(`  - ${path.normalize(p)}`));
    console.warn('[Email Service] Using placeholder URL instead.');
    logoBase64 = brandConfig?.logoUrl || 'https://via.placeholder.com/150x150/06b6d4/ffffff?text=BAVAXE';
  }
}

function getEmailTemplate(type, data) {
  const effectiveLogo = logoBase64 || brandConfig?.logoUrl || 'https://via.placeholder.com/150x150/06b6d4/ffffff?text=BAVAXE';
  
  const { code, resetLink, resetToken, brandName, brandColorPrimary, brandColorSecondary, logo } = {
    code: data.code || '',
    resetLink: data.resetLink || '',
    resetToken: data.resetToken || '',
    brandName: brandConfig?.name || 'Bavaxe',
    brandColorPrimary: brandConfig?.colorPrimary || '#06b6d4',
    brandColorSecondary: brandConfig?.colorSecondary || '#7c3aed',
    logo: effectiveLogo,
    ...data
  };

  if (type === 'verification') {
    return {
      subject: `${brandName} - E-posta Doğrulama Kodu`,
      html: getVerificationEmailHTML(code, brandName, brandColorPrimary, brandColorSecondary, logo),
      text: `${brandName} - E-posta Doğrulama Kodu\n\nMerhaba,\n\nHesabınızı doğrulamak için aşağıdaki doğrulama kodunu kullanın:\n\nDoğrulama Kodu: ${code}\n\nBu kod 10 dakika süreyle geçerlidir.\n\n⚠️ Güvenlik Uyarısı: Bu kodu kimseyle paylaşmayın.\n\n© 2024 ${brandName} - Tüm hakları saklıdır.`
    };
  }

  if (type === 'reset') {
    return {
      subject: `${brandName} - Şifre Sıfırlama`,
      html: getResetEmailHTML(resetToken, brandName, brandColorPrimary, brandColorSecondary, logo),
      text: `${brandName} - Şifre Sıfırlama\n\nMerhaba,\n\nŞifrenizi sıfırlamak için ${brandName} mobil uygulamasını açın ve şifre sıfırlama sayfasına gidin.\n\nToken: ${resetToken}\n\nBu token 1 saat süreyle geçerlidir.\n\n⚠️ Güvenlik Uyarısı: Bu token'ı kimseyle paylaşmayın.\n\n© 2024 ${brandName} - Tüm hakları saklıdır.`
    };
  }

  return null;
}

function getVerificationEmailHTML(code, brandName, colorPrimary, colorSecondary, logo) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-posta Doğrulama - ${brandName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Poppins', sans-serif; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 20px; }
    .email-wrapper { max-width: 900px; margin: 0 auto; background: #ffffff; }
    .email-container { background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
    .header { background: linear-gradient(135deg, ${colorPrimary} 0%, ${colorSecondary} 100%); color: white; padding: 80px 60px; text-align: center; position: relative; }
    .header-icon { width: 160px; height: 160px; background: rgba(255,255,255,0.25); border-radius: 40px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 32px; }
    .header-icon img { width: 120px; height: 120px; object-fit: contain; display: block; max-width: 100%; height: auto; }
    .header h1 { font-size: 48px; font-weight: 900; margin-bottom: 16px; }
    .content { padding: 64px 60px; }
    .greeting { color: #0f172a; font-size: 28px; margin-bottom: 24px; font-weight: 900; }
    .instruction { color: #475569; font-size: 18px; margin-bottom: 48px; line-height: 1.8; }
    .code-container { background: linear-gradient(135deg, ${colorPrimary} 0%, ${colorSecondary} 100%); border-radius: 32px; padding: 64px 60px; margin: 48px 0; text-align: center; }
    .code { color: white; font-size: 72px; font-weight: 900; letter-spacing: 20px; margin-bottom: 24px; font-family: 'Courier New', monospace; }
    .expiry-info { color: #334155; font-size: 17px; margin: 36px 0; padding: 24px 32px; background: #f8fafc; border-radius: 20px; border-left: 6px solid ${colorPrimary}; }
    .warning { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px solid #f59e0b; border-radius: 20px; padding: 28px 32px; margin: 32px 0; }
    .footer { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 60px; text-align: center; color: rgba(255,255,255,0.8); }
    @media only screen and (max-width: 600px) {
      .header { padding: 40px 30px; }
      .header h1 { font-size: 32px; }
      .content { padding: 40px 30px; }
      .code { font-size: 48px; letter-spacing: 10px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="header-icon"><img src="${logo}" alt="${brandName} Logo" style="display: block; max-width: 100%; height: auto;" /></div>
        <h1>E-posta Doğrulama</h1>
        <p style="font-size: 18px; opacity: 0.9;">${brandName} - GPS Takip Sistemi</p>
      </div>
      <div class="content">
        <div class="greeting">Merhaba,</div>
        <p class="instruction">Hesabınızı doğrulamak için aşağıdaki doğrulama kodunu kullanın.</p>
        <div class="code-container">
          <div class="code">${code}</div>
          <div style="color: rgba(255,255,255,1); font-size: 16px; text-transform: uppercase; letter-spacing: 4px; font-weight: 600;">Doğrulama Kodu</div>
        </div>
        <div class="expiry-info">⏱️ Bu kod <strong>10 dakika</strong> süreyle geçerlidir.</div>
        <div class="warning">
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 24px; margin-right: 12px;">⚠️</span>
            <span style="color: #92400e; font-size: 18px; font-weight: 900;">Güvenlik Uyarısı</span>
          </div>
          <p style="color: #92400e; font-size: 16px; line-height: 1.7; margin: 0;">Bu kodu kimseyle paylaşmayın. ${brandName} ekibi asla sizden şifrenizi veya doğrulama kodunuzu istemez.</p>
        </div>
      </div>
      <div class="footer">
        <div style="font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 16px;">${brandName}</div>
        <p>© 2024 ${brandName} - Tüm hakları saklıdır.</p>
        <p style="margin-top: 12px; font-size: 12px; opacity: 0.7;">Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function getResetEmailHTML(resetToken, brandName, colorPrimary, colorSecondary, logo) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Şifre Sıfırlama - ${brandName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Poppins', sans-serif; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 20px; }
    .email-wrapper { max-width: 900px; margin: 0 auto; background: #ffffff; }
    .email-container { background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
    .header { background: linear-gradient(135deg, ${colorPrimary} 0%, ${colorSecondary} 100%); color: white; padding: 80px 60px; text-align: center; }
    .header-icon { width: 160px; height: 160px; background: rgba(255,255,255,0.25); border-radius: 40px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 32px; }
    .header-icon img { width: 120px; height: 120px; object-fit: contain; display: block; max-width: 100%; height: auto; }
    .header h1 { font-size: 48px; font-weight: 900; margin-bottom: 16px; }
    .content { padding: 64px 60px; }
    .greeting { color: #0f172a; font-size: 28px; margin-bottom: 24px; font-weight: 900; }
    .instruction { color: #475569; font-size: 18px; margin-bottom: 32px; line-height: 1.8; }
    .mobile-app-box { background: linear-gradient(135deg, ${colorPrimary}15 0%, ${colorSecondary}15 100%); border: 3px solid ${colorPrimary}; border-radius: 20px; padding: 40px 32px; margin: 32px 0; text-align: center; }
    .mobile-app-icon { font-size: 64px; margin-bottom: 20px; }
    .mobile-app-title { color: #0f172a; font-size: 24px; font-weight: 900; margin-bottom: 16px; }
    .mobile-app-text { color: #475569; font-size: 16px; line-height: 1.8; margin-bottom: 24px; }
    .token-box { background: #f1f5f9; border: 2px dashed ${colorPrimary}; border-radius: 16px; padding: 24px; margin: 24px 0; }
    .token-label { color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .token-value { color: ${colorPrimary}; font-size: 14px; font-family: 'Courier New', monospace; word-break: break-all; font-weight: 600; line-height: 1.6; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all; cursor: text; padding: 8px; background: #ffffff; border-radius: 8px; }
    .copy-hint { color: #64748b; font-size: 12px; margin-top: 12px; font-style: italic; }
    .footer { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 60px; text-align: center; color: rgba(255,255,255,0.8); }
    @media only screen and (max-width: 600px) {
      .header { padding: 40px 30px; }
      .header h1 { font-size: 32px; }
      .content { padding: 40px 30px; }
      .mobile-app-box { padding: 32px 24px; }
      .mobile-app-title { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="header-icon"><img src="${logo}" alt="${brandName} Logo" style="display: block; max-width: 100%; height: auto;" /></div>
        <h1>Şifre Sıfırlama</h1>
        <p style="font-size: 18px; opacity: 0.9;">${brandName} - GPS Takip Sistemi</p>
      </div>
      <div class="content">
        <div class="greeting">Merhaba,</div>
        <p class="instruction">Şifrenizi sıfırlamak için <strong>${brandName} mobil uygulamasını</strong> açın ve şifre sıfırlama sayfasına gidin. Bu işlem <strong>1 saat</strong> süreyle geçerlidir.</p>
        
        <div class="mobile-app-box">
          <div class="mobile-app-icon">📱</div>
          <div class="mobile-app-title">Mobil Uygulamaya Gidin</div>
          <p class="mobile-app-text">Şifrenizi sıfırlamak için ${brandName} mobil uygulamasını açın ve aşağıdaki token'ı kullanın.</p>
          
          <div class="token-box">
            <div class="token-label">Doğrulama Token'ı</div>
            <div class="token-value" style="user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all; cursor: text;" onclick="this.select(); document.execCommand('copy');">${resetToken}</div>
            <div class="copy-hint">Bu token'ı seçip kopyalayın (Ctrl+C veya Cmd+C), sonra mobil uygulamadaki şifre sıfırlama sayfasına yapıştırın</div>
          </div>
        </div>

        <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 3px solid ${colorPrimary}; border-radius: 20px; padding: 28px 32px; margin: 32px 0;">
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 24px; margin-right: 12px;">ℹ️</span>
            <span style="color: #1e40af; font-size: 18px; font-weight: 900;">Nasıl Kullanılır?</span>
          </div>
          <ol style="color: #1e40af; font-size: 16px; line-height: 2; margin: 0; padding-left: 24px;">
            <li>${brandName} mobil uygulamasını açın</li>
            <li>Şifre sıfırlama sayfasına gidin</li>
            <li>Yukarıdaki token'ı kopyalayıp yapıştırın</li>
            <li>Yeni şifrenizi belirleyin</li>
          </ol>
        </div>

        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px solid #f59e0b; border-radius: 20px; padding: 28px 32px; margin: 32px 0;">
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 24px; margin-right: 12px;">⚠️</span>
            <span style="color: #92400e; font-size: 18px; font-weight: 900;">Güvenlik Uyarısı</span>
          </div>
          <p style="color: #92400e; font-size: 16px; line-height: 1.7; margin: 0;">Bu token'ı kimseyle paylaşmayın. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
      </div>
      <div class="footer">
        <div style="font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 16px;">${brandName}</div>
        <p>© 2024 ${brandName} - Tüm hakları saklıdır.</p>
        <p style="margin-top: 12px; font-size: 12px; opacity: 0.7;">Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function sendVerificationEmail(email, code, retries = 3) {
  if (!transporter) {
    transporter = initializeEmailService();
  }
  
    if (!transporter) {
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    
    if (!smtpUser || !smtpPass) {
      throw new Error('SMTP yapılandırılmamış. Lütfen .env dosyasında SMTP_USER ve SMTP_PASS değişkenlerini ayarlayın.');
    }
    
    throw new Error('SMTP bağlantısı kurulamadı. Lütfen SMTP ayarlarını kontrol edin.');
  }

  if (!email || !code || !/^\d{6}$/.test(code)) {
    throw new Error('Invalid email or code format. Code must be 6 digits.');
  }

  const template = getEmailTemplate('verification', { code });
  
  for (let attempt = 1; attempt <= retries; attempt++) {
  try {
      const result = await transporter.sendMail({
        from: `"${brandConfig.name}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
        text: template.text,
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
          'List-Unsubscribe': '<mailto:unsubscribe@bavaxe.com>'
        }
      });

      console.log(`[Email Service] ✓ Verification email sent to ${email} (MessageId: ${result.messageId})`);
      return { success: true, message: 'Email sent successfully', messageId: result.messageId };
  } catch (error) {
      console.error(`[Email Service] ✗ Attempt ${attempt}/${retries} failed for ${email}:`, error.message);
      
      if (attempt === retries) {
        if (error.code === 'EAUTH') {
          throw new Error('SMTP authentication failed. Please check SMTP_USER and SMTP_PASS credentials.');
        } else if (error.code === 'ECONNECTION') {
          throw new Error('SMTP connection failed. Please check SMTP_HOST and SMTP_PORT settings.');
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error('SMTP connection timeout. Please check your network connection.');
        } else {
          throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function sendResetLinkEmail(email, resetLink, token, retries = 3) {
  if (!transporter) {
    transporter = initializeEmailService();
  }
  
    if (!transporter) {
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    
    if (!smtpUser || !smtpPass) {
      throw new Error('SMTP yapılandırılmamış. Lütfen .env dosyasında SMTP_USER ve SMTP_PASS değişkenlerini ayarlayın.');
    }
    
    throw new Error('SMTP bağlantısı kurulamadı. Lütfen SMTP ayarlarını kontrol edin.');
  }

  if (!email || !token) {
    throw new Error('Invalid email or reset token');
  }

  const template = getEmailTemplate('reset', { resetToken: token });
  
  for (let attempt = 1; attempt <= retries; attempt++) {
  try {
      const result = await transporter.sendMail({
        from: `"${brandConfig.name}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
        text: template.text,
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
          'List-Unsubscribe': '<mailto:unsubscribe@bavaxe.com>'
        }
      });

      console.log(`[Email Service] ✓ Reset link email sent to ${email} (MessageId: ${result.messageId})`);
      return { success: true, message: 'Reset link sent successfully', messageId: result.messageId };
  } catch (error) {
      console.error(`[Email Service] ✗ Attempt ${attempt}/${retries} failed for ${email}:`, error.message);
      
      if (attempt === retries) {
        if (error.code === 'EAUTH') {
          throw new Error('SMTP authentication failed. Please check SMTP_USER and SMTP_PASS credentials.');
        } else if (error.code === 'ECONNECTION') {
          throw new Error('SMTP connection failed. Please check SMTP_HOST and SMTP_PORT settings.');
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error('SMTP connection timeout. Please check your network connection.');
        } else {
          throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
  }
}

      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function getHealthStatus() {
  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  
  let connectionStatus = 'not_configured';
  let connectionError = null;
  let lastCheck = null;
  
  if (smtpConfigured) {
    try {
      const verification = await verifySMTPConnection();
      connectionStatus = verification.success ? 'connected' : 'failed';
      connectionError = verification.error || null;
      lastCheck = new Date().toISOString();
    } catch (error) {
      connectionStatus = 'error';
      connectionError = error.message;
      lastCheck = new Date().toISOString();
    }
  }
  
  return {
    status: connectionStatus === 'connected' ? 'OK' : 'ERROR',
    service: 'Email Verification Service',
    smtp_configured: smtpConfigured,
    smtp_host: smtpConfigured ? smtpHost : null,
    smtp_port: smtpConfigured ? smtpPort : null,
    smtp_user: smtpConfigured ? (process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : null) : null,
    connection_status: connectionStatus,
    connection_error: connectionError,
    last_check: lastCheck,
    brand_name: brandConfig?.name || 'Bavaxe'
  };
}


const initializedTransporter = initializeEmailService();

if (initializedTransporter) {
  verifySMTPConnection().then(result => {
    if (result.success) {
      console.log('[Email Service] ✓ SMTP connection verified successfully');
      console.log(`[Email Service] Ready to send emails from: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
    } else {
      console.error(`[Email Service] ✗ SMTP connection verification failed: ${result.error}`);
      console.error('[Email Service] Email gönderimi çalışmayacak. Lütfen SMTP ayarlarını kontrol edin.');
    }
  }).catch(err => {
    console.error('[Email Service] ✗ SMTP verification error:', err.message);
  });
} else {
  console.error('[Email Service] ✗ SMTP not configured. Email gönderimi çalışmayacak.');
  console.error('[Email Service] Lütfen .env dosyasında SMTP_USER ve SMTP_PASS değişkenlerini ayarlayın.');
}

module.exports = {
  sendVerificationEmail,
  sendResetLinkEmail,
  getHealthStatus,
  verifySMTPConnection,
  initializeEmailService
};
