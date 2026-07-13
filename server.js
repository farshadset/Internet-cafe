const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const rootDir = path.resolve(__dirname);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.use('/public', express.static(path.join(rootDir, 'public'), staticOptions));
app.use(express.static(path.join(rootDir, 'public'), staticOptions));

const isVercel = !!process.env.VERCEL;
const useTurso = isVercel && !!process.env.TURSO_DATABASE_URL;
const DB_PATH = isVercel
    ? path.join('/tmp', 'database.json')
    : path.join(rootDir, 'database.json');
const ATTACHMENTS_DIR = path.join(rootDir, 'public', 'uploads', 'attachments');

fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

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

function getDefaultDB() {
    return { users: [], orders: [], banners: [], chat: [], chatMeta: {}, visits: {}, pricing: [], chatConversations: [] };
}

let tursoAvailable = false;
let dbCache = null;
let dbInitialized = false;

async function tursoQuery(sql, args) {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    const resp = await fetch(url + '/v2/pipeline', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            requests: [{ type: 'execute', stmt: { sql: sql, args: args || [] } }]
        })
    });
    const data = await resp.json();
    if (data.results && data.results[0] && data.results[0].response && data.results[0].response.result) {
        return data.results[0].response.result;
    }
    throw new Error(JSON.stringify(data));
}

async function initDatabase() {
    if (dbInitialized) return;
    if (!useTurso) {
        dbCache = null;
        dbInitialized = true;
        return;
    }
    try {
        await tursoQuery('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        var result = await tursoQuery('SELECT value FROM kv WHERE key = ?', ['main_db']);
        dbCache = (result.rows && result.rows.length > 0) ? JSON.parse(result.rows[0].value) : getDefaultDB();
        tursoAvailable = true;
        dbInitialized = true;
        console.log('Turso HTTP API initialized successfully');
    } catch (e) {
        console.error('Turso init error:', e.message || e);
        try {
            var fileData = fs.readFileSync(DB_PATH, 'utf8');
            dbCache = JSON.parse(fileData);
        } catch (_) {
            dbCache = getDefaultDB();
        }
        dbInitialized = true;
    }
}

const dbReady = initDatabase();

function readDB() {
    if (dbCache) return dbCache;
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return getDefaultDB();
    }
}

function migrateChatData(db) {
    if (!db.chat) db.chat = [];
    db.chatMeta = db.chatMeta || {};
    var changed = false;
    db.chat.forEach(function(msg) {
        if (msg.role === 'customer' && !msg.username) {
            msg.username = 'مهمان';
            changed = true;
        }
    });
    if (changed) writeDB(db);
}

async function writeDB(data) {
    if (isVercel) {
        dbCache = data;
        try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch(_){}
        if (tursoAvailable) {
            try {
                await tursoQuery('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', ['main_db', JSON.stringify(data)]);
            } catch (e) {
                console.error('Turso write error:', e.message || e);
            }
        }
    } else {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }
}

// Auth routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'کاربر وجود دارد' });
    }
    db.users.push({ username, password });
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'sedeb' && password === 'sedeb75') {
        res.json({ success: true, token: 'admin-token' });
    } else {
        res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
});

// Order routes
app.post('/api/order', async (req, res) => {
    const trackingCode = 'CFT-' + Date.now().toString().slice(-8);
    const order = {
        username: (req.body.username || '').trim() || null,
        ...req.body,
        trackingCode,
        created_at: new Date()
    };
    const db = readDB();
    db.orders = db.orders || [];
    db.orders.push(order);
    await writeDB(db);
    res.json({ success: true, trackingCode });
});

app.get('/api/order/:trackingCode', async (req, res) => {
    const { trackingCode } = req.params;
    const db = readDB();
    const order = (db.orders || []).find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    res.json(order);
});

app.post('/api/order-attachment', async (req, res) => {
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

    const db = readDB();
    const order = (db.orders || []).find(o => o.trackingCode === trackingCode);
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

    order.attachments = order.attachments || [];
    const existingIndex = order.attachments.findIndex(a => a.id === savedAttachment.id);
    if (existingIndex >= 0) {
        order.attachments[existingIndex] = savedAttachment;
    } else {
        order.attachments.push(savedAttachment);
    }
    order.updated_at = new Date().toISOString();
    await writeDB(db);

    res.json({ success: true, attachment: savedAttachment });
});

