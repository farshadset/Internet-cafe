const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const db = require('./db');

const isVercel = !!process.env.VERCEL;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is required. Set it in Vercel dashboard.');
    process.exit(1);
}

// ==================== PASSWORD HASHING ====================
function hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return salt + ':' + hash;
}

function verifyPassword(password, stored) {
    if (!stored) return false;
    if (!stored.includes(':')) return false;
    var parts = stored.split(':');
    var salt = parts[0];
    var hash = parts[1];
    var verify = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
}

function isHashed(stored) {
    return stored && stored.includes(':') && stored.split(':')[1].length === 128;
}

// ==================== RATE LIMITER (in-memory) ====================
function rateLimit(windowMs, max) {
    var store = {};
    return function(req, res, next) {
        var key = (req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || 'unknown').split(',')[0].trim();
        var now = Date.now();
        if (!store[key]) store[key] = [];
        store[key] = store[key].filter(function(t) { return t > now - windowMs; });
        if (store[key].length >= max) {
            return res.status(429).json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.' });
        }
        store[key].push(now);
        next();
    };
}

// ==================== ACCOUNT LOCKOUT ====================
const loginAttempts = {};
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

function checkLockout(key) {
    var attempts = loginAttempts[key];
    if (!attempts) return false;
    if (attempts.count >= LOCKOUT_THRESHOLD && (now = Date.now()) - attempts.lastAttempt < LOCKOUT_DURATION) {
        return true;
    }
    if (attempts.count >= LOCKOUT_THRESHOLD && Date.now() - attempts.lastAttempt >= LOCKOUT_DURATION) {
        delete loginAttempts[key];
    }
    return false;
}

function recordFailedAttempt(key) {
    if (!loginAttempts[key]) loginAttempts[key] = { count: 0, lastAttempt: 0 };
    loginAttempts[key].count++;
    loginAttempts[key].lastAttempt = Date.now();
}

function clearAttempts(key) {
    delete loginAttempts[key];
}

// ==================== SECURITY HEADERS ====================
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    if (isVercel) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'self'");
    res.removeHeader('X-Powered-By');
    next();
}

// ==================== INPUT SANITIZATION ====================
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var cleaned = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach(function(key) {
        if (typeof obj[key] === 'string') {
            cleaned[key] = sanitize(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            cleaned[key] = sanitizeObject(obj[key]);
        } else {
            cleaned[key] = obj[key];
        }
    });
    return cleaned;
}

function sanitizeMiddleware(req, res, next) {
    var url = req.originalUrl || '';
    if (url.indexOf('/api/banner') !== -1 || url.indexOf('/api/login') !== -1 || url.indexOf('/api/register') !== -1) return next();
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }
    next();
}

function signJWT(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
    return header + '.' + body + '.' + sig;
}

function verifyJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const sig = crypto.createHmac('sha256', JWT_SECRET).update(parts[0] + '.' + parts[1]).digest('base64url');
        if (sig !== parts[2]) return null;
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch { return null; }
}

function getToken(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    const cookie = req.headers.cookie || '';
    const m = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
}

function requireAdmin(req, res, next) {
    var token = getToken(req);
    if (!token) {
        var auth = req.headers.authorization || '';
        if (auth.startsWith('Bearer ')) token = auth.slice(7);
    }
    const payload = verifyJWT(token);
    if (!payload || !payload.isAdmin) return res.status(401).json({ error: 'دسترسی غیرمجاز' });
    req.user = payload;
    next();
}

const app = express();
const rootDir = path.resolve(__dirname);

// Security headers
app.use(securityHeaders);

// Rate limit: 5 requests per minute for login/register
const authRateLimit = rateLimit(60 * 1000, 5);
// Rate limit: 10 requests per minute for write operations
const writeRateLimit = rateLimit(60 * 1000, 30);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(sanitizeMiddleware);

