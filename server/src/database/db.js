import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "zalo_manager.db");
export const db = new Database(dbPath);
// Enable WAL mode for concurrent access and performance
db.pragma("journal_mode = WAL");
export function initDatabase() {
    // 1. Accounts Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            uid TEXT UNIQUE NOT NULL,
            name TEXT,
            avatar TEXT,
            phone TEXT,
            imei TEXT NOT NULL,
            userAgent TEXT NOT NULL,
            cookie TEXT NOT NULL,
            status TEXT DEFAULT 'OFFLINE',
            lastError TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    `);
    // 2. Message logs Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages_log (
            id TEXT PRIMARY KEY,
            accountId TEXT NOT NULL,
            threadId TEXT NOT NULL,
            threadType TEXT NOT NULL,
            senderId TEXT NOT NULL,
            content TEXT,
            msgId TEXT,
            timestamp INTEGER NOT NULL,
            isSelf INTEGER DEFAULT 0,
            FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
        )
    `);
    console.log("✅ Database initialized successfully at:", dbPath);
}
export const accountRepo = {
    getAll() {
        const stmt = db.prepare("SELECT * FROM accounts ORDER BY createdAt DESC");
        return stmt.all();
    },
    getById(id) {
        const stmt = db.prepare("SELECT * FROM accounts WHERE id = ?");
        return stmt.get(id);
    },
    getByUid(uid) {
        const stmt = db.prepare("SELECT * FROM accounts WHERE uid = ?");
        return stmt.get(uid);
    },
    upsert(account) {
        const now = new Date().toISOString();
        const existing = accountRepo.getByUid(account.uid);
        if (existing) {
            const stmt = db.prepare(`
                UPDATE accounts 
                SET name = ?, avatar = ?, phone = ?, imei = ?, userAgent = ?, cookie = ?, status = ?, lastError = NULL, updatedAt = ?
                WHERE uid = ?
            `);
            stmt.run(account.name || existing.name, account.avatar || existing.avatar, account.phone || existing.phone, account.imei, account.userAgent, account.cookie, account.status, now, account.uid);
            return accountRepo.getByUid(account.uid);
        }
        else {
            const stmt = db.prepare(`
                INSERT INTO accounts (id, uid, name, avatar, phone, imei, userAgent, cookie, status, lastError, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(account.id, account.uid, account.name || `Zalo User (${account.uid})`, account.avatar || "", account.phone || "", account.imei, account.userAgent, account.cookie, account.status, null, now, now);
            return accountRepo.getById(account.id);
        }
    },
    updateStatus(id, status, lastError) {
        const now = new Date().toISOString();
        const stmt = db.prepare("UPDATE accounts SET status = ?, lastError = ?, updatedAt = ? WHERE id = ?");
        stmt.run(status, lastError || null, now, id);
    },
    delete(id) {
        const stmt = db.prepare("DELETE FROM accounts WHERE id = ?");
        stmt.run(id);
    }
};
export const messageLogRepo = {
    insert(msg) {
        const stmt = db.prepare(`
            INSERT INTO messages_log (id, accountId, threadId, threadType, senderId, content, msgId, timestamp, isSelf)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(msg.id, msg.accountId, msg.threadId, msg.threadType, msg.senderId, msg.content, msg.msgId || null, msg.timestamp, msg.isSelf);
    },
    getRecentByThread(accountId, threadId, limit = 50) {
        const stmt = db.prepare(`
            SELECT * FROM messages_log 
            WHERE accountId = ? AND threadId = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        const rows = stmt.all(accountId, threadId, limit);
        return rows.reverse();
    }
};
