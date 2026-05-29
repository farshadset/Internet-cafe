const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3003;

app.use(express.static('.'));
app.use(express.json());
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

app.get('/api/orders', (req, res) => {
    const db = readDB();
    res.json(db.orders);
});

app.post('/api/banner', (req, res) => {
    const db = readDB();
    db.banner = { src: req.body.src, date: new Date().toISOString() };
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/banner', (req, res) => {
    const db = readDB();
    res.json(db.banner ? [db.banner] : []);
});

app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
