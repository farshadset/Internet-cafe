const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const zlib = require('zlib');
const { Server } = require('socket.io');
const db = require('./db');

// ==================== UPSTASH REDIS (optional — falls back to in-memory) ====================
let upstashLimiter = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        const { Redis } = require('@upstash/redis');
        const { Ratelimit } = require('@upstash/ratelimit');
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        upstashLimiter = { Redis, Ratelimit, redis };
        console.log('Upstash Redis rate limiting enabled');
    } catch (e) {
        console.warn('Upstash init failed, using in-memory rate limiter:', e.message);
    }
}

const isVercel = !!process.env.VERCEL;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';
if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set. Using fallback secret. Set JWT_SECRET in Vercel dashboard for production.');
}

// ==================== PASSWORD HASHING (async — non-blocking) ====================
function scryptAsync(password, salt) {
    return new Promise(function(resolve, reject) {
        crypto.scrypt(String(password), salt, 64, function(err, derivedKey) {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = (await scryptAsync(password, salt)).toString('hex');
    return salt + ':' + hash;
}

async function verifyPassword(password, stored) {
    if (!stored) return false;
    if (!stored.includes(':')) return false;
    var parts = stored.split(':');
    var salt = parts[0];
    var hash = parts[1];
    if (!salt || !hash || hash.length !== 128) return false;
    var verify = (await scryptAsync(password, salt)).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
}

function isHashed(stored) {
    return stored && stored.includes(':') && stored.split(':')[1].length === 128;
}

// Per-order locks for attachment uploads (prevents lost updates on concurrent writes)
const orderLocks = {};
function withOrderLock(key, fn) {
    const prev = orderLocks[key] || Promise.resolve();
    const curr = prev.then(fn, fn);
    orderLocks[key] = curr;
    curr.then(() => { if (orderLocks[key] === curr) delete orderLocks[key]; }, () => { if (orderLocks[key] === curr) delete orderLocks[key]; });
    return curr;
}

// ==================== RATE LIMITER (Upstash Redis or in-memory) ====================
const allRateLimitStores = [];
const upstashLimiters = {};

function rateLimit(windowMs, max) {
    // Use Upstash when available
    if (upstashLimiter) {
        var limiterKey = windowMs + ':' + max;
        if (!upstashLimiters[limiterKey]) {
            var windowSec = Math.ceil(windowMs / 1000);
            upstashLimiters[limiterKey] = new upstashLimiter.Ratelimit({
                redis: upstashLimiter.redis,
                limiter: upstashLimiter.Ratelimit.slidingWindow(max, windowSec + 's'),
                analytics: false,
            });
        }
        var ul = upstashLimiters[limiterKey];
        return async function(req, res, next) {
            var key = req.ip || req.connection.remoteAddress || 'unknown';
            try {
                var result = await ul.limit(key);
                if (!result.success) {
                    return res.status(429).json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.' });
                }
                next();
            } catch (e) {
                next(); // fail open on Redis errors
            }
        };
    }
    // Fallback: in-memory rate limiter
    var store = {};
    allRateLimitStores.push({ store: store, windowMs: windowMs });
    return function(req, res, next) {
        var key = req.ip || req.connection.remoteAddress || 'unknown';
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

// ==================== VISIT TRACKING ====================
const lastVisitTime = {};

// Cleanup stale rate limit keys every 5 minutes
setInterval(function() {
    var now = Date.now();
    allRateLimitStores.forEach(function(entry) {
        Object.keys(entry.store).forEach(function(key) {
            entry.store[key] = entry.store[key].filter(function(t) { return t > now - entry.windowMs; });
            if (entry.store[key].length === 0) delete entry.store[key];
        });
    });
    Object.keys(loginAttempts).forEach(function(key) {
        if (Date.now() - loginAttempts[key].lastAttempt >= LOCKOUT_DURATION) {
            delete loginAttempts[key];
        }
    });
    Object.keys(lastVisitTime).forEach(function(key) {
        if (Date.now() - lastVisitTime[key] >= 30 * 60 * 1000) {
            delete lastVisitTime[key];
        }
    });
}, 5 * 60 * 1000).unref();

function checkLockout(key) {
    var attempts = loginAttempts[key];
    if (!attempts) return false;
    var now = Date.now();
    if (attempts.count >= LOCKOUT_THRESHOLD && now - attempts.lastAttempt < LOCKOUT_DURATION) {
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
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    if (isVercel) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
}

// ==================== NONCE GENERATOR ====================
function generateNonce() {
    return crypto.randomBytes(16).toString('base64');
}

// ==================== INPUT SANITIZATION ====================
function sanitize(str) {
    if (typeof str !== 'string') return str;
    if (str.startsWith('data:')) return str;
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
    if (url.indexOf('/api/banner') !== -1 || url.indexOf('/api/login') !== -1 || url.indexOf('/api/admin/login') !== -1 || url.indexOf('/api/register') !== -1 || url.indexOf('/api/order-attachment') !== -1 || url.indexOf('/api/change-password') !== -1) return next();
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
    const jti = crypto.randomBytes(8).toString('hex');
    const exp = Date.now() + (payload.isAdmin ? 8 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
    const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp, jti })).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
    return header + '.' + body + '.' + sig;
}

// ==================== TOKEN REVOCATION ====================
const revokedTokens = new Map(); // jti -> exp timestamp
function revokeToken(jti, exp) { revokedTokens.set(jti, exp || Date.now() + 86400000); }
function isTokenRevoked(jti) { return revokedTokens.has(jti); }
// Cleanup expired revoked tokens every 10 minutes
setInterval(function() {
    var now = Date.now();
    revokedTokens.forEach(function(exp, jti) {
        if (now > exp) revokedTokens.delete(jti);
    });
}, 10 * 60 * 1000).unref();

function verifyJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const sig = crypto.createHmac('sha256', JWT_SECRET).update(parts[0] + '.' + parts[1]).digest('base64url');
        const sigBuf = Buffer.from(sig, 'base64url');
        const partsBuf = Buffer.from(parts[2], 'base64url');
        if (sigBuf.length !== partsBuf.length || !crypto.timingSafeEqual(sigBuf, partsBuf)) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.exp && Date.now() > payload.exp) return null;
        if (payload.jti && isTokenRevoked(payload.jti)) return null;
        return payload;
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
    const payload = verifyJWT(token);
    if (!payload || !payload.isAdmin) return res.status(401).json({ error: 'دسترسی غیرمجاز' });
    req.user = payload;
    next();
}

function requireUser(req, res, next) {
    var token = getToken(req);
    const payload = verifyJWT(token);
    if (!payload) return res.status(401).json({ error: 'احراز هویت نشده' });
    req.user = payload;
    next();
}

const app = express();
const rootDir = path.resolve(__dirname);

app.set('trust proxy', 1);

// Security headers via Helmet (CSP handled separately for nonce support)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Response compression (gzip + deflate) — Vercel CDN adds Brotli automatically
if (!isVercel) {
    // Self-hosted: unified Brotli + gzip middleware
    app.use(function unifiedCompress(req, res, next) {
        if (req.headers['x-no-compression']) return next();
        var acceptEncoding = req.headers['accept-encoding'] || '';
        var useBrotli = acceptEncoding.indexOf('br') !== -1;
        var useGzip = acceptEncoding.indexOf('gzip') !== -1;

        var origWrite = res.write;
        var origEnd = res.end;
        var chunks = [];

        res.write = function(chunk, encoding, cb) {
            if (typeof encoding === 'function') { cb = encoding; encoding = null; }
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
            if (cb) cb();
            return true;
        };
        res.end = function(chunk, encoding, cb) {
            if (typeof chunk === 'function') { cb = chunk; chunk = null; }
            if (typeof encoding === 'function') { cb = encoding; encoding = null; }
            if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));

            var body = Buffer.concat(chunks);
            var contentType = (res.getHeader('content-type') || '').toLowerCase();
            var isCompressible = /text|json|javascript|css|html|xml|svg|font|woff|ttf/.test(contentType);

            if (!isCompressible || body.length < 1024) {
                res.setHeader('Content-Length', body.length);
                origWrite.call(res, body);
                if (cb) cb();
                return origEnd.call(res);
            }

            function sendCompressed(encoder, encodingName) {
                encoder(body, function(err, compressed) {
                    if (err || compressed.length >= body.length) {
                        // Fallback to uncompressed
                        res.setHeader('Content-Length', body.length);
                        origWrite.call(res, body);
                        if (cb) cb();
                        return origEnd.call(res);
                    }
                    res.setHeader('Content-Encoding', encodingName);
                    res.setHeader('Content-Length', compressed.length);
                    res.removeHeader('Content-MD5');
                    res.removeHeader('ETag');
                    origWrite.call(res, compressed);
                    if (cb) cb();
                    origEnd.call(res);
                });
            }

            if (useBrotli) {
                var brotliOpts = {};
                brotliOpts[zlib.constants.BROTLI_PARAM_QUALITY] = 4;
                brotliOpts[zlib.constants.BROTLI_PARAM_SIZE_HINT] = body.length;
                sendCompressed(function(buf, cb) {
                    zlib.brotliCompress(buf, { params: brotliOpts }, cb);
                }, 'br');
            } else if (useGzip) {
                sendCompressed(function(buf, cb) {
                    zlib.gzip(buf, { level: 6 }, cb);
                }, 'gzip');
            } else {
                res.setHeader('Content-Length', body.length);
                origWrite.call(res, body);
                if (cb) cb();
                origEnd.call(res);
            }
        };
        next();
    });
} else {
    // Vercel: CDN handles Brotli, just use basic gzip for origin
    app.use(compression({
        filter: (req, res) => {
            if (req.headers['x-no-compression']) return false;
            return compression.filter(req, res);
        },
        level: 6,
        threshold: 1024
    }));
}

// Security headers
app.use(securityHeaders);

// ==================== CSP WITH NONCE ====================
app.use(function(req, res, next) {
    if (req.path.endsWith('.html') || req.path === '/' || req.path === '/admin') {
        const nonce = generateNonce();
        res.locals.nonce = nonce;
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'nonce-" + nonce + "'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
            "img-src 'self' data: blob:",
            "connect-src 'self' ws: wss:",
            "worker-src 'self' blob:",
            "frame-src 'none'",
            "object-src 'none'"
        ].join('; ');
        res.setHeader('Content-Security-Policy', csp);
    }
    next();
});