app.post('/api/order/confirm', async (req, res) => {
    const { trackingCode } = req.body;
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    order.status = 'pending';
    order.confirmed_at = new Date().toISOString();
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/order/status', async (req, res) => {
    const { trackingCode, status } = req.body;
    if (!['pending', 'processing', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر' });
    }
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    order.status = status;
    order.updated_at = new Date().toISOString();
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/order/result', async (req, res) => {
    const { trackingCode, result } = req.body;
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    if (result && result.trim()) {
        order.result = result.trim();
    } else {
        delete order.result;
    }
    order.result_at = new Date().toISOString();
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/order/price-proposal', async (req, res) => {
    const { trackingCode, proposedPrice } = req.body;
    if (!trackingCode || !proposedPrice) {
        return res.status(400).json({ error: 'کد سفارش و قیمت الزامی است' });
    }
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    order.proposedPrice = proposedPrice;
    order.priceStatus = 'usercounter';
    order.updated_at = new Date().toISOString();
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/order/price-counter', async (req, res) => {
    const { trackingCode, adminProposedPrice } = req.body;
    if (!trackingCode || !adminProposedPrice) {
        return res.status(400).json({ error: 'کد سفارش و قیمت الزامی است' });
    }
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    order.adminProposedPrice = adminProposedPrice;
    order.priceStatus = 'countersent';
    order.updated_at = new Date().toISOString();
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/order/price-accept', async (req, res) => {
    const { trackingCode } = req.body;
    if (!trackingCode) {
        return res.status(400).json({ error: 'کد سفارش الزامی است' });
    }
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    order.priceStatus = 'accepted';
    order.cost = 'قیمت توافقی - ' + (order.adminProposedPrice || order.proposedPrice);
    order.updated_at = new Date().toISOString();
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/order/pay', async (req, res) => {
    const { trackingCode } = req.body;
    if (!trackingCode) {
        return res.status(400).json({ error: 'کد سفارش الزامی است' });
    }
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    if (order.priceStatus !== 'accepted') {
        return res.status(400).json({ error: 'قیمت هنوز تایید نشده است' });
    }
    order.paid = true;
    order.paymentStatus = 'paid';
    order.updated_at = new Date().toISOString();
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/change-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user) {
        return res.status(404).json({ error: 'کاربر پیدا نشد' });
    }
    if (user.password !== currentPassword) {
        return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
    }
    user.password = newPassword;
    await writeDB(db);
    res.json({ success: true });
});

const lastVisitTime = {};

app.post('/api/track-visit', async (req, res) => {
    const db = readDB();
    db.visits = db.visits || {};
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = new Date();
    const COOLDOWN = 30 * 60 * 1000;
    if (lastVisitTime[ip] && (now.getTime() - lastVisitTime[ip]) < COOLDOWN) {
        return res.json({ success: true, counted: false });
    }
    lastVisitTime[ip] = now.getTime();
    const key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    db.visits[key] = (db.visits[key] || 0) + 1;
    await writeDB(db);
    res.json({ success: true, counted: true });
});

app.get('/api/visits', async (req, res) => {
    const db = readDB();
    res.json(db.visits || {});
});

app.get('/api/orders', async (req, res) => {
    const { status } = req.query;
    const db = readDB();
    let orders = db.orders || [];
    if (status) {
        orders = orders.filter(o => o.status === status);
    }
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(orders);
});

app.get('/api/orders/user', async (req, res) => {
    const { username, status } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    const db = readDB();
    let userOrders = (db.orders || []).filter(o => o.username === username);
    if (status) {
        userOrders = userOrders.filter(o => o.status === status);
    }
    userOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(userOrders);
});

