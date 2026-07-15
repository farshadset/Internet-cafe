const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const isVercel = !!process.env.VERCEL;
const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
const DB_PATH = isVercel ? '/tmp/database.db' : path.join(__dirname, 'database.db');
const JSON_PATH = isVercel ? '/tmp/database.json' : path.join(__dirname, 'database.json');

let client = null;
let ready = false;
let initPromise = null;

function getTursoUrl() {
    let url = TURSO_URL;
    if (!url || !TURSO_TOKEN) return null;
    if (url.startsWith('libsql://')) url = 'https://' + url.slice('libsql://'.length);
    if (!url.endsWith('/')) url += '/';
    return url;
}

async function initDB() {
    if (ready) return client;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const url = getTursoUrl();
        if (url) {
            client = createClient({
                url: url,
                authToken: TURSO_TOKEN,
                syncUrl: url.replace(/\/$/, ''),
                syncInterval: 60,
            });
            try {
                await client.sync();
            } catch (e) {
                // sync warning - non-critical
            }
        } else {
            client = createClient({ url: 'file:' + DB_PATH });
        }

        await createTables(client);
        ready = true;
        return client;
    })();

    initPromise.catch(() => { initPromise = null; });
    return initPromise;
}

async function createTables(c) {
    await c.executeMultiple(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            isAdmin INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trackingCode TEXT UNIQUE NOT NULL,
            username TEXT,
            status TEXT DEFAULT 'new',
            cost TEXT,
            proposedPrice TEXT,
            adminProposedPrice TEXT,
            priceStatus TEXT,
            paid INTEGER DEFAULT 0,
            paymentStatus TEXT,
            result TEXT,
            result_at TEXT,
            confirmed_at TEXT,
            created_at TEXT,
            updated_at TEXT,
            extras TEXT
        );

        CREATE TABLE IF NOT EXISTS banners (
            id INTEGER PRIMARY KEY,
            src TEXT NOT NULL,
            link TEXT DEFAULT '',
            duration INTEGER DEFAULT 5,
            grp INTEGER DEFAULT 1,
            date TEXT
        );

        CREATE TABLE IF NOT EXISTS chat (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            username TEXT,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            conversationId TEXT,
            attachments TEXT
        );

        CREATE TABLE IF NOT EXISTS chat_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS visits (
            date TEXT PRIMARY KEY,
            count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS pricing (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT UNIQUE NOT NULL,
            price TEXT
        );

        CREATE TABLE IF NOT EXISTS chat_conversations (
            id TEXT PRIMARY KEY,
            username TEXT,
            createdAt TEXT,
            status TEXT DEFAULT 'open'
        );
    `);

    // Performance indexes
    await c.executeMultiple(`
        CREATE INDEX IF NOT EXISTS idx_orders_username ON orders(username);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
        CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_orders_username_status ON orders(username, status);
        CREATE INDEX IF NOT EXISTS idx_chat_username ON chat(username);
        CREATE INDEX IF NOT EXISTS idx_chat_conversationId ON chat(conversationId);
        CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat(timestamp);
        CREATE INDEX IF NOT EXISTS idx_chat_role ON chat(role);
        CREATE INDEX IF NOT EXISTS idx_chat_username_conv ON chat(username, conversationId);
        CREATE INDEX IF NOT EXISTS idx_conv_username ON chat_conversations(username);
    `);
}

// ==================== MIGRATION FROM JSON ====================
async function migrateFromJSON() {
    if (!ready) await initDB();

    // Check if already migrated
    const existing = await client.execute('SELECT COUNT(*) as cnt FROM users');
    if (existing.rows[0].cnt > 0) {
        return;
    }

    let jsonData;
    try {
        jsonData = JSON.parse(await fs.promises.readFile(JSON_PATH, 'utf8'));
    } catch (e) {
        return;
    }

    const tx = await client.transaction('write');
    try {
        // Migrate users
        for (const u of (jsonData.users || [])) {
            await tx.execute({
                sql: 'INSERT OR IGNORE INTO users (username, password, isAdmin) VALUES (?, ?, ?)',
                args: [u.username, u.password, u.isAdmin ? 1 : 0]
            });
        }

        // Migrate banners
        for (const b of (jsonData.banners || [])) {
            await tx.execute({
                sql: 'INSERT OR IGNORE INTO banners (id, src, link, duration, grp, date) VALUES (?, ?, ?, ?, ?, ?)',
                args: [b.id || Date.now(), b.src || '', b.link || '', b.duration || 5, b.group || 1, b.date || new Date().toISOString()]
            });
        }

        // Migrate pricing
        for (const p of (jsonData.pricing || [])) {
            await tx.execute({
                sql: 'INSERT OR IGNORE INTO pricing (service, price) VALUES (?, ?)',
                args: [p.service, p.price]
            });
        }

        // Migrate orders (complex - extras go to JSON)
        for (const o of (jsonData.orders || [])) {
            const extras = { ...o };
            delete extras.id; delete extras.trackingCode; delete extras.username;
            delete extras.status; delete extras.cost; delete extras.proposedPrice;
            delete extras.adminProposedPrice; delete extras.priceStatus;
            delete extras.paid; delete extras.paymentStatus; delete extras.result;
            delete extras.result_at; delete extras.confirmed_at;
            delete extras.created_at; delete extras.updated_at;

            await tx.execute({
                sql: `INSERT OR IGNORE INTO orders
                    (trackingCode, username, status, cost, proposedPrice, adminProposedPrice,
                     priceStatus, paid, paymentStatus, result, result_at, confirmed_at,
                     created_at, updated_at, extras)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    o.trackingCode, o.username || null, o.status || 'new',
                    o.cost || null, o.proposedPrice || null, o.adminProposedPrice || null,
                    o.priceStatus || null, o.paid ? 1 : 0, o.paymentStatus || null,
                    o.result || null, o.result_at || null, o.confirmed_at || null,
                    o.created_at ? new Date(o.created_at).toISOString() : null,
                    o.updated_at ? new Date(o.updated_at).toISOString() : null,
                    JSON.stringify(extras)
                ]
            });
        }

        // Migrate chat
        for (const m of (jsonData.chat || [])) {
            await tx.execute({
                sql: `INSERT OR IGNORE INTO chat (id, role, username, text, timestamp, conversationId, attachments)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    m.id, m.role, m.username || null, m.text,
                    m.timestamp, m.conversationId || null,
                    JSON.stringify(m.attachments || [])
                ]
            });
        }

        // Migrate chatMeta
        const chatMeta = jsonData.chatMeta || {};
        for (const key of Object.keys(chatMeta)) {
            await tx.execute({
                sql: 'INSERT OR REPLACE INTO chat_meta (key, value) VALUES (?, ?)',
                args: [key, typeof chatMeta[key] === 'string' ? chatMeta[key] : JSON.stringify(chatMeta[key])]
            });
        }

        // Migrate visits
        for (const [date, count] of Object.entries(jsonData.visits || {})) {
            await tx.execute({
                sql: 'INSERT OR REPLACE INTO visits (date, count) VALUES (?, ?)',
                args: [date, count]
            });
        }

        // Migrate chatConversations
        for (const c of (jsonData.chatConversations || [])) {
            await tx.execute({
                sql: 'INSERT OR IGNORE INTO chat_conversations (id, username, createdAt, status) VALUES (?, ?, ?, ?)',
                args: [c.id, c.username, c.createdAt, c.status || 'open']
            });
        }

        await tx.commit();
    } catch (e) {
        await tx.rollback();
        console.error('Migration failed:', e.message);
        throw e;
    }
}

// ==================== USERS ====================
async function getUser(username) {
    const r = await client.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
    if (r.rows.length === 0) return null;
    const row = r.rows[0];
    return { username: row.username, password: row.password, isAdmin: !!row.isAdmin };
}

async function getAdminUser(username) {
    const r = await client.execute({ sql: 'SELECT * FROM users WHERE username = ? AND isAdmin = 1', args: [username] });
    if (r.rows.length === 0) return null;
    const row = r.rows[0];
    return { username: row.username, password: row.password, isAdmin: true };
}

async function createUser(username, password, isAdmin = false) {
    await client.execute({
        sql: 'INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)',
        args: [username, password, isAdmin ? 1 : 0]
    });
}

async function updateUserPassword(username, newPassword) {
    await client.execute({ sql: 'UPDATE users SET password = ? WHERE username = ?', args: [newPassword, username] });
}

async function setAdminUser(username, isAdmin) {
    await client.execute({ sql: 'UPDATE users SET isAdmin = ? WHERE username = ?', args: [isAdmin ? 1 : 0, username] });
}

async function hasUsers() {
    const r = await client.execute('SELECT COUNT(*) as cnt FROM users');
    return r.rows[0].cnt > 0;
}

async function getUserWithPassword(username) {
    const r = await client.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
    if (r.rows.length === 0) return null;
    return r.rows[0];
}

// ==================== ORDERS ====================
const ORDER_FIELDS = ['trackingCode', 'username', 'status', 'cost', 'proposedPrice', 'adminProposedPrice', 'priceStatus', 'paid', 'paymentStatus', 'result', 'result_at', 'confirmed_at', 'created_at', 'updated_at'];

function rowToOrder(row) {
    const order = {};
    for (const f of ORDER_FIELDS) {
        order[f] = row[f];
    }
    order.paid = !!order.paid;
    let extras = {};
    try { extras = JSON.parse(row.extras || '{}'); } catch (_) {}
    // Also parse nested JSON fields in extras
    if (extras.attachments && typeof extras.attachments === 'string') {
        try { extras.attachments = JSON.parse(extras.attachments); } catch (_) {}
    }
    return { ...extras, ...order };
}

async function getOrder(trackingCode) {
    const r = await client.execute({ sql: 'SELECT * FROM orders WHERE trackingCode = ?', args: [trackingCode] });
    if (r.rows.length === 0) return null;
    return rowToOrder(r.rows[0]);
}

async function createOrder(data) {
    const extras = { ...data };
    const sqlData = {};
    for (const f of ORDER_FIELDS) {
        if (extras[f] !== undefined) {
            sqlData[f] = extras[f];
            delete extras[f];
        }
    }
    delete extras.id;

    // Store complex fields in extras
    if (data.attachments) extras.attachments = data.attachments;
    if (data.title) extras.title = data.title;
    if (data.description) extras.description = data.description;

    await client.execute({
        sql: `INSERT INTO orders
            (trackingCode, username, status, cost, proposedPrice, adminProposedPrice,
             priceStatus, paid, paymentStatus, result, result_at, confirmed_at,
             created_at, updated_at, extras)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
            sqlData.trackingCode, sqlData.username || null, sqlData.status || 'new',
            sqlData.cost || null, sqlData.proposedPrice || null, sqlData.adminProposedPrice || null,
            sqlData.priceStatus || null, sqlData.paid ? 1 : 0, sqlData.paymentStatus || null,
            sqlData.result || null, sqlData.result_at || null, sqlData.confirmed_at || null,
            sqlData.created_at ? new Date(sqlData.created_at).toISOString() : new Date().toISOString(),
            sqlData.updated_at ? new Date(sqlData.updated_at).toISOString() : null,
            JSON.stringify(extras)
        ]
    });
}