// ==================== HTML SERVING WITH NONCE INJECTION ====================
const htmlRawCache = {}; // { filePath: { content: string, ts: number } }
const HTML_RAW_CACHE_TTL = 30000; // 30 seconds
app.use(function(req, res, next) {
    if (req.method !== 'GET') return next();
    if (!req.accepts('html')) return next();
    var p = req.path;
    if (!p.endsWith('.html') && p !== '/') return next();
    var filename = p === '/' ? 'index.html' : p.replace(/^\//, '');
    var filePath = path.join(rootDir, 'public', filename);
    var publicDir = path.join(rootDir, 'public');
    if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
        return next();
    }
    var cached = htmlRawCache[filePath];
    if (cached && Date.now() - cached.ts < HTML_RAW_CACHE_TTL) {
        var nonce = generateNonce();
        var html = cached.content.replace(/<script(?=[\s>])/gi, '<script nonce="' + nonce + '"');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    }
    fs.readFile(filePath, 'utf8', function(err, html) {
        if (err) return next();
        htmlRawCache[filePath] = { content: html, ts: Date.now() };
        var nonce = generateNonce();
        html = html.replace(/<script(?=[\s>])/gi, '<script nonce="' + nonce + '"');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    });
});

// Rate limit: 5 requests per minute for login/register
const authRateLimit = rateLimit(60 * 1000, 5);
// Rate limit: 10 requests per minute for write operations
const writeRateLimit = rateLimit(60 * 1000, 30);

