const express = require('express');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const rootDir = path.resolve(__dirname);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(rootDir, 'public')));

const MONGODB_URI = process.env.MONGODB_URI;
const USE_MONGODB = !!MONGODB_URI;

let mongoClient = null;
let mongoDb = null;

async function connectMongo() {
    if (mongoDb) return mongoDb;
    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        mongoDb = mongoClient.db('cafe');
        
        const users = mongoDb.collection('users');
        const orders = mongoDb.collection('orders');
        const banners = mongoDb.collection('banners');
        const chat = mongoDb.collection('chat');
        
        await users.createIndex({ username: 1 }, { unique: true });
        await orders.createIndex({ trackingCode: 1 }, { unique: true });
        await banners.createIndex({ id: 1 }, { unique: true });
        await chat.createIndex({ id: 1 }, { unique: true });
        
        console.log('Connected to MongoDB');
        return mongoDb;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
    }
}

function getCollections() {
    if (!mongoDb) throw new Error('Database not connected');
    return {
        users: mongoDb.collection('users'),
        orders: mongoDb.collection('orders'),
        banners: mongoDb.collection('banners'),
        chat: mongoDb.collection('chat')
    };
}

const DB_PATH = path.join(rootDir, 'database.json');

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return { users: [], orders: [], banners: [], chat: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

async function withDB(handler) {
    if (USE_MONGODB) {
        try {
            await connectMongo();
        } catch (e) {
            return (req, res) => res.status(500).json({ error: 'خطا در اتصال به دیتابیس' });
        }
    }
    return handler;
}

function withLocalDB(handler) {
    return async (req, res) => {
        if (USE_MONGODB) {
            const wrapped = await withDB(() => handler);
            return wrapped(req, res);
        }
        return handler(req, res, () => {});
    };
}

// Auth routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            await getCollections().users.insertOne({ username, password, created_at: new Date() });
            res.json({ success: true });
        } catch (e) {
            if (e.code === 11000) {
                res.status(400).json({ error: 'کاربر وجود دارد' });
            } else {
                res.status(500).json({ error: 'خطا در ثبت نام' });
            }
        }
    } else {
        const db = readDB();
        if (db.users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'کاربر وجود دارد' });
        }
        db.users.push({ username, password });
        writeDB(db);
        res.json({ success: true });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const user = await getCollections().users.findOne({ username, password });
            if (user) {
                res.json({ success: true });
            } else {
                res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
            }
        } catch (e) {
            res.status(500).json({ error: 'خطا در ورود' });
        }
    } else {
        const db = readDB();
        const user = db.users.find(u => u.username === username && u.password === password);
        if (user) {
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
        }
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
        created_at: new Date(),
        status: 'pending'
    };
    if (USE_MONGODB) {
        try {
            await connectMongo();
            await getCollections().orders.insertOne(order);
            res.json({ success: true, trackingCode });
        } catch (e) {
            res.status(500).json({ error: 'خطا در ثبت سفارش' });
        }
    } else {
        const db = readDB();
        db.orders = db.orders || [];
        db.orders.push(order);
        writeDB(db);
        res.json({ success: true, trackingCode });
    }
});

app.post('/api/order/confirm', async (req, res) => {
    const { trackingCode } = req.body;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const result = await getCollections().orders.updateOne(
                { trackingCode },
                { $set: { status: 'pending', confirmed_at: new Date() } }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'سفارش پیدا نشد' });
            }
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'خطا در تایید سفارش' });
        }
    } else {
        const db = readDB();
        const order = db.orders.find(o => o.trackingCode === trackingCode);
        if (!order) {
            return res.status(404).json({ error: 'سفارش پیدا نشد' });
        }
        order.status = 'pending';
        order.confirmed_at = new Date().toISOString();
        writeDB(db);
        res.json({ success: true });
    }
});

app.post('/api/order/status', async (req, res) => {
    const { trackingCode, status } = req.body;
    if (!['pending', 'processing', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر' });
    }
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const result = await getCollections().orders.updateOne(
                { trackingCode },
                { $set: { status, updated_at: new Date() } }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'سفارش پیدا نشد' });
            }
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'خطا در تغییر وضعیت' });
        }
    } else {
        const db = readDB();
        const order = db.orders.find(o => o.trackingCode === trackingCode);
        if (!order) {
            return res.status(404).json({ error: 'سفارش پیدا نشد' });
        }
        order.status = status;
        order.updated_at = new Date().toISOString();
        writeDB(db);
        res.json({ success: true });
    }
});

app.post('/api/order/result', async (req, res) => {
    const { trackingCode, result } = req.body;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const updateData = {
                result: result && result.trim() ? result.trim() : null,
                result_at: new Date()
            };
            const result2 = await getCollections().orders.updateOne(
                { trackingCode },
                { $set: updateData }
            );
            if (result2.matchedCount === 0) {
                return res.status(404).json({ error: 'سفارش پیدا نشد' });
            }
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'خطا در ثبت نتیجه' });
        }
    } else {
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
    }
});

