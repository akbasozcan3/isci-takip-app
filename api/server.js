// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const http = require('http');
const app = express();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 4000;
const SECRET_KEY = process.env.SECRET_KEY || 'change_this_secret';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Production optimizations
if (NODE_ENV === 'production') {
  // Enable compression for production
  const compression = require('compression');
  app.use(compression());
  
  // Security headers with helmet
  const helmet = require('helmet');
  app.use(helmet());
}

// Enhanced CORS for Android/iOS compatibility
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Veri depolama (kalıcı) - api/data.json
const DATA_PATH = path.join(__dirname, 'data.json');
let store = {}; // { workerId: [ { timestamp, coords } ] }
let meta = {};  // { workerId: { name?, phone? } }
let groups = {}; // { groupId: { id, code, name, address, lat, lng, createdBy, createdAt, visibility } }
let groupRequests = {}; // { groupId: [ { id, userId, displayName, status, requestedAt } ] }
let groupMembers = {}; // { groupId: [ { userId, role, joinedAt } ] }
let groupLocations = {}; // { groupId: { userId: { lat, lng, heading, accuracy, timestamp, lastSeen } } }
let userStatus = {}; // { userId: { isOnline: boolean, lastSeen: timestamp, lastLocation: { lat, lng } } }
let users = {}; // { userId: { id, phone?, email?, name?, createdAt, email_verified?: '0'|'1' } }
let tokens = {}; // { token: userId }
let emailPasswords = {}; // { email: bcryptHash }
let emailVerifications = {}; // { email: [ { code, expiresAt, usedAt, createdAt } ] }
let passwordResets = {}; // { email: [ { code, expiresAt, usedAt, createdAt } ] }

// ---- Articles (mock) ----
const long = (text) => {
  const para = `${text}\n\nBu bölümde gerçek sahadan alınan deneyimler, dikkat edilmesi gereken noktalar ve örnek uygulama adımları detaylı olarak anlatılır. Mimari kararlar, hata senaryoları ve performans ölçümleri adım adım açıklanır. Ek olarak, ekip içi iletişim ve operasyonel süreçlere dair pratik tavsiyeler verilir. Bu bilgiler özellikle saha operasyonlarında verimliliği artırmak ve kullanıcı memnuniyetini yükseltmek için önemlidir. Doğru izleme politikaları, veri retansiyon süreleri ve gizlilik prensipleri birlikte ele alınmalıdır. Gerektiğinde A/B testleri ile farklı parametreler karşılaştırılır ve en iyi sonuç veren ayarlar seçilir.\n\n`;
  return `# ${text}\n\n${para.repeat(6)}Sonuç olarak, yukarıdaki ilkeler uygulandığında sistem daha öngörülebilir, güvenli ve ölçeklenebilir hale gelir.`;
};