// Async route wrapper — catches rejected promises and passes to Express error handler
function asyncHandler(fn) {
    return function(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(sanitizeMiddleware);

const oneYear = 1000 * 60 * 60 * 24 * 365;
const oneWeek = 1000 * 60 * 60 * 24 * 7;
const staticOptions = {
  maxAge: oneYear,
  etag: true,
  lastModified: true,
  immutable: true,
  setHeaders: (res, filePath) => {
    const pathString = filePath.toString();
    if (pathString.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (pathString.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=' + oneWeek);
    } else if (pathString.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=' + oneWeek);
    } else if (pathString.match(/\.(jpg|jpeg|png|gif|svg|ico|webp|avif)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=' + oneYear + ', immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=' + oneYear + ', immutable');
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

app.use(express.static(path.join(rootDir, 'public'), staticOptions));

// Block path traversal on uploads
app.use('/uploads', function(req, res, next) {
    try {
        var decoded = decodeURIComponent(req.path);
        if (decoded.indexOf('..') !== -1) {
            return res.status(403).json({ error: 'دسترسی غیرمجاز' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'آدرس نامعتبر' });
    }
    next();
});

const ATTACHMENTS_DIR = path.join(rootDir, 'public', 'uploads', 'attachments');
const BANNERS_DIR = path.join(rootDir, 'public', 'uploads', 'banners');

fs.promises.mkdir(ATTACHMENTS_DIR, { recursive: true }).catch(function(){});
fs.promises.mkdir(BANNERS_DIR, { recursive: true }).catch(function(){});

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
    } catch (e) {
        console.error('DB init migration error:', e.message || e);
    }

    // Fix corrupted data URLs in chat attachments (sanitize() was replacing / with &#x2F;)
    try {
        var client = db.getClient();
        var rows = await client.execute("SELECT id, attachments FROM chat WHERE attachments LIKE '%&#x2F;%'");
        for (var row of rows.rows) {
            var fixed = row.attachments.replace(/&#x2F;/g, '/');
            await client.execute({ sql: 'UPDATE chat SET attachments = ? WHERE id = ?', args: [fixed, row.id] });
        }
        if (rows.rows.length > 0) console.log('Fixed ' + rows.rows.length + ' corrupted chat attachment(s)');
    } catch (e) {
        console.error('Chat attachment fix error:', e.message || e);
    }

    try {
        // Ensure admin user exists from env vars
        var adminUsername = process.env.ADMIN_USERNAME;
        var adminPassword = process.env.ADMIN_PASSWORD;
        if (adminUsername && adminPassword) {
            var existingAdmin = await db.getUser(adminUsername);
            if (!existingAdmin) {
                await db.createUser(adminUsername, await hashPassword(adminPassword), true);
            } else {
                // Only update admin flag, never overwrite password on restart
                await db.setAdminUser(adminUsername, true);
            }
        }

        // Hash any remaining plaintext passwords
        var client = db.getClient();
        var allUsers = await client.execute('SELECT username, password FROM users');
        for (const u of allUsers.rows) {
            if (u.password && !isHashed(u.password)) {
                await db.updateUserPassword(u.username, await hashPassword(u.password));
            }
        }
    } catch (e) {
        console.error('Admin migration error:', e.message || e);
    }
}).catch(function(e) {
    console.error('dbReady error:', e.message || e);
});

// ==================== AUTH ROUTES ====================
app.post('/api/register', authRateLimit, asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    if (String(username).length < 3 || String(username).length > 30) return res.status(400).json({ error: 'نام کاربری باید بین ۳ تا ۳۰ کاراکتر باشد' });
    if (String(password).length < 8) return res.status(400).json({ error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' });
    if (String(password).length > 128) return res.status(400).json({ error: 'رمز عبور نباید بیش از ۱۲۸ کاراکتر باشد' });
    if (!/[A-Z]/.test(String(password)) || !/[a-z]/.test(String(password)) || !/[0-9]/.test(String(password))) {
        return res.status(400).json({ error: 'رمز عبور باید شامل حروف بزرگ، کوچک و اعداد باشد' });
    }
    if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(String(username))) return res.status(400).json({ error: 'نام کاربری فقط شامل حروف، اعداد و _ باشد' });
    const existing = await db.getUser(username);
    if (existing) {
        return res.status(400).json({ error: 'کاربر وجود دارد' });
    }
    await db.createUser(username, await hashPassword(password), false);
    const token = signJWT({ username, isAdmin: false });
    var cookieFlags = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400' + (isVercel ? '; Secure' : '');
    res.setHeader('Set-Cookie', 'token=' + encodeURIComponent(token) + '; ' + cookieFlags);
    res.json({ success: true, token });
}));

app.post('/api/login', authRateLimit, asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    const lockKey = 'user:' + username;
    if (checkLockout(lockKey)) return res.status(429).json({ error: 'حساب شما به دلیل تلاش‌های ناموفق زیاد قفل شده است. ۱۵ دقیقه صبر کنید.' });
    const user = await db.getUserWithPassword(username);
    if (!user || !(await verifyPassword(password, user.password))) {
        recordFailedAttempt(lockKey);
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
    clearAttempts(lockKey);
    if (!isHashed(user.password)) {
        await db.updateUserPassword(username, await hashPassword(password));
    }
    const token = signJWT({ username, isAdmin: false });
    var cookieFlags = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400' + (isVercel ? '; Secure' : '');
    res.setHeader('Set-Cookie', 'token=' + encodeURIComponent(token) + '; ' + cookieFlags);
    res.json({ success: true, token });
}));

app.post('/api/admin/login', authRateLimit, asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    const lockKey = 'admin:' + username;
    if (checkLockout(lockKey)) {
        return res.status(429).json({ error: 'حساب مدیر به دلیل تلاش‌های ناموفق زیاد قفل شده است. ۱۵ دقیقه صبر کنید.' });
    }
    const admin = await db.getUserWithPassword(username);
    if (!admin || !admin.isAdmin || !(await verifyPassword(password, admin.password))) {
        recordFailedAttempt(lockKey);
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
    clearAttempts(lockKey);
    if (!isHashed(admin.password)) {
        await db.updateUserPassword(username, await hashPassword(password));
    }
    var token = signJWT({ username: username, isAdmin: true });
    var cookieFlags = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400' + (isVercel ? '; Secure' : '');
    res.setHeader('Set-Cookie', 'token=' + encodeURIComponent(token) + '; ' + cookieFlags);
    res.json({ success: true, token: token });
}));

// ==================== LOGOUT ====================
app.post('/api/logout', asyncHandler(async (req, res) => {
    var token = getToken(req);
    if (token) {
        var payload = verifyJWT(token);
        if (payload && payload.jti) revokeToken(payload.jti, payload.exp);
    }
    res.setHeader('Set-Cookie', 'token=; Path=/; HttpOnly; Max-Age=0');
    res.json({ success: true });
}));

// ==================== ORDER ROUTES ====================
app.post('/api/order', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    if (!req.body.title || typeof req.body.title !== 'string' || !req.body.title.trim()) {
        return res.status(400).json({ error: 'عنوان خدمت الزامی است' });
    }
    const trackingCode = 'CFT-' + crypto.randomBytes(4).toString('hex');
    const allowedFields = ['serviceType', 'title', 'description', 'phone', 'nationalId',
        'postalCode', 'address', 'plateNumber', 'violationNumber', 'appealReason',
        'applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay',
        'marriageYear', 'marriageMonth', 'marriageDay', 'idNumber', 'additionalNotes',
        'regionCode', 'educationLevel', 'familyCount', 'iban', 'contractNumber',
        'depositAmount', 'passportNumber', 'examType', 'city', 'operator', 'internetType',
        'ownershipStatus'];
    const order = { trackingCode, created_at: new Date(), username: req.user.username };
    for (const field of allowedFields) {
        if (req.body[field] !== undefined && typeof req.body[field] === 'string') {
            order[field] = String(req.body[field]).slice(0, 500);
        }
    }
    await db.createOrder(order);
    res.json({ success: true, trackingCode });
}));

function isValidTrackingCode(code) {
    return typeof code === 'string' && /^CFT-[a-f0-9]{8}$/.test(code);
}

app.get('/api/order/:trackingCode', requireUser, asyncHandler(async (req, res) => {
    const { trackingCode } = req.params;
    if (!isValidTrackingCode(trackingCode)) {
        return res.status(400).json({ error: 'کد سفارش نامعتبر است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    if (!req.user.isAdmin && order.username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    res.json(order);
}));

app.post('/api/order-attachment', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode, attachment } = req.body;
    if (!isValidTrackingCode(trackingCode)) {
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
    if (order.username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    const fileName = sanitizeAttachmentName(attachment.name);
    const orderDir = path.join(ATTACHMENTS_DIR, trackingCode);

    const savedAttachment = {
        id: attachment.id || ('att_' + Date.now() + '_' + Math.random().toString(16).slice(2)),
        name: fileName,
        type: decoded.type,
        size: decoded.buffer.length,
        url: '/uploads/attachments/' + encodeURIComponent(trackingCode) + '/' + encodeURIComponent(fileName),
        uploadedAt: attachment.uploadedAt || new Date().toISOString()
    };

    await withOrderLock(trackingCode, async () => {
        await fs.promises.mkdir(orderDir, { recursive: true });
        const filePath = path.join(orderDir, fileName);
        await fs.promises.writeFile(filePath, decoded.buffer);
        const latestOrder = await db.getOrder(trackingCode);
        const latestAttachments = (latestOrder && latestOrder.attachments) || [];
        const idx = latestAttachments.findIndex(a => a.id === savedAttachment.id);
        if (idx >= 0) {
            latestAttachments[idx] = savedAttachment;
        } else {
            latestAttachments.push(savedAttachment);
        }
        await db.updateOrder(trackingCode, { attachments: latestAttachments });
    });

    res.json({ success: true, attachment: savedAttachment });
}));

app.post('/api/order/confirm', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode } = req.body;
    if (!isValidTrackingCode(trackingCode)) return res.status(400).json({ error: 'کد سفارش نامعتبر است' });
    var result;
    await withOrderLock(trackingCode, async () => {
        const order = await db.getOrder(trackingCode);
        if (!order) {
            result = res.status(404).json({ error: 'سفارش پیدا نشد' });
            return;
        }
        if (!req.user.isAdmin && order.username !== req.user.username) {
            result = res.status(403).json({ error: 'دسترسی غیرمجاز' });
            return;
        }
        if (order.status !== 'new') {
            result = res.status(400).json({ error: 'فقط سفارش‌های جدید قابل تایید هستند' });
            return;
        }
        await db.updateOrder(trackingCode, { status: 'pending', confirmed_at: new Date().toISOString() });
    });
    if (result) return;
    res.json({ success: true });
}));