const oneYear = 1000 * 60 * 60 * 24 * 365;
const staticOptions = {
  maxAge: oneYear,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const pathString = filePath.toString();
    if (pathString.endsWith('.html') || pathString.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
};
app.use(function(req, res, next) {
    var p = req.path;
    if (p === '/admin.html' || p === '/admin' || /^\/admin-[\w-]+\.html$/.test(p)) {
        var payload = verifyJWT(getToken(req));
        if (!payload || !payload.isAdmin) return res.redirect('/login.html');
    }
    next();
});

app.use('/public', express.static(path.join(rootDir, 'public'), staticOptions));
app.use(express.static(path.join(rootDir, 'public'), staticOptions));

const ATTACHMENTS_DIR = path.join(rootDir, 'public', 'uploads', 'attachments');
const BANNERS_DIR = path.join(rootDir, 'public', 'uploads', 'banners');

try { fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true }); } catch(e) {}
try { fs.mkdirSync(BANNERS_DIR, { recursive: true }); } catch(e) {}

function sanitizeAttachmentName(name) {
    const safeName = String(name || 'attachment')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 120);
    return safeName || 'attachment';
}

function decodeDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
        type: match[1],
        buffer: Buffer.from(match[2], 'base64')
    };
}

// ==================== DATABASE INIT ====================
const dbReady = db.initDB().then(async () => {
    try {
        await db.migrateFromJSON();
        console.log('Database initialized with @libsql/client');
    } catch (e) {
        console.error('DB init migration error:', e.message || e);
    }

    try {
        // Ensure admin user exists from env vars
        var adminUsername = process.env.ADMIN_USERNAME;
        var adminPassword = process.env.ADMIN_PASSWORD;
        console.log('ADMIN_USERNAME:', adminUsername ? 'set (' + adminUsername + ')' : 'NOT SET');
        console.log('ADMIN_PASSWORD:', adminPassword ? 'set' : 'NOT SET');
        if (adminUsername && adminPassword) {
            var existingAdmin = await db.getUser(adminUsername);
            if (!existingAdmin) {
                await db.createUser(adminUsername, hashPassword(adminPassword), true);
                console.log('Admin user CREATED. Username: ' + adminUsername);
            } else {
                // Always update password and admin flag from env vars
                await db.setAdminUser(adminUsername, true);
                await db.updateUserPassword(adminUsername, hashPassword(adminPassword));
                console.log('Admin user UPDATED. Username: ' + adminUsername);
            }
        } else {
            console.warn('WARNING: ADMIN_USERNAME and ADMIN_PASSWORD env vars not set.');
        }

        // Hash any remaining plaintext passwords
        var client = db.getClient();
        var allUsers = await client.execute('SELECT username, password FROM users');
        for (const u of allUsers.rows) {
            if (u.password && !isHashed(u.password)) {
                await db.updateUserPassword(u.username, hashPassword(u.password));
            }
        }
    } catch (e) {
        console.error('Admin migration error:', e.message || e);
    }
}).catch(function(e) {
    console.error('dbReady error:', e.message || e);
});

// ==================== AUTH ROUTES ====================
app.post('/api/register', authRateLimit, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    if (String(username).length < 3 || String(username).length > 30) return res.status(400).json({ error: 'نام کاربری باید بین ۳ تا ۳۰ کاراکتر باشد' });
    if (String(password).length < 8) return res.status(400).json({ error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' });
    if (!/[A-Z]/.test(String(password)) || !/[a-z]/.test(String(password)) || !/[0-9]/.test(String(password))) {
        return res.status(400).json({ error: 'رمز عبور باید شامل حروف بزرگ، کوچک و اعداد باشد' });
    }
    if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(String(username))) return res.status(400).json({ error: 'نام کاربری فقط شامل حروف، اعداد و _ باشد' });
    const existing = await db.getUser(username);
    if (existing) {
        return res.status(400).json({ error: 'کاربر وجود دارد' });
    }
    await db.createUser(username, hashPassword(password), false);
    res.json({ success: true });
});