async function updateOrder(trackingCode, updates) {
    // Read current order first (needed for extras merge)
    const existing = await client.execute({ sql: 'SELECT * FROM orders WHERE trackingCode = ?', args: [trackingCode] });
    if (existing.rows.length === 0) return false;
    const current = rowToOrder(existing.rows[0]);

    const merged = { ...current, ...updates };

    const sqlUpdates = {};
    const extras = { ...merged };
    for (const f of ORDER_FIELDS) {
        if (extras[f] !== undefined) {
            sqlUpdates[f] = extras[f];
            delete extras[f];
        }
    }
    delete extras.id;

    await client.execute({
        sql: `UPDATE orders SET
            username = ?, status = ?, cost = ?, proposedPrice = ?, adminProposedPrice = ?,
            priceStatus = ?, paid = ?, paymentStatus = ?, result = ?, result_at = ?,
            confirmed_at = ?, created_at = ?, updated_at = ?, extras = ?
            WHERE trackingCode = ?`,
        args: [
            sqlUpdates.username || null, sqlUpdates.status || 'new',
            sqlUpdates.cost || null, sqlUpdates.proposedPrice || null, sqlUpdates.adminProposedPrice || null,
            sqlUpdates.priceStatus || null, sqlUpdates.paid ? 1 : 0, sqlUpdates.paymentStatus || null,
            sqlUpdates.result || null, sqlUpdates.result_at || null, sqlUpdates.confirmed_at || null,
            sqlUpdates.created_at || null, new Date().toISOString(),
            JSON.stringify(extras),
            trackingCode
        ]
    });
    return true;
}