const articles = [
  { id: 'getting-started', title: 'İşçi Takibe Giriş', excerpt: 'Uygulamayı dakikalar içinde kurun ve ekibinizi takip etmeye başlayın.', readTime: '5 dk', hero: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200', content: long('Başlangıç ve Kurulum') },
  { id: 'privacy-security', title: 'Gizlilik ve Güvenlik', excerpt: 'Veriler nasıl korunur? İzinler ve KVKK uyumu.', readTime: '6 dk', hero: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=1200', content: long('Güvenlik İlkeleri') },
  { id: 'battery-optimization', title: 'Pil Optimizasyonu', excerpt: 'Konum paylaşırken pil tüketimini nasıl azaltırız?', readTime: '4 dk', hero: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200', content: long('Pil ve Performans') },
  { id: 'group-management', title: 'Grup Yönetimi ve Roller', excerpt: 'Admin ve üye rollerinin farkları, yetkiler ve en iyi uygulamalar.', readTime: '7 dk', hero: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200', content: long('Grup Süreçleri ve Roller') },
  { id: 'realtime-tracking', title: 'Gerçek Zamanlı Takip Mimarisi', excerpt: 'Socket.IO ile anlık konum paylaşımı ve ölçekleme notları.', readTime: '8 dk', hero: 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200', content: long('Gerçek Zamanlı Mimariler') },
  { id: 'reports-analytics', title: 'Raporlama ve Analitik', excerpt: 'Günlük mesafe, çalışma alanı ihlali ve online süre raporları.', readTime: '9 dk', hero: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1200', content: long('Raporlama ve Analitik') },
  { id: 'offline-sync', title: 'Offline Mod ve Senkronizasyon', excerpt: 'Bağlantı yokken veri saklama ve sonra sunucuya aktarma.', readTime: '6 dk', hero: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200', content: long('Offline Senaryoları') },
  { id: 'android-ios-tips', title: 'Android ve iOS İpuçları', excerpt: 'İzinler, arka plan çalışması, pil ve harita sağlayıcı farkları.', readTime: '5 dk', hero: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1200', content: long('Platform Spesifik İpuçları') },
  { id: 'security-checklist', title: 'Güvenlik Kontrol Listesi', excerpt: 'JWT, CORS, rate limit ve veri maskeleme için hızlı rehber.', readTime: '4 dk', hero: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=1200', content: long('Güvenlik Checklist') },
  { id: 'deployment', title: 'Yayınlama ve Dağıtım', excerpt: 'EAS Build, çevresel değişkenler ve üretim ayarları.', readTime: '6 dk', hero: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=1200', content: long('Dağıtım Stratejileri') },
  { id: 'monitoring-alerting', title: 'İzleme ve Alarm', excerpt: 'Loglama, metrikler ve uyarı kanalları.', readTime: '6 dk', hero: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1200', content: long('İzleme ve Uyarı Sistemleri') },
];

app.get('/api/articles', (_req, res) => {
  const list = articles.map(({ content, ...meta }) => meta);
  res.json(list);
});

app.get('/api/articles/:id', (req, res) => {
  const a = articles.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Article not found' });
  res.json(a);
});

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_PATH)) return;
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    if (!raw) return;
    const data = JSON.parse(raw);
    store = data.store || {};
    meta = data.meta || {};
    groups = data.groups || {};
    groupRequests = data.groupRequests || {};
    groupMembers = data.groupMembers || {};
    groupLocations = data.groupLocations || {};
    users = data.users || {};
    tokens = data.tokens || {};
    emailPasswords = data.emailPasswords || {};
    emailVerifications = data.emailVerifications || {};
    passwordResets = data.passwordResets || {};
    console.log('[data] Loaded from disk');
  } catch (e) {
    console.warn('[data] Failed to load data.json:', e.message);
  }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const contents = JSON.stringify({ store, meta, groups, groupRequests, groupMembers, groupLocations, users, tokens, emailPasswords, emailVerifications, passwordResets }, null, 2);
      fs.writeFileSync(DATA_PATH, contents, 'utf8');
      // console.log('[data] Saved to disk');
    } catch (e) {
      console.warn('[data] Failed to save data.json:', e.message);
    }
  }, 300);
}

loadFromDisk();

// Yardımcı fonksiyonlar
function generateGroupCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

app.get('/health', (_req, res) => res.json({ ok: true, timestamp: Date.now(), env: NODE_ENV }));

// Basit token auth middleware (opsiyonel)
function authOptional(req, _res, next) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const userId = tokens[token];
    if (userId) req.userId = userId;
  }
  next();
}

app.use(authOptional);

// === Email helpers ===
const EMAIL_SUBJECT_VERIFY = process.env.EMAIL_SUBJECT_VERIFY || 'Hesabınızı Doğrulayın';
const EMAIL_SUBJECT_RESET = process.env.EMAIL_SUBJECT_RESET || 'Şifre Sıfırlama Kodu';

function createTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host, port, secure: false,
    auth: { user, pass }
  });
}

async function sendEmailCode(email, code, type = 'verify') {
  const transporter = createTransport();
  if (!transporter) {
    console.error('[smtp] transporter not configured: check SMTP_USER/SMTP_PASS');
    return false;
  }
  const subject = type === 'reset' ? EMAIL_SUBJECT_RESET : EMAIL_SUBJECT_VERIFY;
  const minutes = type === 'reset' ? (process.env.RESET_CODE_EXPIRE_MIN || '15') : (process.env.VERIFY_CODE_EXPIRE_MIN || '30');
  const html = `
    <div style='font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'>
      <h2>${type === 'reset' ? 'Şifre Sıfırlama' : 'Hesap Doğrulama'}</h2>
      <p>Kodunuz: <strong style='font-size:20px'>${code}</strong></p>
      <p>Bu kod ${minutes} dakika boyunca geçerlidir.</p>
    </div>
  `;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
  try {
    if (process.env.DEBUG_SMTP === '1') {
      try { await transporter.verify(); console.log('[smtp] verify ok'); } catch (e) { console.error('[smtp] verify fail:', e?.message || e); }
    }
    const info = await transporter.sendMail({ from, to: email, subject, html });
    if (process.env.DEBUG_SMTP === '1') console.log('[smtp] sent:', info?.messageId, info?.response);
    return true;
  } catch (err) {
    console.error('[smtp] sendMail error:', err?.message || err);
    return false;
  }
}

// SMTP debug endpoints with token guard
const DEBUG_TOKEN = process.env.DEBUG_SMTP_TOKEN || process.env.SECRET_KEY || '';
function smtpGuard(req, res, next) {
  // Allow if DEBUG_SMTP=1 (explicit debug mode)
  if (process.env.DEBUG_SMTP === '1') return next();
  // Otherwise require matching token via header or query
  const provided = req.headers['x-debug-token'] || req.query.token;
  if (DEBUG_TOKEN && provided === DEBUG_TOKEN) return next();
  return res.status(404).json({ error: 'not found' });
}