// ==================== ORDER STATUS STATE MACHINE ====================
const VALID_STATUS_TRANSITIONS = {
    'new': ['pending'],
    'pending': ['processing'],
    'processing': ['completed'],
    'completed': []
};

function isValidStatusTransition(currentStatus, newStatus) {
    var allowed = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowed) return false;
    return allowed.indexOf(newStatus) !== -1;
}

app.post('/api/order/status', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode, status } = req.body;
    if (!isValidTrackingCode(trackingCode)) return res.status(400).json({ error: 'کد سفارش نامعتبر است' });
    if (!['pending', 'processing', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر' });
    }
    var result;
    await withOrderLock(trackingCode, async () => {
        const order = await db.getOrder(trackingCode);
        if (!order) {
            result = res.status(404).json({ error: 'سفارش پیدا نشد' });
            return;
        }
        if (!isValidStatusTransition(order.status, status)) {
            result = res.status(400).json({ error: 'تغییر وضعیت مجاز نیست' });
            return;
        }
        await db.updateOrder(trackingCode, { status, updated_at: new Date().toISOString() });
    });
    if (result) return;
    res.json({ success: true });
}));

app.post('/api/order/result', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode, result } = req.body;
    if (!isValidTrackingCode(trackingCode)) return res.status(400).json({ error: 'کد سفارش نامعتبر است' });
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    var updates = { result_at: new Date().toISOString() };
    if (result && String(result).trim()) {
        updates.result = String(result).trim().slice(0, 2000);
    } else {
        updates.result = null;
    }
    await withOrderLock(trackingCode, async () => {
        await db.updateOrder(trackingCode, updates);
    });
    res.json({ success: true });
}));

app.post('/api/order/price-proposal', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode, proposedPrice } = req.body;
    if (!isValidTrackingCode(trackingCode) || !proposedPrice) {
        return res.status(400).json({ error: 'کد سفارش و قیمت الزامی است' });
    }
    const price = String(proposedPrice).trim();
    if (!price || isNaN(parseInt(price)) || parseInt(price) <= 0 || parseInt(price) > 999999999) {
        return res.status(400).json({ error: 'قیمت نامعتبر است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    if (order.username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    await withOrderLock(trackingCode, async () => {
        await db.updateOrder(trackingCode, { proposedPrice: price, priceStatus: 'usercounter', updated_at: new Date().toISOString() });
    });
    res.json({ success: true });
}));

app.post('/api/order/price-counter', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode, adminProposedPrice } = req.body;
    if (!isValidTrackingCode(trackingCode) || !adminProposedPrice) {
        return res.status(400).json({ error: 'کد سفارش و قیمت الزامی است' });
    }
    const price = String(adminProposedPrice).trim();
    if (!price || isNaN(parseInt(price)) || parseInt(price) <= 0 || parseInt(price) > 999999999) {
        return res.status(400).json({ error: 'قیمت نامعتبر است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    await withOrderLock(trackingCode, async () => {
        await db.updateOrder(trackingCode, { adminProposedPrice: price, priceStatus: 'countersent', updated_at: new Date().toISOString() });
    });
    res.json({ success: true });
}));

app.post('/api/order/price-accept', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode } = req.body;
    if (!isValidTrackingCode(trackingCode)) {
        return res.status(400).json({ error: 'کد سفارش نامعتبر است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    await withOrderLock(trackingCode, async () => {
        await db.updateOrder(trackingCode, {
            priceStatus: 'accepted',
            cost: 'قیمت توافقی - ' + (order.adminProposedPrice || order.proposedPrice || 'نامشخص'),
            updated_at: new Date().toISOString()
        });
    });
    res.json({ success: true });
}));

app.post('/api/order/pay', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { trackingCode } = req.body;
    if (!isValidTrackingCode(trackingCode)) {
        return res.status(400).json({ error: 'کد سفارش نامعتبر است' });
    }
    const order = await db.getOrder(trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    if (!req.user.isAdmin && order.username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    if (order.priceStatus !== 'accepted') {
        return res.status(400).json({ error: 'قیمت هنوز تایید نشده است' });
    }
    await withOrderLock(trackingCode, async () => {
        await db.updateOrder(trackingCode, { paid: true, paymentStatus: 'paid', updated_at: new Date().toISOString() });
    });
    res.json({ success: true });
}));

app.post('/api/change-password', requireUser, authRateLimit, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'رمز فعلی و رمز جدید الزامی است' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'رمز جدید باید حداقل ۸ کاراکتر باشد' });
    if (String(newPassword).length > 128) return res.status(400).json({ error: 'رمز جدید نباید بیش از ۱۲۸ کاراکتر باشد' });
    if (!/[A-Z]/.test(String(newPassword)) || !/[a-z]/.test(String(newPassword)) || !/[0-9]/.test(String(newPassword))) {
        return res.status(400).json({ error: 'رمز جدید باید شامل حروف بزرگ، کوچک و اعداد باشد' });
    }
    const targetUsername = req.user.username;
    const user = await db.getUserWithPassword(targetUsername);
    if (!user) return res.status(404).json({ error: 'کاربر پیدا نشد' });
    if (!(await verifyPassword(currentPassword, user.password))) {
        return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
    }
    await db.updateUserPassword(targetUsername, await hashPassword(newPassword));
    res.json({ success: true });
}));

// ==================== VISIT TRACKING (CLEANUP) ====================

app.post('/api/track-visit', rateLimit(30 * 60 * 1000, 20), asyncHandler(async (req, res) => {
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
}));

app.get('/api/visits', requireAdmin, asyncHandler(async (req, res) => {
    const visits = await db.getAllVisits();
    res.json(visits);
}));

// ==================== ORDERS LIST ====================
app.get('/api/orders', requireAdmin, asyncHandler(async (req, res) => {
    const { status, limit, offset } = req.query;
    if (status && !['new', 'pending', 'processing', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'فیلتر وضعیت نامعتبر است' });
    }
    var pageSize = Math.min(parseInt(limit) || 100, 500);
    var pageOffset = parseInt(offset) || 0;
    const orders = await db.getAllOrders(status, pageSize, pageOffset);
    res.json(orders);
}));