app.post('/api/login', authRateLimit, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    const lockKey = 'user:' + username;
    if (checkLockout(lockKey)) return res.status(429).json({ error: 'حساب شما به دلیل تلاش‌های ناموفق زیاد قفل شده است. ۱۵ دقیقه صبر کنید.' });
    const user = await db.getUserWithPassword(username);
    if (!user || !verifyPassword(password, user.password)) {
        recordFailedAttempt(lockKey);
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
    clearAttempts(lockKey);
    if (!isHashed(user.password)) {
        await db.updateUserPassword(username, hashPassword(password));
    }
    res.json({ success: true });
});

app.post('/api/admin/login', authRateLimit, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    const lockKey = 'admin:' + username;
    if (checkLockout(lockKey)) {
        console.log('Admin lockout active for:', username);
        return res.status(429).json({ error: 'حساب مدیر به دلیل تلاش‌های ناموفق زیاد قفل شده است. ۱۵ دقیقه صبر کنید.' });
    }
    const admin = await db.getUserWithPassword(username);
    if (!admin || !admin.isAdmin || !verifyPassword(password, admin.password)) {
        recordFailedAttempt(lockKey);
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
    clearAttempts(lockKey);
    if (!isHashed(admin.password)) {
        await db.updateUserPassword(username, hashPassword(password));
    }
    var token = signJWT({ username: username, isAdmin: true });
    var cookieFlags = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400';
    if (isVercel) cookieFlags += '; Secure';
    res.setHeader('Set-Cookie', 'token=' + encodeURIComponent(token) + '; ' + cookieFlags);
    res.json({ success: true, token: token });
});

app.get('/api/debug-admin', async (req, res) => {
    var adminUsername = process.env.ADMIN_USERNAME || '(not set)';
    var adminPassword = process.env.ADMIN_PASSWORD;
    var pwInfo = adminPassword ? 'length=' + adminPassword.length + ', chars=' + Array.from(adminPassword).map(function(c) { return 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'); }).join(' ') : '(not set)';
    var admin = null;
    try {
        admin = await db.getUserWithPassword(adminUsername);
    } catch (e) {}
    res.json({
        envUsername: adminUsername,
        envPasswordInfo: pwInfo,
        dbUserFound: !!admin,
        isAdmin: admin ? !!admin.isAdmin : false,
        passwordStored: admin ? admin.password.substring(0, 20) + '...' : null
    });
});

// ==================== ORDER ROUTES ====================
app.post('/api/order', writeRateLimit, async (req, res) => {
    const trackingCode = 'CFT-' + Date.now().toString().slice(-8);
    const allowedFields = ['username', 'serviceType', 'title', 'description', 'phone', 'nationalId',
        'postalCode', 'address', 'plateNumber', 'violationNumber', 'appealReason',
        'applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay',
        'marriageYear', 'marriageMonth', 'marriageDay', 'idNumber', 'additionalNotes',
        'regionCode', 'educationLevel', 'familyCount', 'iban', 'contractNumber',
        'depositAmount', 'passportNumber', 'examType', 'city', 'operator', 'internetType',
        'ownershipStatus'];
    const order = { trackingCode, created_at: new Date() };
    const username = (req.body.username || '').trim();
    if (username) order.username = username;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) order[field] = req.body[field];
    }
    await db.createOrder(order);
    res.json({ success: true, trackingCode });
});

app.get('/api/order/:trackingCode', requireAdmin, async (req, res) => {
    const { trackingCode } = req.params;
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    res.json(order);
});