app.get('/debug/smtp-verify', smtpGuard, async (_req, res) => {
  try {
    const tr = createTransport();
    if (!tr) return res.status(400).json({ ok: false, error: 'transporter not configured' });
    await tr.verify();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/debug/smtp-send', smtpGuard, async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'to required' });
    const tr = createTransport();
    if (!tr) return res.status(400).json({ ok: false, error: 'transporter not configured' });
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await tr.sendMail({ from, to, subject: 'SMTP Test', text: 'Test mesajı - İŞÇİ TAKİP', html: '<b>SMTP Test</b>' });
    return res.json({ ok: true, messageId: info?.messageId, response: info?.response });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// === Auth helpers ===
const ACCESS_TOKEN_MIN = Number(process.env.ACCESS_TOKEN_EXPIRE_MIN || '10080'); // 7 gün
function createAccessToken(payload, minutes = ACCESS_TOKEN_MIN) {
  return jwt.sign({ ...payload }, SECRET_KEY, { expiresIn: `${minutes}m` });
}
function createPreEmailToken(email, minutes = Number(process.env.PRE_EMAIL_TOKEN_MIN || '30')) {
  return createAccessToken({ pv: email }, minutes);
}
function validatePreEmailToken(token, email) {
  if (!token) return false;
  try {
    const p = jwt.verify(token, SECRET_KEY);
    return p && p.pv === email;
  } catch (_) {
    return false;
  }
}
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function pushRecord(map, key, rec) {
  if (!map[key]) map[key] = [];
  map[key].push(rec);
}

function findValidCode(map, key, code) {
  const list = map[key] || [];
  const now = Date.now();
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (!r.usedAt && r.code === code && r.expiresAt > now) return { r, i };
  }
  return null;
}

// === Email verification endpoints ===
app.post('/auth/pre-verify-email', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const code = generateCode();
  const expiresAt = Date.now() + (Number(process.env.VERIFY_CODE_EXPIRE_MIN || '30') * 60 * 1000);
  // invalidate previous unused by marking usedAt
  (emailVerifications[email] || []).forEach(v => { if (!v.usedAt) v.usedAt = Date.now(); });
  pushRecord(emailVerifications, email, { code, expiresAt, usedAt: null, createdAt: Date.now() });
  scheduleSave();
  let sent = false;
  try { sent = await sendEmailCode(email, code, 'verify'); } catch (_) { sent = false; }
  const dev = process.env.RESET_DEV_RETURN_CODE === '1';
  const body = { ok: true };
  if (dev && !sent) body.dev_code = code;
  return res.json(body);
});

app.post('/auth/pre-verify-email/verify', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'email/code required' });
  const hit = findValidCode(emailVerifications, email, code);
  if (!hit) return res.status(400).json({ error: 'Invalid or expired code' });
  hit.r.usedAt = Date.now();
  scheduleSave();
  const token = createPreEmailToken(email);
  return res.json({ pre_token: token });
});

// === Register/Login with email ===
app.post('/auth/register', async (req, res) => {
  const { email, password, name, pre_token, phone } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email/password required' });
  // enforce pre email verification
  if ((process.env.ENFORCE_PRE_EMAIL || '1') === '1') {
    if (!validatePreEmailToken(pre_token, email)) {
      return res.status(400).json({ error: 'Email not pre-verified' });
    }
  }
  // unique email
  if (Object.values(users).some(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
  const id = generateId();
  const hash = await bcrypt.hash(password, 10);
  users[id] = { id, email, name: name || null, phone: phone || null, createdAt: Date.now(), email_verified: '1', phone_verified: '1' };
  emailPasswords[email] = hash;
  scheduleSave();
  // optional: send verify email again (not necessary since pre-verified)
  return res.json({ id, email, name: users[id].name });
});

app.post('/auth/login', async (req, res) => {
  // accept form or json
  const email = (req.body.username || req.body.email || '').toString();
  const password = (req.body.password || '').toString();
  if (!email || !password) return res.status(400).json({ error: 'Incorrect email or password' });
  const user = Object.values(users).find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'Incorrect email or password' });
  const ok = await bcrypt.compare(password, emailPasswords[email] || '');
  if (!ok) return res.status(400).json({ error: 'Incorrect email or password' });
  const emailVerified = String(user.email_verified || '0') === '1';
  if (!emailVerified) return res.status(403).json({ error: 'Account not verified. Please verify email.' });
  const access_token = createAccessToken({ sub: user.email });
  return res.json({ access_token, token_type: 'bearer' });
});

app.post('/auth/send-email-code', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.json({ ok: true });
  if (!Object.values(users).some(u => u.email === email)) return res.json({ ok: true });
  const code = generateCode();
  const expiresAt = Date.now() + (Number(process.env.VERIFY_CODE_EXPIRE_MIN || '30') * 60 * 1000);
  (emailVerifications[email] || []).forEach(v => { if (!v.usedAt) v.usedAt = Date.now(); });
  pushRecord(emailVerifications, email, { code, expiresAt, usedAt: null, createdAt: Date.now() });
  scheduleSave();
  let sent = false; try { sent = await sendEmailCode(email, code, 'verify'); } catch(_) { sent = false; }
  const body = { ok: true };
  if ((process.env.RESET_DEV_RETURN_CODE || '1') === '1' && !sent) body.dev_code = code;
  return res.json(body);
});

app.post('/auth/verify-email', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Invalid email or code' });
  const hit = findValidCode(emailVerifications, email, code);
  if (!hit) return res.status(400).json({ error: 'Invalid or expired code' });
  hit.r.usedAt = Date.now();
  const user = Object.values(users).find(u => u.email === email);
  if (user) user.email_verified = '1';
  scheduleSave();
  return res.json({ ok: true });
});