app.get('/api/orders/user', requireUser, asyncHandler(async (req, res) => {
    const { username, status, limit, offset } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    if (!req.user.isAdmin && req.user.username !== username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    var pageSize = Math.min(parseInt(limit) || 100, 500);
    var pageOffset = parseInt(offset) || 0;
    const userOrders = await db.getUserOrders(username, status, pageSize, pageOffset);
    res.json(userOrders);
}));

app.get('/api/admin/customers', requireAdmin, asyncHandler(async (req, res) => {
    // Use SQL aggregation instead of loading all orders into memory
    const customerStatsRows = await db.getCustomerStats();
    const latestMessages = await db.getLatestCustomerMessages();
    const latestMsgMap = {};
    latestMessages.forEach(function(m) { latestMsgMap[m.username] = m; });

    var customersList = customerStatsRows.map(function(row) {
        var username = row.username;
        var totalOrders = row.totalOrders;
        var latest = latestMsgMap[username];
        return {
            username: username,
            totalOrders: totalOrders,
            totalSpent: 0,
            orders: []
        };
    });

    // Get individual order details only when needed (lazy load per customer)
    res.json({ customers: customersList, totalCustomers: customersList.length });
}));

// ==================== UNREAD COUNT (lightweight) ====================
app.get('/api/admin/unread-count', requireAdmin, asyncHandler(async (req, res) => {
    var cached = getCache('unread-count', 5000);
    if (cached) return res.json(cached);
    // Count pending orders
    var pendingR = await db.getClient().execute("SELECT COUNT(*) as cnt FROM orders WHERE status = 'pending'");
    var pendingOrders = pendingR.rows[0].cnt;
    // Count customers with unread messages
    var latestMsgs = await db.getLatestCustomerMessages();
    var lastAdminGlobal = await db.getChatMeta('lastReadAt');
    var unreadCount = 0;
    latestMsgs.forEach(function(m) {
        if (!lastAdminGlobal || m.timestamp > lastAdminGlobal) unreadCount++;
    });
    var result = { pendingOrders: pendingOrders, unreadChat: unreadCount };
    setCache('unread-count', result);
    res.json(result);
}));

// ==================== PRICING ====================
app.get('/api/pricing', asyncHandler(async (req, res) => {
    var cached = getCache('pricing', 60000);
    if (cached) {
        res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
        res.set('CDN-Cache-Control', 'max-age=300');
        return res.json(cached);
    }
    const pricing = await db.getPricing();
    setCache('pricing', pricing);
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
    res.set('CDN-Cache-Control', 'max-age=300');
    res.json(pricing);
}));

app.post('/api/pricing', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const { service, price } = req.body;
    if (!service) {
        return res.status(400).json({ error: 'سرویس الزامی است' });
    }
    await db.upsertPricing(service, price);
    clearCache('pricing');
    res.json({ success: true });
}));

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
    if (trimmed.startsWith('data:image/')) {
        var parts = trimmed.split(',');
        if (parts.length < 2) return '';
        var buf = Buffer.from(parts[1], 'base64');
        if (buf.length > 2 * 1024 * 1024) return '';
        return trimmed;
    }
    if (trimmed.startsWith('/uploads/')) return trimmed;
    return '';
}

// ==================== IN-MEMORY CACHE ====================
const memoryCache = {};
function getCache(key, ttlMs) {
    var entry = memoryCache[key];
    if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
    return null;
}
function setCache(key, data) {
    memoryCache[key] = { data: data, ts: Date.now() };
}
function clearCache(pattern) {
    Object.keys(memoryCache).forEach(function(k) {
        if (k.indexOf(pattern) === 0) delete memoryCache[k];
    });
}

// ==================== BANNER UPLOAD ====================
app.post('/api/banner/upload', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
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
}));

// ==================== BANNER ROUTES ====================
app.post('/api/banner', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
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
    clearCache('banner');
    res.json({ success: true });
}));

app.get('/api/banner', asyncHandler(async (req, res) => {
    const { group } = req.query;
    var cacheKey = group ? 'banner:g' + group : 'banner:all';
    var cached = getCache(cacheKey, 30000);
    if (cached) {
        res.set('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=30');
        res.set('CDN-Cache-Control', 'max-age=300');
        return res.json(cached);
    }

    if (group) {
        const groupNum = parseInt(group);
        if (!Number.isNaN(groupNum)) {
            const banners = await db.getBanners(groupNum);
            setCache(cacheKey, banners);
            res.set('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=30');
            res.set('CDN-Cache-Control', 'max-age=300');
            return res.json(banners);
        }
    }
    const allBanners = await db.getBanners();
    setCache(cacheKey, allBanners);
    res.set('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=30');
    res.set('CDN-Cache-Control', 'max-age=300');
    res.json(allBanners);
}));

app.delete('/api/banner/:id', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const banner = await db.getBannerById(id);
    if (banner && banner.src && banner.src.startsWith('/uploads/banners/')) {
        try {
            const filename = decodeURIComponent(banner.src.replace('/uploads/banners/', ''));
            const filepath = path.resolve(BANNERS_DIR, filename);
            if (filepath.startsWith(path.resolve(BANNERS_DIR))) {
                await fs.promises.access(filepath).then(function() {
                    return fs.promises.unlink(filepath);
                }).catch(function() {});
            }
        } catch (e) {}
    }
    await db.deleteBanner(id);
    clearCache('banner');
    res.json({ success: true });
}));

// Mega menu API
app.get('/api/mega-menu', asyncHandler(async (req, res) => {
  const menuPath = path.join(rootDir, 'public', 'mega-menu.html');
  try {
    const html = await fs.promises.readFile(menuPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    res.status(500).json({ error: 'مگا منو یافت نشد' });
  }
}));

app.put('/api/banner/:id', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
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
            if (oldPath.startsWith(path.resolve(BANNERS_DIR))) {
                await fs.promises.access(oldPath).then(function() {
                    return fs.promises.unlink(oldPath);
                }).catch(function() {});
            }
        } catch (e) {}
    }
    await db.updateBanner(id, safeSrc, safeLink, parseInt(duration) || 5, newGroup);
    clearCache('banner');
    res.json({ success: true });
}));

// ==================== CHAT ROUTES ====================
app.get('/api/chat', requireUser, asyncHandler(async (req, res) => {
    const { username } = req.query;
    if (!username || username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const messages = await db.getChatMessages(username, 500);
    res.json(messages);
}));

app.post('/api/chat', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { text, conversationId, attachments } = req.body;
    var msgText = (text || '').trim();
    var hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!msgText && !hasAttachments) {
        return res.status(400).json({ error: 'متن پیام یا فایل پیوست الزامی است' });
    }
    if (msgText.length > 5000) {
        return res.status(400).json({ error: 'متن پیام نباید بیش از ۵۰۰۰ کاراکتر باشد' });
    }
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'customer',
        username: req.user.username,
        text: msgText,
        timestamp: new Date().toISOString(),
        conversationId: conversationId || null,
        attachments: hasAttachments ? attachments.slice(0, 4) : []
    };
    await db.addChatMessage(message);
    res.json(message);
}));