app.post('/api/order-attachment', writeRateLimit, async (req, res) => {
    const { trackingCode, attachment } = req.body;
    if (!trackingCode || !/^[A-Za-z0-9-]+$/.test(trackingCode)) {
        return res.status(400).json({ error: 'کد سفارش نامعتبر است' });
    }
    if (!attachment || !attachment.name || !attachment.dataUrl) {
        return res.status(400).json({ error: 'فایل پیوست نامعتبر است' });
    }

    const decoded = decodeDataUrl(attachment.dataUrl);
    if (!decoded || decoded.buffer.length === 0) {
        return res.status(400).json({ error: 'داده فایل نامعتبر است' });
    }
    var allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(decoded.type)) {
        return res.status(400).json({ error: 'فقط فایل‌های تصویری (jpg, png, gif, webp) و PDF مجاز هستند' });
    }
    if (decoded.buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'حجم فایل نباید بیش از ۵ مگابایت باشد' });
    }

    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }

    const fileName = sanitizeAttachmentName(attachment.name);
    const orderDir = path.join(ATTACHMENTS_DIR, trackingCode);
    fs.mkdirSync(orderDir, { recursive: true });
    const filePath = path.join(orderDir, fileName);
    fs.writeFileSync(filePath, decoded.buffer);

    const savedAttachment = {
        id: attachment.id || ('att_' + Date.now() + '_' + Math.random().toString(16).slice(2)),
        name: fileName,
        type: attachment.type || decoded.type,
        size: decoded.buffer.length,
        url: '/uploads/attachments/' + encodeURIComponent(trackingCode) + '/' + encodeURIComponent(fileName),
        uploadedAt: attachment.uploadedAt || new Date().toISOString()
    };

    var attachments = order.attachments || [];
    const existingIndex = attachments.findIndex(a => a.id === savedAttachment.id);
    if (existingIndex >= 0) {
        attachments[existingIndex] = savedAttachment;
    } else {
        attachments.push(savedAttachment);
    }
    await db.updateOrder(trackingCode, { attachments });

    res.json({ success: true, attachment: savedAttachment });
});

app.post('/api/order/confirm', requireAdmin, writeRateLimit, async (req, res) => {
    const { trackingCode } = req.body;
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    await db.updateOrder(trackingCode, { status: 'pending', confirmed_at: new Date().toISOString() });
    res.json({ success: true });
});