app.get('/api/admin/customers', async (req, res) => {
    const db = readDB();
    const completedOrders = (db.orders || []).filter(o => o.status === 'completed');
    
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

// Pricing routes
app.get('/api/pricing', async (req, res) => {
    const db = readDB();
    res.json(db.pricing || []);
});

app.post('/api/pricing', async (req, res) => {
    const { service, price } = req.body;
    if (!service) {
        return res.status(400).json({ error: 'سرویس الزامی است' });
    }
    const db = readDB();
    db.pricing = db.pricing || [];
    const existing = db.pricing.find(p => p.service === service);
    if (existing) {
        existing.price = price;
    } else {
        db.pricing.push({ service, price });
    }
    await writeDB(db);
    res.json({ success: true });
});

// Banner routes
app.post('/api/banner', async (req, res) => {
    const { src, link, duration, group } = req.body;
    const db = readDB();
    db.banners = db.banners || [];
    const targetGroup = [1, 2].includes(parseInt(group, 10)) ? parseInt(group, 10) : 1;
    const groupBanners = db.banners.filter(b => (parseInt(b.group, 10) || 1) == targetGroup);
    if (groupBanners.length >= 3) {
        return res.status(400).json({ error: 'حداکثر تعداد بنرهای هر گروه ۳ عدد است' });
    }
    db.banners.push({
        id: Date.now(),
        src,
        link: link || '',
        duration: parseInt(duration) || 5,
        group: targetGroup,
        date: new Date().toISOString()
    });
    await writeDB(db);
    res.json({ success: true });
});

app.get('/api/banner', async (req, res) => {
    const { group } = req.query;
    const db = readDB();
    var allBanners = db.banners || [];
    allBanners.forEach(b => {
        if (!b.group) b.group = 1;
        if (!b.duration) b.duration = 5;
    });
    if (group) {
        const groupNum = parseInt(group);
        if (!Number.isNaN(groupNum)) {
            return res.json(allBanners.filter(b => parseInt(b.group, 10) == groupNum));
        }
    }
    res.json(allBanners);
});

app.delete('/api/banner/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDB();
    db.banners = (db.banners || []).filter(b => b.id != id);
    await writeDB(db);
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

app.put('/api/banner/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { src, link, duration, group } = req.body;
    const db = readDB();
    const banner = (db.banners || []).find(b => b.id == id);
    if (banner) {
        var newGroup = [1, 2].includes(parseInt(group, 10)) ? parseInt(group, 10) : (parseInt(banner.group, 10) || 1);
        if (newGroup !== parseInt(banner.group, 10)) {
            var groupBanners = (db.banners || []).filter(b => (parseInt(b.group, 10) || 1) == newGroup);
            if (groupBanners.length >= 3) {
                return res.status(400).json({ error: 'حداکثر تعداد بنرهای هر گروه ۳ عدد است' });
            }
        }
        banner.src = src;
        banner.link = link || '';
        banner.duration = parseInt(duration) || 5;
        banner.group = newGroup;
        banner.date = new Date().toISOString();
        await writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'بنر پیدا نشد' });
    }
});

// Chat routes
app.get('/api/chat', async (req, res) => {
    const { username } = req.query;
    const db = readDB();
    migrateChatData(db);
    if (username) {
        const messages = (db.chat || []).filter(m =>
            (m.role === 'customer' && m.username === username) ||
            (m.role === 'admin')
        );
        res.json(messages);
    } else {
        res.json((db.chat || []).filter(m => m.role === 'customer'));
    }
});

app.post('/api/chat', async (req, res) => {
    const { username, text, conversationId, attachments } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'متن پیام الزامی است' });
    }
    const db = readDB();
    if (!db.chat) db.chat = [];
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'customer',
        username: username || 'مهمان',
        text: text.trim(),
        timestamp: new Date().toISOString(),
        conversationId: conversationId || null,
        attachments: Array.isArray(attachments) ? attachments : []
    };
    db.chat.push(message);
    await writeDB(db);
    res.json(message);
});

app.get('/api/admin/chat', async (req, res) => {
    const db = readDB();
    migrateChatData(db);
    res.json({
        messages: db.chat || [],
        lastReadAt: db.chatMeta && db.chatMeta.lastReadAt ? db.chatMeta.lastReadAt : null
    });
});

