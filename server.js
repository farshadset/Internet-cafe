const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const rootDir = path.resolve(__dirname);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(rootDir, 'public')));

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
    res.json(db.chat || []);
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

const PORT = process.env.PORT || 3003;
if (!isVercel && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.listen(PORT, () => {
        console.log('Server running on http://localhost:' + PORT);
    });
}

module.exports = app;