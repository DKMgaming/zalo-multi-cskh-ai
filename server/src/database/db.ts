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

export interface AccountRecord {
    id: string;
    uid: string;
    name: string;
    avatar: string;
    phone?: string;
    imei: string;
    userAgent: string;
    cookie: string; // JSON string
    status: "ONLINE" | "OFFLINE" | "ERROR";
    lastError?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MessageLogRecord {
    id: string;
    accountId: string;
    threadId: string;
    threadType: string;
    senderId: string;
    content: string;
    msgId?: string;
    timestamp: number;
    isSelf: number;
}

export interface AiSettingsRecord {
    id: string; // 'default'
    provider: "gemini" | "openai";
    apiKey: string;
    baseURL: string;
    model: string;
    systemPrompt: string;
    temperature: number;
    isGlobalEnabled: number;
    replyDelaySeconds: number;
    updatedAt: string;
}

export interface AccountAiConfigRecord {
    accountId: string;
    isAiEnabled: number;
    specificPrompt: string;
    replyScope: "all" | "direct_only" | "groups_only" | "direct_and_selected_groups";
    allowedGroupIds: string; // JSON array string e.g. '["group1", "group2"]'
    updatedAt: string;
}

export interface KnowledgeItemRecord {
    id: string;
    type: "faq" | "doc";
    title: string;
    content: string;
    category: string;
    keywords: string;
    enabled: number;
    createdAt: string;
    updatedAt: string;
}

export interface ConversationAiStateRecord {
    id: string; // accountId + '_' + threadId
    accountId: string;
    threadId: string;
    isHumanTakeover: number;
    takeoverReason?: string;
    updatedAt: string;
}

import bcrypt from "bcryptjs";

export interface AdminUserRecord {
    id: string;
    username: string;
    passwordHash: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

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