app.post('/auth/forgot', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.json({ ok: true });
  const user = Object.values(users).find(u => u.email === email);
  if (!user) return res.json({ ok: true });
  const code = generateCode();
  const expiresAt = Date.now() + (Number(process.env.RESET_CODE_EXPIRE_MIN || '15') * 60 * 1000);
  pushRecord(passwordResets, email, { code, expiresAt, usedAt: null, createdAt: Date.now() });
  scheduleSave();
  try { await sendEmailCode(email, code, 'reset'); } catch(_) {}
  const body = { ok: true };
  if ((process.env.RESET_DEV_RETURN_CODE || '1') === '1') body.dev_code = code;
  return res.json(body);
});

app.post('/auth/reset', async (req, res) => {
  const { email, code, new_password } = req.body || {};
  if (!email || !code || !new_password) return res.status(400).json({ error: 'Invalid email or code' });
  const hit = findValidCode(passwordResets, email, code);
  if (!hit) return res.status(400).json({ error: 'Invalid or expired code' });
  hit.r.usedAt = Date.now();
  const hash = await bcrypt.hash(new_password, 10);
  emailPasswords[email] = hash;
  scheduleSave();
  return res.json({ ok: true });
});

// Phone OTP endpoints removed (email-only auth)

// Auth: Email/Password (demo amaçlı düz saklama; gerçekte hash kullanın)
// Ensure JWT-based /auth/me only (Bearer access_token)
app.get('/auth/me', (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    const email = payload && payload.sub;
    const user = Object.values(users).find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'not found' });
    return res.json({ user: { id: user.id, email: user.email, name: user.name || null } });
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
});

app.post('/api/locations', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.workerId || !payload.coords) return res.status(400).json({ error: 'invalid' });
  const id = payload.workerId;
  store[id] = store[id] || [];
  store[id].push({ timestamp: payload.timestamp || Date.now(), coords: payload.coords });
  // limit size
  if (store[id].length > 5000) store[id].splice(0, store[id].length - 5000);
  // upsert meta if provided
  if (payload.name || payload.phone) {
    meta[id] = meta[id] || {};
    if (payload.name) meta[id].name = String(payload.name);
    if (payload.phone) meta[id].phone = String(payload.phone);
  }
  scheduleSave();
  return res.json({ ok: true });
});

app.get('/api/locations/:workerId', (req, res) => {
  const id = req.params.workerId;
  res.json(store[id] || []);
});

// recent history with optional limit and since
app.get('/api/locations/:workerId/recent', (req, res) => {
  const id = req.params.workerId;
  const list = store[id] || [];
  const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
  const since = req.query.since ? parseInt(req.query.since, 10) : 0;
  const filtered = list.filter((x) => x.timestamp >= since);
  res.json(filtered.slice(-limit));
});

// latest location per worker (all workers)
app.get('/api/locations/latest', (_req, res) => {
  const result = [];
  for (const id of Object.keys(store)) {
    const arr = store[id];
    if (arr && arr.length > 0) {
      const last = arr[arr.length - 1];
      result.push({ workerId: id, last, meta: meta[id] || {} });
    }
  }
  res.json({ count: result.length, items: result });
});

