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

const USE_SQLITE = !isVercel && fs.existsSync(rootDir + '/cafe.db');

if (USE_SQLITE) {
    const Database = require('better-sqlite3');
    const db = new Database(rootDir + '/cafe.db');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tracking_code TEXT UNIQUE NOT NULL,
            username TEXT,
            data TEXT,
            status TEXT DEFAULT 'pending',
            result TEXT,
            confirmed_at DATETIME,
            updated_at DATETIME,
            result_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS banners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            src TEXT NOT NULL,
            link TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            username TEXT,
            text TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const stmtInsertUser = db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)');
    const stmtFindUser = db.prepare('SELECT * FROM users WHERE username = ?');
    const stmtAuthUser = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    const stmtAllUsers = db.prepare('SELECT * FROM users');
    const stmtUpdatePassword = db.prepare('UPDATE users SET password = ? WHERE username = ?');

    const stmtInsertOrder = db.prepare('INSERT INTO orders (tracking_code, username, data, status) VALUES (?, ?, ?, ?)');
    const stmtFindOrder = db.prepare('SELECT * FROM orders WHERE tracking_code = ?');
    const stmtUpdateOrderStatus = db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE tracking_code = ?');
    const stmtUpdateOrderResult = db.prepare('UPDATE orders SET result = ?, result_at = ? WHERE tracking_code = ?');
    const stmtUpdateOrderConfirm = db.prepare('UPDATE orders SET status = ?, confirmed_at = ? WHERE tracking_code = ?');
    const stmtGetOrders = db.prepare('SELECT * FROM orders WHERE status = ?');
    const stmtGetUserOrders = db.prepare('SELECT * FROM orders WHERE username = ?');

    const stmtInsertBanner = db.prepare('INSERT INTO banners (src, link) VALUES (?, ?)');
    const stmtGetBanners = db.prepare('SELECT * FROM banners ORDER BY date DESC');
    const stmtDeleteBanner = db.prepare('DELETE FROM banners WHERE id = ?');
    const stmtUpdateBanner = db.prepare('UPDATE banners SET src = ?, link = ? WHERE id = ?');

    const stmtInsertChat = db.prepare('INSERT INTO chat_messages (id, role, username, text) VALUES (?, ?, ?, ?)');
    const stmtGetCustomerChat = db.prepare('SELECT * FROM chat_messages WHERE role = ?');
    const stmtGetUserChat = db.prepare('SELECT * FROM chat_messages WHERE (role = ? AND username = ?) OR role = ? ORDER BY timestamp');
    const stmtGetAdminChat = db.prepare('SELECT * FROM chat_messages ORDER BY timestamp');

    function readDB() {
        return {
            users: stmtAllUsers.all(),
            orders: [],
            banners: stmtGetBanners.all(),
            chat: stmtGetAdminChat.all()
        };
    }

    function writeDB(data) {
        throw new Error('writeDB not used in SQLite mode');
    }

    app.post('/api/register', (req, res) => {
        const { username, password } = req.body;
        try {
            stmtInsertUser.run(username, password);
            res.json({ success: true });
        } catch (e) {
            res.status(400).json({ error: 'کاربر وجود دارد' });
        }
    });

    app.post('/api/login', (req, res) => {
        const { username, password } = req.body;
        const user = stmtAuthUser.get(username, password);
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
        try {
            stmtInsertOrder.run(order.trackingCode, order.username || '', JSON.stringify(order), 'pending');
            res.json({ success: true, trackingCode: order.trackingCode });
        } catch (e) {
            res.status(500).json({ error: 'خطا در ثبت سفارش' });
        }
    });

    app.post('/api/order/confirm', (req, res) => {
        const { trackingCode } = req.body;
        const order = stmtFindOrder.get(trackingCode);
        if (!order) {
            return res.status(404).json({ error: 'سفارش پیدا نشد' });
        }
        stmtUpdateOrderConfirm.run('pending', new Date().toISOString(), trackingCode);
        res.json({ success: true });
    });

    app.post('/api/order/status', (req, res) => {
        const { trackingCode, status } = req.body;
        if (!['pending', 'processing', 'completed'].includes(status)) {
            return res.status(400).json({ error: 'وضعیت نامعتبر' });
        }
        const order = stmtFindOrder.get(trackingCode);
        if (!order) {
            return res.status(404).json({ error: 'سفارش پیدا نشد' });
        }
        stmtUpdateOrderStatus.run(status, new Date().toISOString(), trackingCode);
        res.json({ success: true });
    });

    app.post('/api/order/result', (req, res) => {
        const { trackingCode, result } = req.body;
        const order = stmtFindOrder.get(trackingCode);
        if (!order) {
            return res.status(404).json({ error: 'سفارش پیدا نشد' });
        }
        const resultValue = result && result.trim() ? result.trim() : null;
        stmtUpdateOrderResult.run(resultValue, new Date().toISOString(), trackingCode);
        res.json({ success: true });
    });

    app.post('/api/change-password', (req, res) => {
        const { username, currentPassword, newPassword } = req.body;
        const user = stmtFindUser.get(username);
        if (!user) {
            return res.status(404).json({ error: 'کاربر پیدا نشد' });
        }
        if (user.password !== currentPassword) {
            return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
        }
        stmtUpdatePassword.run(newPassword, username);
        res.json({ success: true });
    });

    app.get('/api/orders', (req, res) => {
        const { status } = req.query;
        if (status) {
            res.json(stmtGetOrders.all(status));
        } else {
            res.json([]);
        }
    });

    app.get('/api/orders/user', (req, res) => {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ error: 'نام کاربری الزامی است' });
        }
        res.json(stmtGetUserOrders.all(username));
    });

    app.post('/api/banner', (req, res) => {
        const { src, link } = req.body;
        try {
            const info = stmtInsertBanner.run(src, link || '');
            res.json({ success: true, id: info.lastInsertRowid });
        } catch (e) {
            res.status(500).json({ error: 'خطا در ذخیره بنر' });
        }
    });

    app.get('/api/banner', (req, res) => {
        res.json(stmtGetBanners.all());
    });

    app.delete('/api/banner/:id', (req, res) => {
        stmtDeleteBanner.run(req.params.id);
        res.json({ success: true });
    });

    app.put('/api/banner/:id', (req, res) => {
        const { src, link } = req.body;
        const banner = stmtGetBanners.all().find(b => b.id == req.params.id);
        if (banner) {
            stmtUpdateBanner.run(src, link || '', req.params.id);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'بنر پیدا نشد' });
        }
    });

    app.get('/api/chat', (req, res) => {
        const { username } = req.query;
        if (username) {
            res.json(stmtGetUserChat.all('customer', username, 'admin'));
        } else {
            res.json(stmtGetCustomerChat.all('customer'));
        }
    });

    app.post('/api/chat', (req, res) => {
        const { username, text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'متن پیام الزامی است' });
        }
        const message = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            role: 'customer',
            username: username || 'مهمان',
            text: text.trim(),
            timestamp: new Date().toISOString()
        };
        stmtInsertChat.run(message.id, message.role, message.username, message.text);
        res.json(message);
    });

    app.get('/api/admin/chat', (req, res) => {
        res.json(stmtGetAdminChat.all());
    });

    app.post('/api/admin/chat', (req, res) => {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'متن پیام الزامی است' });
        }
        const message = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            role: 'admin',
            username: null,
            text: text.trim(),
            timestamp: new Date().toISOString()
        };
        stmtInsertChat.run(message.id, message.role, null, message.text);
        res.json(message);
    });
} else {
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

    function ensureChat(db) {
        if (!db.chat) db.chat = [];
        if (!db.banners) db.banners = [];
        return db;
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
        db.orders = db.orders || [];
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
        const db = readDB();
        const order = db.orders.find(o => o.trackingCode === trackingCode);
        if (!order) {
            return res.status(404).json({ error: 'سفارش پیدا نشد' });
        }
        if (!['pending', 'processing', 'completed'].includes(status)) {
            return res.status(400).json({ error: 'وضعیت نامعتبر' });
        }
        order.status = status;
        order.updatedAt = new Date().toISOString();
        writeDB(db);
        res.json({ success: true });
    });

    app.post('/api/order/result', (req, res) => {
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
        order.resultAt = new Date().toISOString();
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
        let orders = db.orders || [];
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
        let userOrders = (db.orders || []).filter(o => o.username === username);
        if (status) {
            userOrders = userOrders.filter(o => o.status === status);
        }
        res.json(userOrders);
    });

    app.post('/api/banner', (req, res) => {
        const db = ensureChat(readDB());
        const newBanner = {
            id: Date.now(),
            src: req.body.src,
            link: req.body.link || '',
            date: new Date().toISOString()
        };
        db.banners.push(newBanner);
        writeDB(db);
        res.json({ success: true });
    });

    app.get('/api/banner', (req, res) => {
        const db = ensureChat(readDB());
        res.json(db.banners);
    });

    app.delete('/api/banner/:id', (req, res) => {
        const db = ensureChat(readDB());
        db.banners = (db.banners || []).filter(b => b.id != req.params.id);
        writeDB(db);
        res.json({ success: true });
    });

    app.put('/api/banner/:id', (req, res) => {
        const db = ensureChat(readDB());
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
            res.json(db.chat.filter(m => m.role === 'customer'));
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
}

const PORT = process.env.PORT || 3003;
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('Server running on http://localhost:' + PORT);
    });
}