app.get('/api/admin/chat', requireAdmin, asyncHandler(async (req, res) => {
    const { messages, lastReadAt } = await db.getAdminChatData();
    // Limit to last 200 messages for performance
    const limitedMessages = messages.length > 200 ? messages.slice(-200) : messages;
    res.json({ messages: limitedMessages, lastReadAt });
}));

app.post('/api/admin/chat/read', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const { lastReadAt } = req.body;
    if (lastReadAt) {
        await db.setChatMeta('lastReadAt', lastReadAt);
    }
    res.json({ success: true });
}));

app.post('/api/admin/chat', requireAdmin, writeRateLimit, asyncHandler(async (req, res) => {
    const { text, username, conversationId, attachments } = req.body;
    var msgText = (text || '').trim();
    var hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!msgText && !hasAttachments) {
        return res.status(400).json({ error: 'متن پیام یا فایل پیوست الزامی است' });
    }
    if (msgText.length > 5000) {
        return res.status(400).json({ error: 'متن پیام نباید بیش از ۵۰۰۰ کاراکتر باشد' });
    }
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'admin',
        username: username || null,
        text: msgText,
        timestamp: new Date().toISOString(),
        conversationId: conversationId || null,
        attachments: hasAttachments ? attachments.slice(0, 4) : []
    };
    await db.addChatMessage(message);
    res.json(message);
}));

app.get('/api/admin/chat/conversation', requireAdmin, asyncHandler(async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    var allMessages = await db.getChatMessages(username, 500);
    res.json(allMessages);
}));

app.get('/api/admin/chat/conversations', requireAdmin, asyncHandler(async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    var convs = await db.getUserConversations(username);
    var result = [];
    var promises = convs.map(function(c) {
        return db.getLastMessageAndCount(c.id).then(function(info) {
            if (!info.lastMsg) return null;
            return {
                id: c.id,
                username: c.username,
                createdAt: c.createdAt,
                lastMessage: info.lastMsg.text,
                lastTimestamp: info.lastMsg.timestamp,
                messageCount: info.count
            };
        });
    });
    var items = await Promise.all(promises);
    result = items.filter(Boolean);
    result.sort(function(a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    res.json(result);
}));

app.get('/api/admin/chat/conversation/:id', requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const before = req.query.before || null;
    if (id === '_legacy') {
        const allMsgs = await db.getAllChatMessages(500);
        const legacy = allMsgs.filter(function(m) { return !m.conversationId || m.conversationId === '_legacy'; });
        res.json(legacy);
    } else {
        const messages = await db.getChatMessagesPaginated(id, limit, before);
        const fetchLimit = limit + 1;
        const hasMore = messages.length >= limit;
        const oldestId = messages.length > 0 ? messages[0].id : null;
        res.json({ messages: messages.slice(0, limit), hasMore, oldestId });
    }
}));

app.get('/api/admin/chat/customers', requireAdmin, asyncHandler(async (req, res) => {
    // Optimized: get latest customer message per user via SQL
    var latestCustomerMsgs = await db.getLatestCustomerMessages();
    var customers = {};
    latestCustomerMsgs.forEach(function(m) {
        customers[m.username] = { username: m.username, lastMessage: m.text, lastTimestamp: m.timestamp, unread: 0 };
    });
    // Check for unread: get last admin message per user and last global admin read time in parallel
    var [lastAdminMsgs, lastAdminGlobal] = await Promise.all([
        db.getLastAdminMessagesPerUser(),
        db.getChatMeta('lastReadAt')
    ]);
    var lastAdminByUser = {};
    lastAdminMsgs.forEach(function(m) {
        lastAdminByUser[m.username] = m.timestamp;
    });
    Object.keys(customers).forEach(function(key) {
        var customer = customers[key];
        var lastAdminTs = lastAdminByUser[customer.username] || lastAdminGlobal;
        if (!lastAdminTs || customer.lastTimestamp > lastAdminTs) {
            customer.unread = 1;
        }
    });
    var list = Object.keys(customers).map(function(k) { return customers[k]; });
    list.sort(function(a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    res.json(list);
}));

app.post('/api/chat/conversation', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { username } = req.body;
    if (!username || username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const conv = await db.createConversation(username);
    res.json(conv);
}));

app.get('/api/chat/conversation/:id', requireUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { username } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const before = req.query.before || null;
    if (!username || username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    const messages = await db.getChatMessagesPaginated(id, limit, before);
    const filtered = messages.filter(function(m) {
        return (m.role === 'customer' && m.username === username) || (m.role === 'admin');
    });
    const total = filtered.length;
    const hasMore = filtered.length > 0 && filtered[0].id !== messages[0]?.id;
    res.json({ messages: filtered, total, hasMore, oldestId: filtered.length > 0 ? filtered[0].id : null });
}));

app.get('/api/chat/conversations', requireUser, asyncHandler(async (req, res) => {
    const { username } = req.query;
    if (!username || username !== req.user.username) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    var convs = await db.getUserConversations(username);
    var result = [];
    var promises = convs.map(function(c) {
        return db.getLastMessageAndCount(c.id).then(function(info) {
            if (!info.lastMsg) return null;
            return {
                id: c.id,
                username: c.username,
                createdAt: c.createdAt,
                lastMessage: info.lastMsg.text,
                lastTimestamp: info.lastMsg.timestamp,
                messageCount: info.count
            };
        });
    });
    var items = await Promise.all(promises);
    result = items.filter(Boolean);
    result.sort(function(a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    res.json(result);
}));

// ==================== IMAGE OPTIMIZATION (sharp) ====================
app.post('/api/optimize-image', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { image, format, width, quality } = req.body;
    if (!image || !image.dataUrl) {
        return res.status(400).json({ error: 'تصویر الزامی است' });
    }
    try {
        const sharp = require('sharp');
        const decoded = decodeDataUrl(image.dataUrl);
        if (!decoded) {
            return res.status(400).json({ error: 'فرمت تصویر نامعتبر است' });
        }
        let pipeline = sharp(decoded.buffer);
        const targetFormat = ['webp', 'avif', 'jpeg', 'png'].includes(format) ? format : 'webp';
        const targetQuality = Math.min(Math.max(parseInt(quality) || 80, 10), 100);
        if (width && parseInt(width) > 0) {
            pipeline = pipeline.resize(parseInt(width), null, { withoutEnlargement: true });
        }
        pipeline = pipeline.toFormat(targetFormat, { quality: targetQuality });
        const optimized = await pipeline.toBuffer();
        const mimeType = { webp: 'image/webp', avif: 'image/avif', jpeg: 'image/jpeg', png: 'image/png' }[targetFormat];
        const dataUrl = 'data:' + mimeType + ';base64,' + optimized.toString('base64');
        res.json({ success: true, dataUrl, format: targetFormat, size: optimized.length });
    } catch (e) {
        console.error('Image optimization error:', e.message);
        res.status(500).json({ error: 'خطا در پردازش تصویر' });
    }
}));