// Active devices with optional query (by id/name/phone) and recency filter
app.get('/api/active', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const sinceMs = parseInt(req.query.sinceMs || '300000', 10); // default 5 minutes
  const now = Date.now();
  const items = [];
  for (const id of Object.keys(store)) {
    const arr = store[id];
    if (!arr || arr.length === 0) continue;
    const last = arr[arr.length - 1];
    if (now - last.timestamp > sinceMs) continue; // not active
    const m = meta[id] || {};
    const hay = `${id} ${(m.name || '')} ${(m.phone || '')}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    items.push({ workerId: id, name: m.name || null, phone: m.phone || null, timestamp: last.timestamp, coords: last.coords });
  }
  res.json({ count: items.length, items });
});

// Dashboard stats endpoint
app.get('/api/dashboard/:userId', (req, res) => {
  const userId = req.params.userId;
  const now = Date.now();
  const activeThreshold = 15 * 60 * 1000; // 15 dakika
  
  const userGroups = Object.values(groups).filter(g => {
    const members = groupMembers[g.id] || [];
    return members.some(m => m.userId === userId);
  });
  
  // Aktif çalışan sayısı (kullanıcının üye olduğu gruplar kapsamında)
  let activeWorkers = 0;
  const fifteenMinAgo = now - activeThreshold;
  for (const gid of Object.keys(groupMembers)) {
    const members = groupMembers[gid] || [];
    if (!members.some(m => m.userId === userId)) continue; // kullanıcı bu grupta değilse atla
    const locs = groupLocations[gid] || {};
    for (const uid of Object.keys(locs)) {
      const loc = locs[uid];
      if (loc && loc.timestamp && loc.timestamp > fifteenMinAgo) {
        activeWorkers++;
      }
    }
  }

  const todayStart = new Date().setHours(0, 0, 0, 0);
  let todayDistance = 0;
  const userLocations = store[userId] || [];
  const todayLocations = userLocations.filter(l => l.timestamp >= todayStart);
  for (let i = 1; i < todayLocations.length; i++) {
    const prev = todayLocations[i - 1].coords;
    const curr = todayLocations[i].coords;
    const dist = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    todayDistance += dist;
  }
  
  res.json({
    activeWorkers,
    totalGroups: userGroups.length,
    todayDistance: Math.round(todayDistance),
    activeAlerts: 0
  });
});

// Activities endpoint
app.get('/api/activities', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
  const activities = [];
  
  // Son grup oluşturma aktiviteleri
  const recentGroups = Object.values(groups)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  
  for (const group of recentGroups) {
    activities.push({
      id: `group-${group.id}`,
      type: 'group_created',
      message: `${group.name} grubu oluşturuldu`,
      timestamp: group.createdAt,
      icon: 'people'
    });
  }
  
  // Son katılma istekleri
  for (const groupId of Object.keys(groupRequests)) {
    const requests = groupRequests[groupId] || [];
    for (const req of requests.slice(-3)) {
      activities.push({
        id: `request-${req.id}`,
        type: 'join_request',
        message: `${req.displayName} gruba katılmak istiyor`,
        timestamp: req.requestedAt,
        icon: 'person-add'
      });
    }
  }
  
  // Timestamp'e göre sırala ve limit uygula
  activities.sort((a, b) => b.timestamp - a.timestamp);
  res.json(activities.slice(0, limit));
});

// Haversine distance helper
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // metre
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Grup API'leri
app.post('/api/groups', (req, res) => {
  const { name, address, lat, lng, createdBy, visibility = 'private' } = req.body;
  if (!name || !createdBy) {
    return res.status(400).json({ error: 'Name and createdBy required' });
  }
  
  const groupId = generateId();
  const code = generateGroupCode();
  const group = {
    id: groupId,
    code,
    name,
    address,
    lat: lat || null,
    lng: lng || null,
    createdBy,
    createdAt: Date.now(),
    visibility
  };
  
  groups[groupId] = group;
  groupRequests[groupId] = [];
  groupMembers[groupId] = [{ userId: createdBy, role: 'admin', joinedAt: Date.now() }];
  groupLocations[groupId] = {};
  
  scheduleSave();
  res.json(group);
});

// Grubu sil (yalnızca admin)
app.delete('/api/groups/:groupId', (req, res) => {
  const { groupId } = req.params;
  const { adminUserId } = req.body || {};

  const group = groups[groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const isAdmin = (groupMembers[groupId] || []).some(m => m.userId === adminUserId && m.role === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  // Silme işlemleri
  delete groups[groupId];
  delete groupMembers[groupId];
  delete groupRequests[groupId];
  delete groupLocations[groupId];

  // İsteğe bağlı: grubu izleyen kullanıcılara bildirim
  io.to(`group_${groupId}`).emit('group_deleted', { groupId });

  scheduleSave();
  return res.json({ success: true });
});

app.post('/api/groups/:code/join-request', (req, res) => {
  const codeParam = req.params.code;
  const code = String(codeParam || '').toUpperCase();
  const { userId, displayName } = req.body;
  
  if (!userId || !displayName) {
    return res.status(400).json({ error: 'Eksik bilgi: Kullanıcı ID ve Görünen Ad gereklidir.' });
  }
  
  // Grup koduna göre grup bul
  const group = Object.values(groups).find(g => String(g.code || '').toUpperCase() === code);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  // Zaten üye mi kontrol et
  const isMember = groupMembers[group.id]?.some(m => m.userId === userId);
  if (isMember) {
    return res.status(400).json({ error: 'Already a member' });
  }
  
  // Zaten bekleyen istek var mı kontrol et
  const existingRequest = groupRequests[group.id]?.find(r => r.userId === userId && r.status === 'pending');
  if (existingRequest) {
    return res.status(400).json({ error: 'Request already pending' });
  }
  
  const requestId = generateId();
  const request = {
    id: requestId,
    userId,
    displayName,
    status: 'pending',
    requestedAt: Date.now()
  };
  
  // Ensure requests array exists for this group (older data.json might miss it)
  if (!groupRequests[group.id]) {
    groupRequests[group.id] = [];
  }
  groupRequests[group.id].push(request);
  
  // Admin'e gerçek zamanlı bildirim gönder
  io.to(`group_${group.id}`).emit('new_request', { groupId: group.id, request });
  
  scheduleSave();
  res.json(request);
});

app.get('/api/groups/:groupId/requests', (req, res) => {
  const { groupId } = req.params;
  const requests = groupRequests[groupId] || [];
  res.json(requests.filter(r => r.status === 'pending'));
});

app.post('/api/groups/:groupId/requests/:requestId/approve', (req, res) => {
  const { groupId, requestId } = req.params;
  const { adminUserId } = req.body;
  
  // Admin kontrolü
  const group = groups[groupId];
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  const isAdmin = groupMembers[groupId]?.some(m => m.userId === adminUserId && m.role === 'admin');
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const request = groupRequests[groupId]?.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  // İsteği onayla
  request.status = 'accepted';
  
  // Üye ekle
  groupMembers[groupId].push({
    userId: request.userId,
    role: 'member',
    joinedAt: Date.now()
  });
  
  // Gerçek zamanlı bildirim
  io.to(`group_${groupId}`).emit('member_approved', { 
    groupId, 
    userId: request.userId, 
    displayName: request.displayName 
  });
  
  scheduleSave();
  res.json({ success: true });
});

// Adminliği başka üyeye devret
app.post('/api/groups/:groupId/transfer-admin', (req, res) => {
  const { groupId } = req.params;
  const { currentAdminId, newAdminId } = req.body || {};

  const group = groups[groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!currentAdminId || !newAdminId) return res.status(400).json({ error: 'currentAdminId and newAdminId required' });

  const members = groupMembers[groupId] || [];
  const currentAdmin = members.find(m => m.userId === currentAdminId);
  const target = members.find(m => m.userId === newAdminId);
  if (!currentAdmin || currentAdmin.role !== 'admin') return res.status(403).json({ error: 'Only admin can transfer admin role' });
  if (!target) return res.status(404).json({ error: 'Target member not found' });

  // Devret
  currentAdmin.role = 'member';
  target.role = 'admin';

  scheduleSave();
  io.to(`group_${groupId}`).emit('admin_transferred', { groupId, from: currentAdminId, to: newAdminId });
  return res.json({ success: true });
});

// Gruptan ayrıl (üye kendi çıkar)
app.post('/api/groups/:groupId/leave', (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body || {};

  const group = groups[groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const members = groupMembers[groupId] || [];
  const me = members.find(m => m.userId === userId);
  if (!me) return res.status(404).json({ error: 'Not a member' });

  // Eğer tek admin ise ayrılmayı engelle
  const admins = members.filter(m => m.role === 'admin');
  if (me.role === 'admin' && admins.length <= 1) {
    return res.status(400).json({ error: 'Last admin cannot leave. Transfer admin first.' });
  }

  groupMembers[groupId] = members.filter(m => m.userId !== userId);
  if (groupLocations[groupId]) delete groupLocations[groupId][userId];

  io.to(`group_${groupId}`).emit('member_left', { groupId, userId });
  scheduleSave();
  return res.json({ success: true });
});

// Üye çıkar (yalnızca admin)
app.post('/api/groups/:groupId/members/:userId/remove', (req, res) => {
  const { groupId, userId } = req.params;
  const { adminUserId } = req.body || {};

  const group = groups[groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = groupMembers[groupId] || [];
  const isAdmin = members.some(m => m.userId === adminUserId && m.role === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const target = members.find(m => m.userId === userId);
  if (!target) return res.status(404).json({ error: 'Member not found' });

  // Son admin silinemez
  if (target.role === 'admin' && members.filter(m => m.role === 'admin').length <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last admin' });
  }

  groupMembers[groupId] = members.filter(m => m.userId !== userId);
  if (groupLocations[groupId]) delete groupLocations[groupId][userId];

  io.to(`group_${groupId}`).emit('member_removed', { groupId, userId });
  scheduleSave();
  return res.json({ success: true });
});

app.post('/api/groups/:groupId/requests/:requestId/reject', (req, res) => {
  const { groupId, requestId } = req.params;
  const { adminUserId } = req.body;
  
  // Admin kontrolü
  const group = groups[groupId];
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  const isAdmin = groupMembers[groupId]?.some(m => m.userId === adminUserId && m.role === 'admin');
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const request = groupRequests[groupId]?.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  request.status = 'rejected';
  scheduleSave();
  res.json({ success: true });
});

app.get('/api/groups/:code/info', (req, res) => {
  const codeParam = req.params.code;
  const code = String(codeParam || '').toUpperCase();
  const group = Object.values(groups).find(g => String(g.code || '').toUpperCase() === code);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  // Hassas olmayan bilgiler (harita için gerekli alanlar dahil)
  const publicInfo = {
    id: group.id,
    code: group.code,
    name: group.name,
    address: group.address,
    lat: group.lat ?? null,
    lng: group.lng ?? null,
    memberCount: groupMembers[group.id]?.length || 0,
    workRadius: group.workRadius || 150,
  };
  
  res.json(publicInfo);
});

// Grup merkezini ve iş alanı yarıçapını güncelle
app.put('/api/groups/:groupId/center', (req, res) => {
  const { groupId } = req.params;
  const { lat, lng, workRadius } = req.body || {};
  const group = groups[groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });

  if (typeof lat === 'number') group.lat = lat;
  if (typeof lng === 'number') group.lng = lng;
  if (workRadius !== undefined) {
    const r = Number(workRadius);
    if (!Number.isNaN(r) && r > 0) group.workRadius = r;
  }

  scheduleSave();
  return res.json({
    id: group.id,
    code: group.code,
    name: group.name,
    address: group.address,
    lat: group.lat ?? null,
    lng: group.lng ?? null,
    workRadius: group.workRadius || 150,
  });
});

app.get('/api/groups/:groupId/members', (req, res) => {
  const { groupId } = req.params;
  const members = groupMembers[groupId] || [];
  res.json(members);
});

// Leave all groups for a user; if user is the last admin of a group, delete that group
app.post('/api/groups/user/:userId/leave-all', (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  let leftCount = 0;
  let deletedCount = 0;

  for (const gid of Object.keys(groups)) {
    const members = groupMembers[gid] || [];
    const me = members.find(m => m.userId === userId);
    if (!me) continue;

    const admins = members.filter(m => m.role === 'admin');
    const isLastAdmin = me.role === 'admin' && admins.length <= 1;

    if (isLastAdmin) {
      // Delete whole group if the only admin is leaving during purge
      delete groups[gid];
      delete groupMembers[gid];
      delete groupRequests[gid];
      delete groupLocations[gid];
      io.to(`group_${gid}`).emit('group_deleted', { groupId: gid });
      deletedCount++;
    } else {
      // Remove member from group
      groupMembers[gid] = members.filter(m => m.userId !== userId);
      if (groupLocations[gid]) delete groupLocations[gid][userId];
      io.to(`group_${gid}`).emit('member_left', { groupId: gid, userId });
      leftCount++;
    }
  }

  scheduleSave();
  return res.json({ success: true, leftCount, deletedCount });
});

// Grup konum güncellemeleri
app.post('/api/groups/:groupId/locations', (req, res) => {
  const { groupId } = req.params;
  const { userId, lat, lng, heading, accuracy, timestamp } = req.body;
  
  if (!groupId || !userId || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Invalid location data' });
  }
  
  // Üye kontrolü
  const isMember = groupMembers[groupId]?.some(m => m.userId === userId);
  if (!isMember) {
    return res.status(403).json({ error: 'Not a group member' });
  }
  
  // Konumu güncelle
  if (!groupLocations[groupId]) {
    groupLocations[groupId] = {};
  }
  
  const now = Date.now();
  
  groupLocations[groupId][userId] = {
    lat,
    lng,
    heading: heading || null,
    accuracy: accuracy || null,
    timestamp: timestamp || now,
    lastSeen: now
  };
  
  // Kullanıcı durumunu güncelle
  userStatus[userId] = {
    isOnline: true,
    lastSeen: now,
    lastLocation: { lat, lng }
  };
  
  // Gerçek zamanlı güncelleme
  io.to(`group_${groupId}`).emit('location_update', {
    groupId,
    userId,
    location: groupLocations[groupId][userId]
  });
  
  // Geofence kontrolü: grup merkezi ve workRadius varsa ve kullanıcının konumu dışarıdaysa uyarı yayınla
  const g = groups[groupId];
  if (g && typeof g.lat === 'number' && typeof g.lng === 'number') {
    const radius = Number(g.workRadius || 150);
    const dist = haversineDistance(g.lat, g.lng, lat, lng); // metre
    if (!Number.isNaN(dist) && dist > radius) {
      io.to(`group_${groupId}`).emit('geofence_violation', {
        groupId,
        userId,
        distance: Math.round(dist),
        radius,
        center: { lat: g.lat, lng: g.lng },
        at: Date.now()
      });
    }
  }
  
  scheduleSave();
  res.json({ success: true });
});

app.get('/api/groups/:groupId/locations', (req, res) => {
  const { groupId } = req.params;
  const locations = groupLocations[groupId] || {};
  res.json(locations);
});

// Grup üyelerini konumlarıyla birlikte getir (yönetici için)
app.get('/api/groups/:groupId/members-with-locations', (req, res) => {
  const { groupId } = req.params;
  
  const members = groupMembers[groupId] || [];
  const locations = groupLocations[groupId] || {};
  
  // Üye bilgilerini konumlarla birleştir
  const membersWithLocations = members.map(member => {
    const location = locations[member.userId];
    const user = users[member.userId]; // Düzeltildi: Object.values yerine doğrudan erişim
    
    return {
      userId: member.userId,
      displayName: user?.name || member.userId,
      email: user?.email || '',
      role: member.role,
      joinedAt: member.joinedAt,
      location: location || null,
      isOnline: location ? (Date.now() - location.timestamp < 300000) : false, // 5 dakika
      lastSeen: location?.timestamp || null
    };
  });
  
  res.json(membersWithLocations);
});

// Kullanıcının aktif olduğu grupları getir (detaylı)
app.get('/api/groups/user/:userId/active', (req, res) => {
  const { userId } = req.params;
  const userGroups = [];
  
  for (const groupId of Object.keys(groups)) {
    const group = groups[groupId];
    const members = groupMembers[groupId] || [];
    
    // Kullanıcı bu grubun üyesi mi kontrol et
    const isMember = members.some(member => member.userId === userId);
    if (isMember) {
      const locs = groupLocations[groupId] || {};
      const onlineCount = Object.values(locs).filter(loc => 
        loc.timestamp && (Date.now() - loc.timestamp < 300000)
      ).length;
      
      const userRole = members.find(m => m.userId === userId)?.role || 'member';
      
      userGroups.push({
        id: group.id,
        code: group.code,
        name: group.name,
        address: group.address,
        lat: group.lat,
        lng: group.lng,
        memberCount: members.length,
        onlineCount: onlineCount,
        createdAt: group.createdAt,
        userRole: userRole,
        isAdmin: userRole === 'admin'
      });
    }
  }
  
  res.json(userGroups);
});

// Kullanıcının admin olduğu grupları getir
app.get('/api/groups/user/:userId/admin', (req, res) => {
  const { userId } = req.params;
  const adminGroups = [];
  
  for (const groupId of Object.keys(groups)) {
    const group = groups[groupId];
    const members = groupMembers[groupId] || [];
    
    // Kullanıcı bu grubun admini mi kontrol et
    const isAdmin = members.some(member => member.userId === userId && member.role === 'admin');
    if (isAdmin) {
      adminGroups.push({
        id: group.id,
        code: group.code,
        name: group.name,
        address: group.address,
        memberCount: members.length,
        createdAt: group.createdAt
      });
    }
  }
  
  res.json(adminGroups);
});

// Socket.IO bağlantıları
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}`);
    console.log(`User ${socket.id} joined group ${groupId}`);
  });
  
  socket.on('leave_group', (groupId) => {
    socket.leave(`group_${groupId}`);
    console.log(`User ${socket.id} left group ${groupId}`);
  });
  
  // Grup konum güncellemesi (client'tan gelen)
  socket.on('group_location_update', (data) => {
    const { groupId, userId, lat, lng, heading, accuracy, timestamp } = data;
    
    if (!groupId || !userId || lat === undefined || lng === undefined) {
      console.warn('Invalid location data received via socket');
      return;
    }
    
    // Üye kontrolü
    const isMember = groupMembers[groupId]?.some(m => m.userId === userId);
    if (!isMember) {
      console.warn(`User ${userId} is not a member of group ${groupId}`);
      return;
    }
    
    // Konumu güncelle
    if (!groupLocations[groupId]) {
      groupLocations[groupId] = {};
    }
    
    groupLocations[groupId][userId] = {
      lat,
      lng,
      heading: heading || null,
      accuracy: accuracy || null,
      timestamp: timestamp || Date.now()
    };
    
    // Gruptaki diğer üyelere yayınla
    socket.to(`group_${groupId}`).emit('location_update', {
      groupId,
      userId,
      location: groupLocations[groupId][userId]
    });
    
    scheduleSave();
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Dashboard endpoint - Aktif işçi, grup, mesafe, uyarı sayıları
app.get('/api/dashboard/:userId', (req, res) => {
  const { userId } = req.params;

  // Kullanıcının üye olduğu grupları bul
  const userGroups = Object.keys(groupMembers).filter(gid => 
    groupMembers[gid]?.some(m => m.userId === userId)
  );

  // Aktif işçi sayısı (son 15 dakikada konum paylaşan) — kullanıcının grupları dahilinde
  const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
  const activeWorkers = new Set();
  userGroups.forEach(gid => {
    const locs = groupLocations[gid] || {};
    Object.entries(locs).forEach(([uid, loc]) => {
      if (loc.timestamp && loc.timestamp > fifteenMinAgo) activeWorkers.add(uid);
    });
  });

  // Bugünkü toplam mesafe — kullanıcının kendi konum geçmişinden hesapla
  const userLocations = store[userId] || [];
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayLocations = userLocations.filter(l => l.timestamp >= todayStart);
  let todayDistance = 0;
  for (let i = 1; i < todayLocations.length; i++) {
    const prev = todayLocations[i - 1].coords;
    const curr = todayLocations[i].coords;
    todayDistance += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }

  const activeAlerts = 0;

  res.json({
    activeWorkers: activeWorkers.size,
    totalGroups: userGroups.length,
    todayDistance: Math.round(todayDistance),
    activeAlerts
  });
});

// Purge user's location/meta/status data
app.post('/api/user/:userId/purge', (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  delete store[userId];
  delete meta[userId];
  delete userStatus[userId];

  // Remove from groupLocations entries
  for (const gid of Object.keys(groupLocations)) {
    if (groupLocations[gid] && groupLocations[gid][userId]) {
      delete groupLocations[gid][userId];
    }
  }

  scheduleSave();
  return res.json({ success: true });
});

// Activities endpoint - Son aktiviteler
app.get('/api/activities', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const userId = req.userId;
  
  const activities = [];
  
  // Kullanıcının gruplarındaki son aktiviteleri topla
  if (userId) {
    const userGroups = Object.keys(groupMembers).filter(gid => 
      groupMembers[gid]?.some(m => m.userId === userId)
    );
    
    userGroups.forEach(gid => {
      const members = groupMembers[gid] || [];
      const locs = groupLocations[gid] || {};
      
      // Son konum güncellemeleri
      Object.entries(locs).forEach(([uid, loc]) => {
        const user = users[uid];
        activities.push({
          id: `loc_${uid}_${loc.timestamp}`,
          type: 'location',
          message: `${user?.name || 'Kullanıcı'} konumunu güncelledi`,
          timestamp: loc.timestamp || Date.now(),
          userId: uid
        });
      });
      
      // Son katılımlar
      members.slice(-5).forEach(m => {
        const user = users[m.userId];
        activities.push({
          id: `join_${m.userId}_${m.joinedAt}`,
          type: 'join',
          message: `${user?.name || 'Kullanıcı'} gruba katıldı`,
          timestamp: m.joinedAt || Date.now(),
          userId: m.userId
        });
      });
    });
  }
  
  // Zamana göre sırala ve limit uygula
  activities.sort((a, b) => b.timestamp - a.timestamp);
  
  res.json(activities.slice(0, limit));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Server başlatma
server.listen(PORT, () => {
  console.log(`🚀 İşçi Takip API running on port ${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
});