async function getAllOrders(status, limit, offset) {
    let sql = 'SELECT * FROM orders';
    const args = [];
    if (status) {
        sql += ' WHERE status = ?';
        args.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    if (limit) {
        sql += ' LIMIT ?';
        args.push(limit);
        if (offset) {
            sql += ' OFFSET ?';
            args.push(offset);
        }
    }
    const r = await client.execute({ sql, args });
    return r.rows.map(rowToOrder);
}

async function getUserOrders(username, status, limit, offset) {
    let sql = 'SELECT * FROM orders WHERE username = ?';
    const args = [username];
    if (status) {
        sql += ' AND status = ?';
        args.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    if (limit) {
        sql += ' LIMIT ?';
        args.push(limit);
        if (offset) {
            sql += ' OFFSET ?';
            args.push(offset);
        }
    }
    const r = await client.execute({ sql, args });
    return r.rows.map(rowToOrder);
}

async function getCompletedOrders() {
    const r = await client.execute("SELECT * FROM orders WHERE status = 'completed'");
    return r.rows.map(rowToOrder);
}

async function getCustomerStats() {
    const r = await client.execute(`
        SELECT username,
               COUNT(*) as totalOrders,
               SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) as paidOrders
        FROM orders
        WHERE status = 'completed' AND username IS NOT NULL
        GROUP BY username
    `);
    return r.rows;
}

async function getLatestCustomerMessages() {
    const r = await client.execute(`
        SELECT c.username, c.text, c.timestamp
        FROM chat c
        INNER JOIN (
            SELECT username, MAX(timestamp) as maxTs
            FROM chat
            WHERE role = 'customer'
            GROUP BY username
        ) latest ON c.username = latest.username AND c.timestamp = latest.maxTs
        WHERE c.role = 'customer'
    `);
    return r.rows;
}

async function getCustomerOrderDetails(username) {
    const r = await client.execute({
        sql: `SELECT trackingCode, title, created_at, result, paid, adminProposedPrice, proposedPrice, cost
              FROM orders
              WHERE status = 'completed' AND username = ?
              ORDER BY created_at DESC`,
        args: [username]
    });
    return r.rows;
}

// ==================== BANNERS ====================
function rowToBanner(row) {
    return {
        id: row.id,
        src: row.src,
        link: row.link || '',
        duration: row.duration || 5,
        group: row.grp || 1,
        date: row.date
    };
}

async function getBanners(group) {
    let sql, args = [];
    if (group) {
        sql = 'SELECT * FROM banners WHERE grp = ? ORDER BY id ASC';
        args = [parseInt(group) || 1];
    } else {
        sql = 'SELECT * FROM banners ORDER BY id ASC';
    }
    const r = await client.execute({ sql, args });
    return r.rows.map(rowToBanner);
}

async function getBannerCount(group) {
    const r = await client.execute({ sql: 'SELECT COUNT(*) as cnt FROM banners WHERE grp = ?', args: [group || 1] });
    return r.rows[0].cnt;
}

async function createBanner(id, src, link, duration, group, date) {
    await client.execute({
        sql: 'INSERT INTO banners (id, src, link, duration, grp, date) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, src, link || '', duration || 5, group || 1, date || new Date().toISOString()]
    });
}

async function updateBanner(id, src, link, duration, group) {
    await client.execute({
        sql: 'UPDATE banners SET src = ?, link = ?, duration = ?, grp = ? WHERE id = ?',
        args: [src, link || '', duration || 5, group || 1, id]
    });
}

async function deleteBanner(id) {
    await client.execute({ sql: 'DELETE FROM banners WHERE id = ?', args: [id] });
}

async function getBannerById(id) {
    const r = await client.execute({ sql: 'SELECT * FROM banners WHERE id = ?', args: [id] });
    if (r.rows.length === 0) return null;
    return rowToBanner(r.rows[0]);
}

// ==================== CHAT ====================
function rowToMessage(row) {
    let attachments = [];
    try { attachments = JSON.parse(row.attachments || '[]'); } catch (_) {}
    return {
        id: row.id,
        role: row.role,
        username: row.username || null,
        text: row.text,
        timestamp: row.timestamp,
        conversationId: row.conversationId || null,
        attachments
    };
}

async function getChatMessages(username, limit) {
    if (username) {
        let sql = `SELECT * FROM chat WHERE (role = 'customer' AND username = ?) OR (role = 'admin' AND (conversationId IN (SELECT conversationId FROM chat WHERE username = ? AND conversationId IS NOT NULL) OR (username = ? AND conversationId IS NULL))) ORDER BY timestamp ASC`;
        const args = [username, username, username];
        if (limit) {
            sql += ' LIMIT ?';
            args.push(limit);
        }
        const r = await client.execute({ sql, args });
        return r.rows.map(rowToMessage);
    }
    let sql = "SELECT * FROM chat WHERE role = 'customer' ORDER BY timestamp DESC";
    const args = [];
    if (limit) {
        sql += ' LIMIT ?';
        args.push(limit);
    }
    const r = await client.execute({ sql, args });
    return r.rows.map(rowToMessage).reverse();
}

async function getChatMessagesForConversation(conversationId) {
    const r = await client.execute({
        sql: 'SELECT * FROM chat WHERE conversationId = ? ORDER BY timestamp ASC',
        args: [conversationId]
    });
    return r.rows.map(rowToMessage);
}

async function addChatMessage(data) {
    await client.execute({
        sql: `INSERT INTO chat (id, role, username, text, timestamp, conversationId, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
            data.id, data.role, data.username || null, data.text,
            data.timestamp, data.conversationId || null,
            JSON.stringify(data.attachments || [])
        ]
    });
    return data;
}

async function getAdminChatData() {
    const r = await client.execute({ sql: 'SELECT * FROM chat ORDER BY timestamp DESC LIMIT 500' });
    const messages = r.rows.map(rowToMessage).reverse();
    const metaR = await client.execute({ sql: "SELECT value FROM chat_meta WHERE key = 'lastReadAt'" });
    const lastReadAt = metaR.rows.length > 0 ? metaR.rows[0].value : null;
    return { messages, lastReadAt };
}

async function setChatMeta(key, value) {
    await client.execute({
        sql: 'INSERT OR REPLACE INTO chat_meta (key, value) VALUES (?, ?)',
        args: [key, value]
    });
}

async function getChatMeta(key) {
    const r = await client.execute({ sql: 'SELECT value FROM chat_meta WHERE key = ?', args: [key] });
    return r.rows.length > 0 ? r.rows[0].value : null;
}

async function getAllChatMessages(limit) {
    let sql = 'SELECT * FROM chat ORDER BY timestamp DESC';
    const args = [];
    if (limit) {
        sql += ' LIMIT ?';
        args.push(limit);
    }
    const r = await client.execute({ sql, args });
    return r.rows.map(rowToMessage).reverse();
}

// ==================== CHAT CONVERSATIONS ====================
function rowToConversation(row) {
    return {
        id: row.id,
        username: row.username,
        createdAt: row.createdAt,
        status: row.status || 'open'
    };
}

async function createConversation(username) {
    const id = 'conv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const conv = {
        id,
        username: username || 'مهمان',
        createdAt: new Date().toISOString(),
        status: 'open'
    };
    await client.execute({
        sql: 'INSERT INTO chat_conversations (id, username, createdAt, status) VALUES (?, ?, ?, ?)',
        args: [conv.id, conv.username, conv.createdAt, conv.status]
    });
    return conv;
}

async function getConversation(id) {
    const r = await client.execute({ sql: 'SELECT * FROM chat_conversations WHERE id = ?', args: [id] });
    if (r.rows.length === 0) return null;
    return rowToConversation(r.rows[0]);
}

async function getUserConversations(username) {
    const r = await client.execute({
        sql: 'SELECT * FROM chat_conversations WHERE username = ? ORDER BY createdAt DESC',
        args: [username]
    });
    return r.rows.map(rowToConversation);
}

// ==================== VISITS ====================
async function trackVisit(date) {
    await client.execute({
        sql: 'INSERT INTO visits (date, count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1',
        args: [date]
    });
}

async function getVisitCount(date) {
    const r = await client.execute({ sql: 'SELECT count FROM visits WHERE date = ?', args: [date] });
    return r.rows.length > 0 ? r.rows[0].count : 0;
}

async function getAllVisits() {
    const r = await client.execute('SELECT * FROM visits');
    const visits = {};
    for (const row of r.rows) {
        visits[row.date] = row.count;
    }
    return visits;
}

// ==================== PRICING ====================
async function getPricing() {
    const r = await client.execute('SELECT * FROM pricing');
    return r.rows.map(row => ({ service: row.service, price: row.price !== null && row.price !== '' ? Number(row.price) : null }));
}

async function upsertPricing(service, price) {
    await client.execute({
        sql: 'INSERT INTO pricing (service, price) VALUES (?, ?) ON CONFLICT(service) DO UPDATE SET price = ?',
        args: [service, price, price]
    });
}

// ==================== EXPORTS ====================
module.exports = {
    initDB,
    migrateFromJSON,
    getUser,
    getAdminUser,
    getUserWithPassword,
    createUser,
    updateUserPassword,
    setAdminUser,
    hasUsers,
    getOrder,
    createOrder,
    updateOrder,
    getAllOrders,
    getUserOrders,
    getCompletedOrders,
    getCustomerStats,
    getLatestCustomerMessages,
    getCustomerOrderDetails,
    getBanners,
    getBannerCount,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner,
    getChatMessages,
    getChatMessagesForConversation,
    addChatMessage,
    getAdminChatData,
    setChatMeta,
    getChatMeta,
    getAllChatMessages,
    createConversation,
    getConversation,
    getUserConversations,
    trackVisit,
    getVisitCount,
    getAllVisits,
    getPricing,
    upsertPricing,
    getClient: () => client,
};