app.post('/api/admin/chat/read', async (req, res) => {
    const { lastReadAt } = req.body;
    const db = readDB();
    db.chatMeta = db.chatMeta || {};
    if (lastReadAt) {
        db.chatMeta.lastReadAt = lastReadAt;
    }
    await writeDB(db);
    res.json({ success: true });
});

app.post('/api/admin/chat', async (req, res) => {
    const { text, username, conversationId, attachments } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'متن پیام الزامی است' });
    }
    const db = readDB();
    if (!db.chat) db.chat = [];
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'admin',
        username: username || null,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        conversationId: conversationId || null,
        attachments: Array.isArray(attachments) ? attachments : []
    };
    db.chat.push(message);
    await writeDB(db);
    res.json(message);
});

app.get('/api/admin/chat/conversation', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    const db = readDB();
    migrateChatData(db);
    var messages = (db.chat || []).filter(function(m) {
        return (m.role === 'customer' && m.username === username) || (m.role === 'admin' && !m.username);
    });
    messages.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    res.json(messages);
});

app.get('/api/admin/chat/conversations', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    const db = readDB();
    migrateChatData(db);
    var convs = {};
    (db.chat || []).forEach(function(m) {
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

app.get('/api/admin/chat/conversation/:id', async (req, res) => {
    const { id } = req.params;
    const db = readDB();
    var messages = (db.chat || []).filter(function(m) {
        return m.conversationId === id;
    });
    messages.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    res.json(messages);
});

app.get('/api/admin/chat/customers', async (req, res) => {
    const db = readDB();
    migrateChatData(db);
    var customers = {};
    (db.chat || []).forEach(function(m) {
        if (m.role === 'customer') {
            if (!customers[m.username]) {
                customers[m.username] = { username: m.username, lastMessage: m.text, lastTimestamp: m.timestamp, unread: 0 };
            }
            customers[m.username].lastMessage = m.text;
            customers[m.username].lastTimestamp = m.timestamp;
        }
    });
    var lastAdminGlobal = db.chatMeta && db.chatMeta.lastReadAt ? db.chatMeta.lastReadAt : null;
    Object.keys(customers).forEach(function(key) {
        var customer = customers[key];
        var hasAdminReply = (db.chat || []).some(function(m) {
            return m.role === 'admin' && (!m.username || m.username === customer.username) && m.timestamp >= customer.lastTimestamp;
        });
        if (!hasAdminReply) customer.unread = 1;
    });
    var list = Object.keys(customers).map(function(k) { return customers[k]; });
    list.sort(function(a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    res.json(list);
});

app.post('/api/chat/conversation', async (req, res) => {
    const { username } = req.body;
    const db = readDB();
    if (!db.chatConversations) db.chatConversations = [];
    const conv = {
        id: 'conv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        username: username || 'مهمان',
        createdAt: new Date().toISOString(),
        status: 'open'
    };
    db.chatConversations.push(conv);
    await writeDB(db);
    res.json(conv);
});

app.get('/api/chat/conversation/:id', async (req, res) => {
    const { id } = req.params;
    const { username } = req.query;
    const db = readDB();
    var messages = (db.chat || []).filter(function(m) {
        return m.conversationId === id;
    });
    messages.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    if (username && !messages.some(function(m) { return m.role === 'customer' && m.username === username; })) {
        messages = messages.filter(function(m) { return m.role === 'admin'; });
    }
    res.json(messages);
});

app.get('/api/chat/conversations', async (req, res) => {
    const { username } = req.query;
    const db = readDB();
    var convs = {};
    (db.chat || []).forEach(function(m) {
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

const PORT = process.env.PORT || 3003;
let server;
if (!isVercel && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    server = http.createServer(app);
    const io = new Server(server, { path: '/socket.io' });

    io.on('connection', (socket) => {
        socket.on('join-admin-room', () => {
            socket.join('admin-room');
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

const ORIGINAL_POST_CHAT = app._router && app._router.stack ? null : null;

app.dbReady = dbReady;
module.exports = app;