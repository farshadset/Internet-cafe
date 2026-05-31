const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3003;

app.use(express.static('.'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const DB_FILE = './database.json';

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { users: [], orders: [], banner: null };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'کاربر وجود دارد' });
    }
    db.users.push({ username, password });
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
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

app.post('/api/order', (req, res) => {
    const order = {
        id: Date.now(),
        trackingCode: 'CFT-' + Date.now().toString().slice(-8),
        ...req.body
    };
    const db = readDB();
    db.orders.push(order);
    writeDB(db);
    res.json({ success: true, trackingCode: order.trackingCode });
});

app.post('/api/order/confirm', (req, res) => {
    const { trackingCode } = req.body;
    const db = readDB();
    const order = db.orders.find(o => o.trackingCode === trackingCode);
    if (!order) {
        return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }
    order.status = 'pending';
    order.confirmedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/order/status', (req, res) => {
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
    order.updatedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/change-password', (req, res) => {
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

app.get('/api/orders', (req, res) => {
    const db = readDB();
    const status = req.query.status;
    let orders = db.orders;
    if (status) {
        orders = orders.filter(o => o.status === status);
    }
    res.json(orders);
});

app.get('/api/orders/user', (req, res) => {
    const db = readDB();
    const username = req.query.username;
    const status = req.query.status;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    let userOrders = db.orders.filter(o => o.username === username);
    if (status) {
        userOrders = userOrders.filter(o => o.status === status);
    }
    res.json(userOrders);
});

app.post('/api/banner', (req, res) => {
    const db = readDB();
    const newBanner = { 
        id: Date.now(), 
        src: req.body.src, 
        link: req.body.link || '',
        date: new Date().toISOString() 
    };
    db.banners = db.banners || [];
    db.banners.push(newBanner);
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/banner', (req, res) => {
    const db = readDB();
    res.json(db.banners || []);
});

app.delete('/api/banner/:id', (req, res) => {
    const db = readDB();
    db.banners = (db.banners || []).filter(b => b.id != req.params.id);
    writeDB(db);
    res.json({ success: true });
});

app.put('/api/banner/:id', (req, res) => {
    const db = readDB();
    const banner = (db.banners || []).find(b => b.id == req.params.id);
    if (banner) {
        banner.src = req.body.src;
        banner.link = req.body.link || '';
        banner.date = new Date().toISOString();
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'بنر پیدا نشد' });
    }
});

function ensureChat(db) {
    if (!db.chat) db.chat = [];
    return db;
}

app.get('/api/chat', (req, res) => {
    const db = ensureChat(readDB());
    const username = req.query.username;
    if (username) {
        const messages = db.chat.filter(m =>
            (m.role === 'customer' && m.username === username) ||
            (m.role === 'admin')
        );
        res.json(messages);
    } else {
        const messages = db.chat.filter(m => m.role === 'customer');
        res.json(messages);
    }
});

app.post('/api/chat', (req, res) => {
    const { username, text } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'متن پیام الزامی است' });
    }
    const db = ensureChat(readDB());
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

app.get('/api/admin/chat', (req, res) => {
    const db = ensureChat(readDB());
    res.json(db.chat);
});

app.post('/api/admin/chat', (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'متن پیام الزامی است' });
    }
    const db = ensureChat(readDB());
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

app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