app.post('/api/order/status', requireAdmin, writeRateLimit, async (req, res) => {
    const { trackingCode, status } = req.body;
    if (!['pending', 'processing', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    await db.updateOrder(trackingCode, { status, updated_at: new Date().toISOString() });
    res.json({ success: true });
});

app.post('/api/order/result', requireAdmin, writeRateLimit, async (req, res) => {
    const { trackingCode, result } = req.body;
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    var updates = { result_at: new Date().toISOString() };
    if (result && result.trim()) {
        updates.result = result.trim();
    } else {
        updates.result = null;
    }
    await db.updateOrder(trackingCode, updates);
    res.json({ success: true });
});

app.post('/api/order/price-proposal', writeRateLimit, async (req, res) => {
    const { trackingCode, proposedPrice } = req.body;
    if (!trackingCode || !proposedPrice) {
        return res.status(400).json({ error: 'کد سفارش و قیمت الزامی است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    await db.updateOrder(trackingCode, { proposedPrice, priceStatus: 'usercounter', updated_at: new Date().toISOString() });
    res.json({ success: true });
});

app.post('/api/order/price-counter', requireAdmin, writeRateLimit, async (req, res) => {
    const { trackingCode, adminProposedPrice } = req.body;
    if (!trackingCode || !adminProposedPrice) {
        return res.status(400).json({ error: 'کد سفارش و قیمت الزامی است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    await db.updateOrder(trackingCode, { adminProposedPrice, priceStatus: 'countersent', updated_at: new Date().toISOString() });
    res.json({ success: true });
});

app.post('/api/order/price-accept', requireAdmin, writeRateLimit, async (req, res) => {
    const { trackingCode } = req.body;
    if (!trackingCode) {
        return res.status(400).json({ error: 'کد سفارش الزامی است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    await db.updateOrder(trackingCode, {
        priceStatus: 'accepted',
        cost: 'قیمت توافقی - ' + (order.adminProposedPrice || order.proposedPrice),
        updated_at: new Date().toISOString()
    });
    res.json({ success: true });
});

app.post('/api/order/pay', requireAdmin, writeRateLimit, async (req, res) => {
    const { trackingCode } = req.body;
    if (!trackingCode) {
        return res.status(400).json({ error: 'کد سفارش الزامی است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    if (order.priceStatus !== 'accepted') {
        return res.status(400).json({ error: 'قیمت هنوز تایید نشده است' });
    }
    await db.updateOrder(trackingCode, { paid: true, paymentStatus: 'paid', updated_at: new Date().toISOString() });
    res.json({ success: true });
});

app.post('/api/change-password', authRateLimit, async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'رمز فعلی و رمز جدید الزامی است' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'رمز جدید باید حداقل ۸ کاراکتر باشد' });
    if (!/[A-Z]/.test(String(newPassword)) || !/[a-z]/.test(String(newPassword)) || !/[0-9]/.test(String(newPassword))) {
        return res.status(400).json({ error: 'رمز جدید باید شامل حروف بزرگ، کوچک و اعداد باشد' });
    }
    var token = getToken(req);
    var payload = token ? verifyJWT(token) : null;
    var targetUsername = username;
    if (!payload || !payload.isAdmin) {
        if (!payload || payload.username !== username) {
            return res.status(403).json({ error: 'فقط می‌توانید رمز خودتان را تغییر دهید' });
        }
        targetUsername = payload.username;
    }
    const user = await db.getUserWithPassword(targetUsername);
    if (!user) return res.status(404).json({ error: 'کاربر پیدا نشد' });
    if (!verifyPassword(currentPassword, user.password)) {
        return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
    }
    await db.updateUserPassword(targetUsername, hashPassword(newPassword));
    res.json({ success: true });
});

// ==================== VISIT TRACKING ====================
const lastVisitTime = {};

app.post('/api/track-visit', rateLimit(30 * 60 * 1000, 20), async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = new Date();
    const COOLDOWN = 30 * 60 * 1000;
    if (lastVisitTime[ip] && (now.getTime() - lastVisitTime[ip]) < COOLDOWN) {
        return res.json({ success: true, counted: false });
    }
    lastVisitTime[ip] = now.getTime();
    const key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    await db.trackVisit(key);
    res.json({ success: true, counted: true });
});

app.get('/api/visits', async (req, res) => {
    const visits = await db.getAllVisits();
    res.json(visits);
});

// ==================== ORDERS LIST ====================
app.get('/api/orders', requireAdmin, async (req, res) => {
    const { status } = req.query;
    const orders = await db.getAllOrders(status);
    res.json(orders);
});

app.get('/api/orders/user', requireAdmin, async (req, res) => {
    const { username, status } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    const userOrders = await db.getUserOrders(username, status);
    res.json(userOrders);
});

app.get('/api/admin/customers', requireAdmin, async (req, res) => {
    const completedOrders = await db.getCompletedOrders();

    var customerStats = {};
    var uniqueCustomers = new Set();
    completedOrders.forEach(function(order) {
        var username = order.username;
        if (!username) return;
        uniqueCustomers.add(username);

        if (!customerStats[username]) {
            customerStats[username] = {
                username: username,
                totalOrders: 0,
                totalSpent: 0,
                orders: []
            };
        }

        customerStats[username].totalOrders += 1;
        customerStats[username].orders.push({
            trackingCode: order.trackingCode,
            title: order.title,
            created_at: order.created_at,
            result: order.result
        });

        var orderCost = 0;
        if (order.paid && order.adminProposedPrice) {
            var priceStr = String(order.adminProposedPrice).replace(/[۰-۹]/g, function(d) { return d.charCodeAt(0) - 0x06F0; });
            priceStr = priceStr.replace(/[,٬٫]/g, '').replace(/[^\d]/g, '');
            if (priceStr) orderCost = parseInt(priceStr, 10);
        } else if (order.paid && order.proposedPrice) {
            var priceStr = String(order.proposedPrice).replace(/[۰-۹]/g, function(d) { return d.charCodeAt(0) - 0x06F0; });
            priceStr = priceStr.replace(/[,٬٫]/g, '').replace(/[^\d]/g, '');
            if (priceStr) orderCost = parseInt(priceStr, 10);
        } else if (order.cost) {
            var costStr = String(order.cost).replace(/[۰-۹]/g, function(d) { return d.charCodeAt(0) - 0x06F0; });
            costStr = costStr.replace(/[,٬٫]/g, '').replace(/[^\d]/g, '');
            if (costStr) orderCost = parseInt(costStr, 10);
        }

        customerStats[username].totalSpent += orderCost;
    });

    var customersList = Object.keys(customerStats).map(function(k) {
        return customerStats[k];
    });
    customersList.sort(function(a, b) { return b.totalSpent - a.totalSpent; });

    res.json({ customers: customersList, totalCustomers: uniqueCustomers.size });
});

// ==================== PRICING ====================
app.get('/api/pricing', async (req, res) => {
    const pricing = await db.getPricing();
    res.json(pricing);
});

app.post('/api/pricing', requireAdmin, writeRateLimit, async (req, res) => {
    const { service, price } = req.body;
    if (!service) {
        return res.status(400).json({ error: 'سرویس الزامی است' });
    }
    await db.upsertPricing(service, price);
    res.json({ success: true });
});

function sanitizeBannerLink(link) {
    if (!link || typeof link !== 'string') return '';
    var trimmed = link.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return '';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) return '';
    return trimmed;
}

function sanitizeBannerSrc(src) {
    if (!src || typeof src !== 'string') return '';
    var trimmed = src.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (trimmed.startsWith('/uploads/')) return trimmed;
    return '';
}

// ==================== BANNER UPLOAD ====================
app.post('/api/banner/upload', requireAdmin, writeRateLimit, async (req, res) => {
    try {
        var image = req.body && req.body.image;
        if (!image || !image.dataUrl || !image.name) {
            return res.status(400).json({ error: 'فایل تصویر نامعتبر است' });
        }
        var dataUrl = String(image.dataUrl).trim();
        var match = dataUrl.match(/^data:image\/([a-z0-9.+-]+);base64,(.+)$/i);
        if (!match) {
            return res.status(400).json({ error: 'فرمت تصویر پشتیبانی نمی‌شود' });
        }
        var buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'حجم تصویر نباید بیش از ۲ مگابایت باشد' });
        }
        res.json({ success: true, url: dataUrl, name: image.name });
    } catch (e) {
        console.error('Banner upload error:', e.message);
        res.status(500).json({ error: 'خطا در آپلود تصویر' });
    }
});

// ==================== BANNER ROUTES ====================
app.post('/api/banner', requireAdmin, writeRateLimit, async (req, res) => {
    const { src, link, duration, group } = req.body;
    var safeLink = sanitizeBannerLink(link);
    var safeSrc = sanitizeBannerSrc(src);
    if (!safeSrc) {
        return res.status(400).json({ error: 'منبع تصویر نامعتبر است' });
    }
    const targetGroup = [1, 2].includes(parseInt(group, 10)) ? parseInt(group, 10) : 1;
    const groupBanners = await db.getBanners(targetGroup);
    if (groupBanners.length >= 6) {
        return res.status(400).json({ error: 'حداکثر تعداد بنرهای هر گروه ۶ عدد است' });
    }
    await db.createBanner(
        Date.now(),
        safeSrc,
        safeLink,
        parseInt(duration) || 5,
        targetGroup,
        new Date().toISOString()
    );
    res.json({ success: true });
});

app.get('/api/banner', async (req, res) => {
    const { group } = req.query;
    if (group) {
        const groupNum = parseInt(group);
        if (!Number.isNaN(groupNum)) {
            const banners = await db.getBanners(groupNum);
            return res.json(banners);
        }
    }
    const allBanners = await db.getBanners();
    res.json(allBanners);
});

app.delete('/api/banner/:id', requireAdmin, writeRateLimit, async (req, res) => {
    const id = parseInt(req.params.id);
    const banner = await db.getBannerById(id);
    if (banner && banner.src && banner.src.startsWith('/uploads/banners/')) {
        try {
            const filename = decodeURIComponent(banner.src.replace('/uploads/banners/', ''));
            const filepath = path.resolve(BANNERS_DIR, filename);
            if (filepath.startsWith(path.resolve(BANNERS_DIR)) && fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        } catch (e) {}
    }
    await db.deleteBanner(id);
    res.json({ success: true });
});

// Mega menu API
app.get('/api/mega-menu', async (req, res) => {
  const menuPath = path.join(rootDir, 'public', 'mega-menu.html');
  try {
    const html = fs.readFileSync(menuPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    res.status(500).json({ error: 'مگا منو یافت نشد' });
  }
});

app.put('/api/banner/:id', requireAdmin, writeRateLimit, async (req, res) => {
    const id = parseInt(req.params.id);
    const { src, link, duration, group } = req.body;
    var safeLink = sanitizeBannerLink(link);
    var safeSrc = sanitizeBannerSrc(src);
    if (!safeSrc) {
        return res.status(400).json({ error: 'منبع تصویر نامعتبر است' });
    }
    const banner = await db.getBannerById(id);
    if (!banner) {
        return res.status(404).json({ error: 'بنر پیدا نشد' });
    }
    var newGroup = [1, 2].includes(parseInt(group, 10)) ? parseInt(group, 10) : (parseInt(banner.group, 10) || 1);
    if (newGroup !== parseInt(banner.group, 10)) {
        var groupBanners = await db.getBanners(newGroup);
        if (groupBanners.length >= 6) {
            return res.status(400).json({ error: 'حداکثر تعداد بنرهای هر گروه ۶ عدد است' });
        }
    }
    if (banner.src !== src && banner.src && banner.src.startsWith('/uploads/banners/')) {
        try {
            const oldFile = decodeURIComponent(banner.src.replace('/uploads/banners/', ''));
            const oldPath = path.resolve(BANNERS_DIR, oldFile);
            if (oldPath.startsWith(path.resolve(BANNERS_DIR)) && fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        } catch (e) {}
    }
    await db.updateBanner(id, safeSrc, safeLink, parseInt(duration) || 5, newGroup);
    res.json({ success: true });
});

// ==================== CHAT ROUTES ====================
app.get('/api/chat', requireAdmin, async (req, res) => {
    const { username } = req.query;
    const messages = await db.getChatMessages(username);
    res.json(messages);
});

app.post('/api/chat', writeRateLimit, async (req, res) => {
    const { username, text, conversationId, attachments } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'متن پیام الزامی است' });
    }
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'customer',
        username: username || 'مهمان',
        text: text.trim(),
        timestamp: new Date().toISOString(),
        conversationId: conversationId || null,
        attachments: Array.isArray(attachments) ? attachments : []
    };
    await db.addChatMessage(message);
    res.json(message);
});

app.get('/api/admin/chat', requireAdmin, async (req, res) => {
    const { messages, lastReadAt } = await db.getAdminChatData();
    res.json({ messages, lastReadAt });
});

app.post('/api/admin/chat/read', requireAdmin, writeRateLimit, async (req, res) => {
    const { lastReadAt } = req.body;
    if (lastReadAt) {
        await db.setChatMeta('lastReadAt', lastReadAt);
    }
    res.json({ success: true });
});

app.post('/api/admin/chat', requireAdmin, writeRateLimit, async (req, res) => {
    const { text, username, conversationId, attachments } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'متن پیام الزامی است' });
    }
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'admin',
        username: username || null,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        conversationId: conversationId || null,
        attachments: Array.isArray(attachments) ? attachments : []
    };
    await db.addChatMessage(message);
    res.json(message);
});