app.post('/api/change-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const user = await getCollections().users.findOne({ username });
            if (!user) {
                return res.status(404).json({ error: 'کاربر پیدا نشد' });
            }
            if (user.password !== currentPassword) {
                return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
            }
            await getCollections().users.updateOne({ username }, { $set: { password: newPassword } });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'خطا در تغییر رمز' });
        }
    } else {
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
    }
});

app.get('/api/orders', async (req, res) => {
    const { status } = req.query;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const query = status ? { status } : {};
            const orders = await getCollections().orders.find(query).toArray();
            res.json(orders);
        } catch (e) {
            res.status(500).json({ error: 'خطا در دریافت سفارشات' });
        }
    } else {
        const db = readDB();
        let orders = db.orders || [];
        if (status) {
            orders = orders.filter(o => o.status === status);
        }
        res.json(orders);
    }
});

app.get('/api/orders/user', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'نام کاربری الزامی است' });
    }
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const orders = await getCollections().orders.find({ username }).toArray();
            res.json(orders);
        } catch (e) {
            res.status(500).json({ error: 'خطا در دریافت سفارشات' });
        }
    } else {
        const db = readDB();
        let userOrders = (db.orders || []).filter(o => o.username === username);
        res.json(userOrders);
    }
});

// Banner routes
app.post('/api/banner', async (req, res) => {
    const { src, link } = req.body;
    const banner = {
        id: Date.now(),
        src,
        link: link || '',
        date: new Date().toISOString()
    };
    if (USE_MONGODB) {
        try {
            await connectMongo();
            await getCollections().banners.insertOne(banner);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'خطا در ذخیره بنر' });
        }
    } else {
        const db = readDB();
        db.banners = db.banners || [];
        db.banners.push(banner);
        writeDB(db);
        res.json({ success: true });
    }
});

app.get('/api/banner', async (req, res) => {
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const banners = await getCollections().banners.find().sort({ date: -1 }).toArray();
            res.json(banners);
        } catch (e) {
            res.status(500).json({ error: 'خطا در دریافت بنرها' });
        }
    } else {
        const db = readDB();
        res.json(db.banners || []);
    }
});

app.delete('/api/banner/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (USE_MONGODB) {
        try {
            await connectMongo();
            await getCollections().banners.deleteOne({ id });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'خطا در حذف بنر' });
        }
    } else {
        const db = readDB();
        db.banners = (db.banners || []).filter(b => b.id != id);
        writeDB(db);
        res.json({ success: true });
    }
});

app.put('/api/banner/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { src, link } = req.body;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const result = await getCollections().banners.updateOne(
                { id },
                { $set: { src, link: link || '', date: new Date().toISOString() } }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'بنر پیدا نشد' });
            }
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'خطا در بروزرسانی بنر' });
        }
    } else {
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
    }
});

// Chat routes
app.get('/api/chat', async (req, res) => {
    const { username } = req.query;
    if (USE_MONGODB) {
        try {
            await connectMongo();
            let query = { role: 'customer' };
            if (username) {
                query = { $or: [{ role: 'customer', username }, { role: 'admin' }] };
            }
            const messages = await getCollections().chat.find(query).sort({ timestamp: 1 }).toArray();
            res.json(messages);
        } catch (e) {
            res.status(500).json({ error: 'خطا در دریافت چت' });
        }
    } else {
        const db = readDB();
        if (!db.chat) db.chat = [];
        if (!db.banners) db.banners = [];
        if (username) {
            const messages = db.chat.filter(m =>
                (m.role === 'customer' && m.username === username) ||
                (m.role === 'admin')
            );
            res.json(messages);
        } else {
            res.json(db.chat.filter(m => m.role === 'customer'));
        }
    }
});

app.post('/api/chat', async (req, res) => {
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
    if (USE_MONGODB) {
        try {
            await connectMongo();
            await getCollections().chat.insertOne(message);
            res.json(message);
        } catch (e) {
            res.status(500).json({ error: 'خطا در ارسال پیام' });
        }
    } else {
        const db = readDB();
        if (!db.chat) db.chat = [];
        db.chat.push(message);
        writeDB(db);
        res.json(message);
    }
});

app.get('/api/admin/chat', async (req, res) => {
    if (USE_MONGODB) {
        try {
            await connectMongo();
            const messages = await getCollections().chat.find().sort({ timestamp: 1 }).toArray();
            res.json(messages);
        } catch (e) {
            res.status(500).json({ error: 'خطا در دریافت چت' });
        }
    } else {
        const db = readDB();
        res.json(db.chat || []);
    }
});

app.post('/api/admin/chat', async (req, res) => {
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
    if (USE_MONGODB) {
        try {
            await connectMongo();
            await getCollections().chat.insertOne(message);
            res.json(message);
        } catch (e) {
            res.status(500).json({ error: 'خطا در ارسال پیام' });
        }
    } else {
        const db = readDB();
        if (!db.chat) db.chat = [];
        db.chat.push(message);
        writeDB(db);
        res.json(message);
    }
});

const PORT = process.env.PORT || 3003;
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('Server running on http://localhost:' + PORT);
    });
}

module.exports = app;