    // 3. AI Global Settings Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS ai_settings (
            id TEXT PRIMARY KEY,
            provider TEXT DEFAULT 'gemini',
            apiKey TEXT DEFAULT '',
            baseURL TEXT DEFAULT '',
            model TEXT DEFAULT 'gemini-1.5-flash',
            systemPrompt TEXT DEFAULT '',
            temperature REAL DEFAULT 0.7,
            isGlobalEnabled INTEGER DEFAULT 1,
            replyDelaySeconds INTEGER DEFAULT 2,
            updatedAt TEXT NOT NULL
        )
    `);

    // 4. Per-account AI Config Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS account_ai_config (
            accountId TEXT PRIMARY KEY,
            isAiEnabled INTEGER DEFAULT 0,
            specificPrompt TEXT DEFAULT '',
            replyScope TEXT DEFAULT 'all',
            allowedGroupIds TEXT DEFAULT '[]',
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
        )
    `);

    // Migration: đảm bảo các cột replyScope và allowedGroupIds tồn tại nếu đã có DB từ trước
    try {
        const columns = db.prepare("PRAGMA table_info(account_ai_config)").all() as Array<{ name: string }>;
        const colNames = columns.map((c) => c.name);
        if (!colNames.includes("replyScope")) {
            db.exec("ALTER TABLE account_ai_config ADD COLUMN replyScope TEXT DEFAULT 'all'");
        }
        if (!colNames.includes("allowedGroupIds")) {
            db.exec("ALTER TABLE account_ai_config ADD COLUMN allowedGroupIds TEXT DEFAULT '[]'");
        }
    } catch (migErr) {
        console.warn("⚠️ Migration warning on account_ai_config:", migErr);
    }

    // 5. Knowledge Base Items Table (FAQ and Docs)
    db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_items (
            id TEXT PRIMARY KEY,
            type TEXT DEFAULT 'faq',
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'Chung',
            keywords TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    `);

    // 6. Conversation AI State (Human takeover tracking)
    db.exec(`
        CREATE TABLE IF NOT EXISTS conversation_ai_state (
            id TEXT PRIMARY KEY,
            accountId TEXT NOT NULL,
            threadId TEXT NOT NULL,
            isHumanTakeover INTEGER DEFAULT 0,
            takeoverReason TEXT,
            updatedAt TEXT NOT NULL
        )
    `);

    // Ensure default AI settings row exists
    const defaultSettings = db.prepare("SELECT id FROM ai_settings WHERE id = 'default'").get();
    if (!defaultSettings) {
        const defaultPrompt = `Bạn là Trợ lý Chăm sóc Khách hàng chuyên nghiệp, tận tâm và thân thiện qua Zalo.
Quy tắc phản hồi:
1. Luôn xưng "em" và gọi khách là "anh/chị" hoặc "quý khách". Giọng điệu lịch sự, nhã nhặn, dùng các trợ từ tự nhiên như: "dạ", "ạ", "dạ vâng ạ".
2. Ưu tiên TUYỆT ĐỐI sử dụng thông tin trong mục [THÔNG TIN TRI THỨC] được cung cấp để trả lời khách.
3. Không bịa đặt thông tin sai lệch ngoài tri thức được cung cấp (về giá, bảo hành, cam kết...). Nếu thông tin chưa có, hãy khéo léo báo khách: "Dạ thông tin này em xin phép ghi nhận để chuyển cho chuyên viên tư vấn liên hệ hỗ trợ chi tiết cho anh/chị ngay ạ!".
4. Trả lời ngắn gọn, súc tích, dễ đọc trên điện thoại Zalo.`;

        db.prepare(`
            INSERT INTO ai_settings (id, provider, apiKey, baseURL, model, systemPrompt, temperature, isGlobalEnabled, replyDelaySeconds, updatedAt)
            VALUES ('default', 'gemini', '', '', 'gemini-1.5-flash', ?, 0.7, 1, 2, ?)
        `).run(defaultPrompt, new Date().toISOString());
    }

    // 7. Admin Users Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            name TEXT DEFAULT 'Quản trị viên',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    `);

    // Ensure default admin user exists (username: admin, password: admin)
    const existingAdmin = db.prepare("SELECT id FROM admin_users WHERE username = 'admin'").get();
    if (!existingAdmin) {
        const salt = bcrypt.genSaltSync(12);
        const defaultHash = bcrypt.hashSync("admin", salt);
        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO admin_users (id, username, passwordHash, name, createdAt, updatedAt)
            VALUES ('admin-default-id', 'admin', ?, 'Quản trị viên', ?, ?)
        `).run(defaultHash, now, now);
        console.log("🔒 Initialized default admin account: admin / admin");
    }

    console.log("✅ Database initialized successfully at:", dbPath);
}

export const accountRepo = {
    getAll(): AccountRecord[] {
        const stmt = db.prepare("SELECT * FROM accounts ORDER BY createdAt DESC");
        return stmt.all() as AccountRecord[];
    },

    getById(id: string): AccountRecord | undefined {
        const stmt = db.prepare("SELECT * FROM accounts WHERE id = ?");
        return stmt.get(id) as AccountRecord | undefined;
    },

    getByUid(uid: string): AccountRecord | undefined {
        const stmt = db.prepare("SELECT * FROM accounts WHERE uid = ?");
        return stmt.get(uid) as AccountRecord | undefined;
    },

    upsert(account: Omit<AccountRecord, "createdAt" | "updatedAt">): AccountRecord {
        const now = new Date().toISOString();
        const existing = accountRepo.getByUid(account.uid);

        if (existing) {
            const stmt = db.prepare(`
                UPDATE accounts 
                SET name = ?, avatar = ?, phone = ?, imei = ?, userAgent = ?, cookie = ?, status = ?, lastError = NULL, updatedAt = ?
                WHERE uid = ?
            `);
            stmt.run(
                account.name || existing.name,
                account.avatar || existing.avatar,
                account.phone || existing.phone,
                account.imei,
                account.userAgent,
                account.cookie,
                account.status,
                now,
                account.uid
            );
            return accountRepo.getByUid(account.uid)!;
        } else {
            const stmt = db.prepare(`
                INSERT INTO accounts (id, uid, name, avatar, phone, imei, userAgent, cookie, status, lastError, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                account.id,
                account.uid,
                account.name || `Zalo User (${account.uid})`,
                account.avatar || "",
                account.phone || "",
                account.imei,
                account.userAgent,
                account.cookie,
                account.status,
                null,
                now,
                now
            );
            return accountRepo.getById(account.id)!;
        }
    },

    updateStatus(id: string, status: "ONLINE" | "OFFLINE" | "ERROR", lastError?: string) {
        const now = new Date().toISOString();
        const stmt = db.prepare("UPDATE accounts SET status = ?, lastError = ?, updatedAt = ? WHERE id = ?");
        stmt.run(status, lastError || null, now, id);
    },

    delete(id: string) {
        const stmt = db.prepare("DELETE FROM accounts WHERE id = ?");
        stmt.run(id);
    }
};