// ==================== WEBAUTHN ====================
const RP_NAME = 'کافینت';
const RP_ID = isVercel ? 'retrocafebakery.ir' : 'localhost';
const ORIGIN = isVercel ? 'https://www.retrocafebakery.ir' : 'http://localhost:' + (process.env.PORT || 3003);

const WEBAUTHN_CHALLENGES = new Map();
const CHALLENGE_TTL = 5 * 60 * 1000;

function generateChallenge() {
    return crypto.randomBytes(32).toString('base64url');
}

function storeChallenge(username, challenge, type) {
    WEBAUTHN_CHALLENGES.set(username, { challenge, type, ts: Date.now() });
    setTimeout(function() { WEBAUTHN_CHALLENGES.delete(username); }, CHALLENGE_TTL);
}

function getAndRemoveChallenge(username) {
    var entry = WEBAUTHN_CHALLENGES.get(username);
    WEBAUTHN_CHALLENGES.delete(username);
    if (!entry || Date.now() - entry.ts > CHALLENGE_TTL) return null;
    return entry;
}

function bufferToBase64url(buffer) {
    return Buffer.from(buffer).toString('base64url');
}

function base64urlToBuffer(base64url) {
    return Buffer.from(base64url, 'base64url');
}

function parseCOSEPublicKey(coseBuffer) {
    var data = coseBuffer;
    if (typeof data === 'string') data = base64urlToBuffer(data);
    var offset = 0;
    function readUint() {
        var b = data[offset]; offset++;
        if (b <= 0x17) return b;
        if (b === 0x18) { var v = data.readUInt8(offset); offset += 1; return v; }
        if (b === 0x19) { var v = data.readUInt16BE(offset); offset += 2; return v; }
        if (b === 0x1a) { var v = data.readUInt32BE(offset); offset += 4; return v; }
        return 0;
    }
    function readBytes() {
        var len = readUint();
        var buf = data.slice(offset, offset + len);
        offset += len;
        return buf;
    }
    function readInt() {
        var b = data[offset]; offset++;
        if (b <= 0x17) return b;
        if (b === 0x18) { var v = data.readUInt8(offset); offset += 1; return v; }
        if (b === 0x19) { var v = data.readUInt16BE(offset); offset += 2; return v; }
        if (b === 0x1a) { var v = data.readUInt32BE(offset); offset += 4; return v; }
        return 0;
    }
    try {
        var mapLen = readUint();
        var result = {};
        for (var i = 0; i < mapLen; i++) {
            var key = readInt();
            var valType = data[offset]; offset++;
            if (valType <= 0x17 || valType === 0x18 || valType === 0x19 || valType === 0x1a) {
                result[key] = readInt();
            } else if (valType >= 0x40 && valType <= 0x5f) {
                result[key] = readBytes();
            } else if (valType === 0x60 || valType === 0x61) {
                result[key] = readBytes();
            } else {
                offset++;
                result[key] = 0;
            }
        }
        return result;
    } catch(e) {
        return null;
    }
}

function createCOSEPublicKeyEC2(x, y) {
    var parts = [];
    parts.push(Buffer.from([0xa3]));
    parts.push(Buffer.from([0x01, 0x02]));
    parts.push(Buffer.from([0x03, 0x26]));
    parts.push(Buffer.from([0x20, 0x01]));
    parts.push(Buffer.from([0x21, 0x58, 0x20]));
    parts.push(x);
    parts.push(Buffer.from([0x22, 0x58, 0x20]));
    parts.push(y);
    return Buffer.concat(parts);
}

function webAuthnGenerateChallenge() {
    return crypto.randomBytes(32).toString('base64url');
}

function webAuthnVerifyAttestation(authenticatorDataB64, clientDataJSONB64, expectedChallenge, expectedOrigin, expectedRPID) {
    var authenticatorData = base64urlToBuffer(authenticatorDataB64);
    var clientDataJSON = base64urlToBuffer(clientDataJSONB64);
    var clientData;
    try { clientData = JSON.parse(clientDataJSON.toString()); } catch(e) { return { verified: false, error: 'clientData نامعتبر' }; }

    if (clientData.type !== 'webauthn.create') return { verified: false, error: 'type نامعتبر' };
    if (clientData.challenge !== expectedChallenge) return { verified: false, error: 'challenge نامعتبر' };

    var originUrl;
    try { originUrl = new URL(clientData.origin); } catch(e) { return { verified: false, error: 'origin نامعتبر' }; }
    var expectedOriginUrl;
    try { expectedOriginUrl = new URL(expectedOrigin); } catch(e) { return { verified: false, error: 'origin سرور نامعتبر' }; }
    if (originUrl.origin !== expectedOriginUrl.origin) return { verified: false, error: 'origin مطابقت ندارد' };

    if (authenticatorData.length < 37) return { verified: false, error: 'authenticatorData نامعتبر' };
    var rpIdHash = authenticatorData.slice(0, 32);
    var expectedRPIDHash = crypto.createHash('sha256').update(expectedRPID).digest();
    if (!rpIdHash.equals(expectedRPIDHash)) return { verified: false, error: 'rpID مطابقت ندارد' };

    var flags = authenticatorData[32];
    var hasAttestedCredentialData = (flags & 0x40) !== 0;
    if (!hasAttestedCredentialData) return { verified: false, error: 'attestedCredentialData موجود نیست' };

    var attestedCredentialData = authenticatorData.slice(37);
    if (attestedCredentialData.length < 18) return { verified: false, error: 'attestedCredentialData نامعتبر' };

    var credentialIdLength = attestedCredentialData.readUInt16BE(16);
    var credentialID = attestedCredentialData.slice(18, 18 + credentialIdLength);
    var cosePublicKeyBytes = attestedCredentialData.slice(18 + credentialIdLength);

    return {
        verified: true,
        credentialID: credentialID,
        credentialPublicKey: cosePublicKeyBytes,
        counter: authenticatorData.readUInt32BE(33)
    };
}

