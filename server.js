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
    if (filePath.toString().endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
};
app.use('/public', express.static(path.join(rootDir, 'public'), staticOptions));
app.use(express.static(path.join(rootDir, 'public'), staticOptions));

const isVercel = !!process.env.VERCEL;
const DB_PATH = isVercel
    ? path.join('/tmp', 'database.json')
    : path.join(rootDir, 'database.json');

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return { users: [], orders: [], banners: [], chat: [] };
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

function writeDB(data) {
    if (!isVercel) {
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
    writeDB(db);
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
        trackingCode,
        username: (req.body.username || '').trim() || null,
        ...req.body,
        created_at: new Date()
    };
    const db = readDB();
    db.orders = db.orders || [];
    db.orders.push(order);
    writeDB(db);
    res.json({ success: true, trackingCode });
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
    writeDB(db);
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
    writeDB(db);
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
    writeDB(db);
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
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/orders', async (req, res) => {
    const { status } = req.query;
    const db = readDB();
    let orders = db.orders || [];
    if (status) {
        orders = orders.filter(o => o.status === status);
    }
    res.json(orders);
});

app.get('/api/orders/user', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    const db = readDB();
    let userOrders = (db.orders || []).filter(o => o.username === username);
    res.json(userOrders);
});

// Banner routes
app.post('/api/banner', async (req, res) => {
    const { src, link } = req.body;
    const db = readDB();
    db.banners = db.banners || [];
    db.banners.push({
        id: Date.now(),
        src,
        link: link || '',
        date: new Date().toISOString()
    });
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/banner', async (req, res) => {
    const db = readDB();
    res.json(db.banners || []);
});

app.delete('/api/banner/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDB();
    db.banners = (db.banners || []).filter(b => b.id != id);
    writeDB(db);
    res.json({ success: true });
});

app.put('/api/banner/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { src, link } = req.body;
    const db = readDB();
    const banner = (db.banners || []).find(b => b.id == id);
    if (banner) {
        banner.src = src;
        banner.link = link || '';
        banner.date = new Date().toISOString();
        writeDB(db);
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
    const { username, text } = req.body;
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
        timestamp: new Date().toISOString()
    };
    db.chat.push(message);
    writeDB(db);
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
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/admin/chat', async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'متن پیام الزامی است' });
    }
    const db = readDB();
    if (!db.chat) db.chat = [];
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'admin',
        username: null,
        text: text.trim(),
        timestamp: new Date().toISOString()
    };
    db.chat.push(message);
    writeDB(db);
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
        customer.unread = hasAdminReply ? 0 : 1;
        if (lastAdminGlobal && customer.lastTimestamp <= lastAdminGlobal) {
            customer.unread = 0;
        }
    });
    var list = Object.keys(customers).map(function(k) { return customers[k]; });
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

module.exports = app;