export const messageLogRepo = {
    insert(msg: MessageLogRecord) {
        const stmt = db.prepare(`
            INSERT INTO messages_log (id, accountId, threadId, threadType, senderId, content, msgId, timestamp, isSelf)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            msg.id,
            msg.accountId,
            msg.threadId,
            msg.threadType,
            msg.senderId,
            msg.content,
            msg.msgId || null,
            msg.timestamp,
            msg.isSelf
        );
    },

    getRecentByThread(accountId: string, threadId: string, limit = 50): MessageLogRecord[] {
        const stmt = db.prepare(`
            SELECT * FROM messages_log 
            WHERE accountId = ? AND threadId = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        const rows = stmt.all(accountId, threadId, limit) as MessageLogRecord[];
        return rows.reverse();
    }
};

export const aiSettingsRepo = {
    get(): AiSettingsRecord {
        const row = db.prepare("SELECT * FROM ai_settings WHERE id = 'default'").get() as AiSettingsRecord;
        return row;
    },

    update(settings: Partial<AiSettingsRecord>): AiSettingsRecord {
        const current = aiSettingsRepo.get();
        const updated: AiSettingsRecord = {
            ...current,
            ...settings,
            updatedAt: new Date().toISOString(),
        };

        const stmt = db.prepare(`
            UPDATE ai_settings
            SET provider = ?, apiKey = ?, baseURL = ?, model = ?, systemPrompt = ?,
                temperature = ?, isGlobalEnabled = ?, replyDelaySeconds = ?, updatedAt = ?
            WHERE id = 'default'
        `);

        stmt.run(
            updated.provider,
            updated.apiKey,
            updated.baseURL,
            updated.model,
            updated.systemPrompt,
            updated.temperature,
            updated.isGlobalEnabled,
            updated.replyDelaySeconds,
            updated.updatedAt
        );

        return updated;
    }
};

export const accountAiConfigRepo = {
    get(accountId: string): AccountAiConfigRecord {
        const row = db.prepare("SELECT * FROM account_ai_config WHERE accountId = ?").get(accountId) as any;
        if (row) {
            return {
                accountId: row.accountId,
                isAiEnabled: row.isAiEnabled ?? 0,
                specificPrompt: row.specificPrompt || "",
                replyScope: row.replyScope || "all",
                allowedGroupIds: row.allowedGroupIds || "[]",
                updatedAt: row.updatedAt || new Date().toISOString(),
            };
        }
        return {
            accountId,
            isAiEnabled: 0,
            specificPrompt: "",
            replyScope: "all",
            allowedGroupIds: "[]",
            updatedAt: new Date().toISOString(),
        };
    },

    getAll(): AccountAiConfigRecord[] {
        const rows = db.prepare("SELECT * FROM account_ai_config").all() as any[];
        return rows.map((row) => ({
            accountId: row.accountId,
            isAiEnabled: row.isAiEnabled ?? 0,
            specificPrompt: row.specificPrompt || "",
            replyScope: row.replyScope || "all",
            allowedGroupIds: row.allowedGroupIds || "[]",
            updatedAt: row.updatedAt || new Date().toISOString(),
        }));
    },

    upsert(
        accountId: string,
        isAiEnabled: number,
        specificPrompt = "",
        replyScope: "all" | "direct_only" | "groups_only" | "direct_and_selected_groups" = "all",
        allowedGroupIds = "[]"
    ): AccountAiConfigRecord {
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO account_ai_config (accountId, isAiEnabled, specificPrompt, replyScope, allowedGroupIds, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(accountId) DO UPDATE SET
                isAiEnabled = excluded.isAiEnabled,
                specificPrompt = excluded.specificPrompt,
                replyScope = excluded.replyScope,
                allowedGroupIds = excluded.allowedGroupIds,
                updatedAt = excluded.updatedAt
        `);
        stmt.run(accountId, isAiEnabled, specificPrompt, replyScope, allowedGroupIds, now);
        return { accountId, isAiEnabled, specificPrompt, replyScope, allowedGroupIds, updatedAt: now };
    },
};

export const knowledgeRepo = {
    getAll(): KnowledgeItemRecord[] {
        return db.prepare("SELECT * FROM knowledge_items ORDER BY createdAt DESC").all() as KnowledgeItemRecord[];
    },

    getActive(): KnowledgeItemRecord[] {
        return db.prepare("SELECT * FROM knowledge_items WHERE enabled = 1 ORDER BY createdAt DESC").all() as KnowledgeItemRecord[];
    },

    getById(id: string): KnowledgeItemRecord | undefined {
        return db.prepare("SELECT * FROM knowledge_items WHERE id = ?").get(id) as KnowledgeItemRecord | undefined;
    },

    create(item: Omit<KnowledgeItemRecord, "createdAt" | "updatedAt">): KnowledgeItemRecord {
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO knowledge_items (id, type, title, content, category, keywords, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            item.id,
            item.type || "faq",
            item.title,
            item.content,
            item.category || "Chung",
            item.keywords || "",
            item.enabled ?? 1,
            now,
            now
        );
        return { ...item, createdAt: now, updatedAt: now };
    },

    update(id: string, updates: Partial<KnowledgeItemRecord>): KnowledgeItemRecord | undefined {
        const current = knowledgeRepo.getById(id);
        if (!current) return undefined;

        const now = new Date().toISOString();
        const updated = { ...current, ...updates, updatedAt: now };

        const stmt = db.prepare(`
            UPDATE knowledge_items
            SET type = ?, title = ?, content = ?, category = ?, keywords = ?, enabled = ?, updatedAt = ?
            WHERE id = ?
        `);
        stmt.run(
            updated.type,
            updated.title,
            updated.content,
            updated.category,
            updated.keywords,
            updated.enabled,
            now,
            id
        );
        return updated;
    },

    delete(id: string) {
        db.prepare("DELETE FROM knowledge_items WHERE id = ?").run(id);
    },

    deleteByCategory(category: string): number {
        const res = db.prepare("DELETE FROM knowledge_items WHERE category = ?").run(category);
        return res.changes;
    },

    getCategories(): string[] {
        const rows = db.prepare("SELECT DISTINCT category FROM knowledge_items WHERE category IS NOT NULL AND category != ''").all() as { category: string }[];
        return rows.map((r) => r.category);
    }
};

export const conversationAiStateRepo = {
    get(accountId: string, threadId: string): ConversationAiStateRecord {
        const id = `${accountId}_${threadId}`;
        const row = db.prepare("SELECT * FROM conversation_ai_state WHERE id = ?").get(id) as ConversationAiStateRecord | undefined;
        if (row) return row;
        return {
            id,
            accountId,
            threadId,
            isHumanTakeover: 0,
            updatedAt: new Date().toISOString()
        };
    },

    setTakeover(accountId: string, threadId: string, isHumanTakeover: number, takeoverReason = ""): ConversationAiStateRecord {
        const id = `${accountId}_${threadId}`;
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO conversation_ai_state (id, accountId, threadId, isHumanTakeover, takeoverReason, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                isHumanTakeover = excluded.isHumanTakeover,
                takeoverReason = excluded.takeoverReason,
                updatedAt = excluded.updatedAt
        `);
        stmt.run(id, accountId, threadId, isHumanTakeover, takeoverReason, now);
        return { id, accountId, threadId, isHumanTakeover, takeoverReason, updatedAt: now };
    }
};

export const adminUserRepo = {
    getByUsername(username: string): AdminUserRecord | undefined {
        const stmt = db.prepare("SELECT * FROM admin_users WHERE username = ?");
        return stmt.get(username) as AdminUserRecord | undefined;
    },

    getById(id: string): AdminUserRecord | undefined {
        const stmt = db.prepare("SELECT * FROM admin_users WHERE id = ?");
        return stmt.get(id) as AdminUserRecord | undefined;
    },

    updatePassword(id: string, newPasswordHash: string): void {
        const stmt = db.prepare(`
            UPDATE admin_users
            SET passwordHash = ?, updatedAt = ?
            WHERE id = ?
        `);
        stmt.run(newPasswordHash, new Date().toISOString(), id);
    },

    updateProfile(id: string, name: string): void {
        const stmt = db.prepare(`
            UPDATE admin_users
            SET name = ?, updatedAt = ?
            WHERE id = ?
        `);
        stmt.run(name, new Date().toISOString(), id);
    }
};