function webAuthnVerifyAssertion(authenticatorDataB64, clientDataJSONB64, signatureB64, expectedChallenge, expectedOrigin, expectedRPID, publicKeyBuffer, prevCounter) {
    var authenticatorData = base64urlToBuffer(authenticatorDataB64);
    var clientDataJSON = base64urlToBuffer(clientDataJSONB64);
    var signature = base64urlToBuffer(signatureB64);
    var clientData;
    try { clientData = JSON.parse(clientDataJSON.toString()); } catch(e) { return { verified: false, error: 'clientData نامعتبر' }; }

    if (clientData.type !== 'webauthn.get') return { verified: false, error: 'type نامعتبر' };
    if (clientData.challenge !== expectedChallenge) return { verified: false, error: 'challenge نامعتبر' };

    var originUrl;
    try { originUrl = new URL(clientData.origin); } catch(e) { return { verified: false, error: 'origin نامعتبر' }; }
    var expectedOriginUrl;
    try { expectedOriginUrl = new URL(expectedOrigin); } catch(e) { return { verified: false, error: 'origin سرور نامعتبر' }; }
    if (originUrl.origin !== expectedOriginUrl.origin) return { verified: false, error: 'origin مطابقت ندارد' };

    if (authenticatorData.length < 37) return { verified: false, error: 'authenticatorData نامعتبر' };
    var rpIdHash = authenticatorData.slice(0, 32);
    var expectedRPIDHash = crypto.createHash('sha256').update(expectedRPID).digest();
    if (!rpIdHash.equals(expectedRPIDHash)) return { verified: false, error: 'rpID مطابقت ندارد' };

    var flags = authenticatorData[32];
    var userPresent = (flags & 0x01) !== 0;
    if (!userPresent) return { verified: false, error: 'User Present تایید نشد' };

    var newCounter = authenticatorData.readUInt32BE(33);
    if (prevCounter > 0 && newCounter <= prevCounter) return { verified: false, error: 'Counter نامعتبر' };

    var signedData = Buffer.concat([authenticatorData, crypto.createHash('sha256').update(clientDataJSON).digest()]);

    var coseKey = parseCOSEPublicKey(publicKeyBuffer);
    if (!coseKey) return { verified: false, error: 'کلید عمومی نامعتبر' };

    var x = coseKey[-2];
    var y = coseKey[-3];
    if (!x || !y) return { verified: false, error: 'کلید EC نامعتبر' };

    var rawKey = Buffer.concat([
        Buffer.from([0x04]),
        x instanceof Buffer ? x : Buffer.from([x]),
        y instanceof Buffer ? y : Buffer.from([y])
    ]);
    var keyObject = crypto.createPublicKey({ key: rawKey, format: 'der', type: 'spki' });
    var valid = crypto.verify(null, signedData, keyObject, signature);

    return { verified: valid, newCounter: newCounter };
}

app.post('/api/webauthn/register-options', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const username = req.user.username;
    const existingCredentials = await db.getWebAuthnCredentialsByUsername(username);
    const excludeCredentials = existingCredentials.map(function(c) {
        return { id: c.credentialId, type: 'public-key', transports: c.transports };
    });

    const challenge = webAuthnGenerateChallenge();
    storeChallenge(username, challenge, 'register');

    res.json({
        challenge,
        rp: { name: RP_NAME, id: RP_ID },
        user: {
            id: Buffer.from(username).toString('base64url'),
            name: username,
            displayName: username,
        },
        pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
        ],
        timeout: 60000,
        attestation: 'none',
        excludeCredentials,
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
    });
}));

app.post('/api/webauthn/register', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    const { credential, deviceName } = req.body;
    const username = req.user.username;

    const expectedChallenge = getAndRemoveChallenge(username);
    if (!expectedChallenge || expectedChallenge.type !== 'register') {
        return res.status(400).json({ error: 'چالش نامعتبر یا منقضی شده است' });
    }

    try {
        var result = webAuthnVerifyAttestation(
            credential.response.authenticatorData,
            credential.response.clientDataJSON,
            expectedChallenge.challenge,
            ORIGIN,
            RP_ID
        );
    } catch(e) {
        return res.status(400).json({ error: 'تایید ثبت‌نام ناموفق' });
    }

    if (!result.verified) {
        return res.status(400).json({ error: result.error || 'تایید ثبت‌نام ناموفق' });
    }

    var cred_id = bufferToBase64url(result.credentialID);
    var pub_key = bufferToBase64url(result.credentialPublicKey);
    var id = 'wc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    await db.createWebAuthnCredential({
        id,
        username,
        credentialId: cred_id,
        publicKey: pub_key,
        counter: result.counter || 0,
        deviceName: deviceName || 'دستگاه ناشناس',
        transports: credential.response?.transports || [],
        createdAt: new Date().toISOString(),
    });

    res.json({ success: true, credential: { id, deviceName: deviceName || 'دستگاه ناشناس', createdAt: new Date().toISOString() } });
}));

app.post('/api/webauthn/auth-options', asyncHandler(async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'نام کاربری الزامی است' });

    const credentials = await db.getWebAuthnCredentialsByUsername(username);
    if (credentials.length === 0) {
        return res.status(404).json({ error: 'هیچ اثرانگشتی ثبت نشده است' });
    }

    const allowCredentials = credentials.map(function(c) {
        return { id: c.credentialId, type: 'public-key', transports: c.transports };
    });

    const challenge = webAuthnGenerateChallenge();
    storeChallenge(username, challenge, 'authenticate');

    res.json({ challenge, timeout: 60000, rpID: RP_ID, allowCredentials, userVerification: 'preferred' });
}));

app.post('/api/webauthn/authenticate', writeRateLimit, asyncHandler(async (req, res) => {
    const { credential, username } = req.body;
    if (!username || !credential) {
        return res.status(400).json({ error: 'اطلاعات ناقص است' });
    }

    const expectedChallenge = getAndRemoveChallenge(username);
    if (!expectedChallenge || expectedChallenge.type !== 'authenticate') {
        return res.status(400).json({ error: 'چالش نامعتبر یا منقضی شده است' });
    }

    const storedCredential = await db.getWebAuthnCredentialByCredentialId(credential.id);
    if (!storedCredential) {
        return res.status(400).json({ error: 'اثرانگشت یافت نشد' });
    }

    try {
        var result = webAuthnVerifyAssertion(
            credential.response.authenticatorData,
            credential.response.clientDataJSON,
            credential.response.signature,
            expectedChallenge.challenge,
            ORIGIN,
            RP_ID,
            storedCredential.publicKey,
            storedCredential.counter
        );
    } catch(e) {
        return res.status(400).json({ error: 'تایید هویت ناموفق' });
    }

    if (!result.verified) {
        return res.status(400).json({ error: result.error || 'تایید هویت ناموفق' });
    }

    await db.updateWebAuthnCredentialCounter(credential.id, result.newCounter);

    const user = await db.getUser(username);
    if (!user) return res.status(400).json({ error: 'کاربر یافت نشد' });

    const token = signJWT({ username, isAdmin: !!user.isAdmin });
    var cookieFlags = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400' + (isVercel ? '; Secure' : '');
    res.setHeader('Set-Cookie', 'token=' + encodeURIComponent(token) + '; ' + cookieFlags);
    res.json({ success: true, token, isAdmin: !!user.isAdmin });
}));

app.get('/api/webauthn/credentials', requireUser, asyncHandler(async (req, res) => {
    const credentials = await db.getWebAuthnCredentialsByUsername(req.user.username);
    const result = credentials.map(function(c) {
        return { id: c.id, deviceName: c.deviceName, createdAt: c.createdAt };
    });
    res.json(result);
}));

app.delete('/api/webauthn/credentials/:id', requireUser, writeRateLimit, asyncHandler(async (req, res) => {
    await db.deleteWebAuthnCredential(req.params.id, req.user.username);
    res.json({ success: true });
}));

// ==================== SERVER ====================
const PORT = process.env.PORT || 3003;
let server;
if (!isVercel && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    server = http.createServer({
        keepAlive: true,
        keepAliveTimeout: 5000
    }, app);
    const io = new Server(server, {
        path: '/socket.io',
        cors: {
            origin: isVercel ? 'https://cafenet.ir' : false,
            methods: ['GET', 'POST']
        }
    });

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

// Global error handler — must be after all routes
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message || err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'خطای داخلی سرور' });
});

module.exports = app;