app.get('/api/admin/chat/conversation', requireAdmin, async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    var allMessages = await db.getChatMessages();
    var messages = allMessages.filter(function(m) {
        return (m.role === 'customer' && m.username === username) || (m.role === 'admin' && !m.username);
    });
    messages.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    res.json(messages);
});

app.get('/api/admin/chat/conversations', requireAdmin, async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    var allMessages = await db.getChatMessages();
    var convs = {};
    allMessages.forEach(function(m) {
        if (m.role === 'customer' && m.username === username && m.conversationId) {
            if (!convs[m.conversationId]) {
                convs[m.conversationId] = {
                    id: m.conversationId,
                    username: m.username,
                    createdAt: m.timestamp,
                    lastMessage: m.text,
                    lastTimestamp: m.timestamp,
                    messageCount: 0
                };
            }
            convs[m.conversationId].lastMessage = m.text;
            convs[m.conversationId].lastTimestamp = m.timestamp;
            convs[m.conversationId].messageCount++;
        }
    });
    var list = Object.keys(convs).map(function(k) { return convs[k]; });
    list.sort(function(a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    res.json(list);
});

app.get('/api/admin/chat/conversation/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const messages = await db.getChatMessagesForConversation(id);
    res.json(messages);
});

app.get('/api/admin/chat/customers', requireAdmin, async (req, res) => {
    var allMessages = await db.getChatMessages();
    var customers = {};
    allMessages.forEach(function(m) {
        if (m.role === 'customer') {
            if (!customers[m.username]) {
                customers[m.username] = { username: m.username, lastMessage: m.text, lastTimestamp: m.timestamp, unread: 0 };
            }
            customers[m.username].lastMessage = m.text;
            customers[m.username].lastTimestamp = m.timestamp;
        }
    });
    var lastAdminGlobal = await db.getChatMeta('lastReadAt');
    Object.keys(customers).forEach(function(key) {
        var customer = customers[key];
        var hasAdminReply = allMessages.some(function(m) {
            return m.role === 'admin' && (!m.username || m.username === customer.username) && m.timestamp >= customer.lastTimestamp;
        });
        if (!hasAdminReply) customer.unread = 1;
    });
    var list = Object.keys(customers).map(function(k) { return customers[k]; });
    list.sort(function(a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    res.json(list);
});

app.post('/api/chat/conversation', writeRateLimit, async (req, res) => {
    const { username } = req.body;
    const conv = await db.createConversation(username || 'مهمان');
    res.json(conv);
});

app.get('/api/chat/conversation/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { username } = req.query;
    var messages = await db.getChatMessagesForConversation(id);
    if (username && !messages.some(function(m) { return m.role === 'customer' && m.username === username; })) {
        messages = messages.filter(function(m) { return m.role === 'admin'; });
    }
    res.json(messages);
});

app.get('/api/chat/conversations', requireAdmin, async (req, res) => {
    const { username } = req.query;
    var allMessages = await db.getChatMessages();
    var convs = {};
    allMessages.forEach(function(m) {
        if (!m.conversationId) return;
        if (!convs[m.conversationId]) {
            convs[m.conversationId] = {
                id: m.conversationId,
                username: m.username,
                createdAt: m.timestamp,
                lastMessage: m.text,
                lastTimestamp: m.timestamp,
                messageCount: 0
            };
        }
        convs[m.conversationId].lastMessage = m.text;
        convs[m.conversationId].lastTimestamp = m.timestamp;
        convs[m.conversationId].messageCount++;
    });
    var list = Object.keys(convs).map(function(k) { return convs[k]; });
    if (username) {
        list = list.filter(function(c) { return c.username === username; });
    }
    list.sort(function(a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    res.json(list);
});

// ==================== SERVER ====================
const PORT = process.env.PORT || 3003;
let server;
if (!isVercel && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    server = http.createServer(app);
    const io = new Server(server, { path: '/socket.io' });

    io.use((socket, next) => {
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));
        const payload = verifyJWT(token);
        if (!payload) return next(new Error('Invalid token'));
        socket.user = payload;
        next();
    });

    io.on('connection', (socket) => {
        socket.on('join-admin-room', () => {
            if (socket.user && socket.user.isAdmin) {
                socket.join('admin-room');
            }
        });
        socket.on('customer-typing', (data) => {
            socket.to('admin-room').emit('customer-typing', data);
        });
        socket.on('customer-stop-typing', (data) => {
            socket.to('admin-room').emit('customer-stop-typing', data);
        });
    });

    app.set('io', io);

    server.listen(PORT, () => {
        console.log('Server running on http://localhost:' + PORT);
    });
} else {
    server = app;
}

function emitChatEvent(io, event, data) {
    try {
        if (io && typeof io.to === 'function') {
            io.to('admin-room').emit(event, data);
        }
    } catch (e) {}
}

app.dbReady = dbReady;
module.exports = app;
