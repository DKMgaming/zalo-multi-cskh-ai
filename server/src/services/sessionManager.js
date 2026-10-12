import { Zalo } from "zalo-api-final";
import { accountRepo, messageLogRepo } from "../database/db.js";
import { v4 as uuidv4 } from "uuid";
export class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.io = null;
    }
    setSocketServer(io) {
        this.io = io;
    }
    async initAll() {
        console.log("🔄 Restoring saved Zalo accounts from database...");
        const accounts = accountRepo.getAll();
        for (const account of accounts) {
            try {
                console.log(`📡 Connecting account: ${account.name || account.uid}...`);
                await this.connectAccount(account);
            }
            catch (err) {
                console.error(`❌ Failed to restore account ${account.uid}:`, (err === null || err === void 0 ? void 0 : err.message) || err);
                accountRepo.updateStatus(account.id, "ERROR", (err === null || err === void 0 ? void 0 : err.message) || "Failed to login");
            }
        }
        console.log(`✅ Restored ${this.sessions.size}/${accounts.length} active sessions.`);
    }
    async connectAccount(account) {
        // Disconnect existing session if present
        if (this.sessions.has(account.id)) {
            await this.disconnectSession(account.id);
        }
        const zalo = new Zalo({
            logging: false,
            selfListen: false,
        });
        const credentials = {
            cookie: JSON.parse(account.cookie),
            imei: account.imei,
            userAgent: account.userAgent,
            language: "vi",
        };
        const api = await zalo.login(credentials);
        // Fetch fresh profile info to update name/avatar if available
        try {
            const profile = await api.fetchAccountInfo();
            if (profile && profile.data) {
                const pData = profile.data;
                account.name = pData.display_name || account.name;
                account.avatar = pData.avatar || account.avatar;
                accountRepo.upsert({
                    id: account.id,
                    uid: account.uid,
                    name: account.name,
                    avatar: account.avatar,
                    phone: account.phone,
                    imei: account.imei,
                    userAgent: account.userAgent,
                    cookie: account.cookie,
                    status: "ONLINE",
                });
            }
        }
        catch (e) {
            // Ignore error fetching profile, continue
        }
        const session = {
            id: account.id,
            api,
            info: account,
            status: "ONLINE",
        };
        this.setupListeners(session);
        this.sessions.set(account.id, session);
        accountRepo.updateStatus(account.id, "ONLINE");
        this.broadcastAccountUpdate(session);
        return session;
    }
    addActiveSession(account, api) {
        const session = {
            id: account.id,
            api,
            info: account,
            status: "ONLINE",
        };
        this.setupListeners(session);
        this.sessions.set(account.id, session);
        accountRepo.updateStatus(account.id, "ONLINE");
        this.broadcastAccountUpdate(session);
        return session;
    }
    setupListeners(session) {
        const { api, info } = session;
        const listener = api.listener;
        listener.onConnected(() => {
            console.log(`🟢 [${info.name || info.uid}] WebSocket connected`);
            session.status = "ONLINE";
            accountRepo.updateStatus(info.id, "ONLINE");
            this.broadcastAccountUpdate(session);
        });
        listener.onClosed((reason) => {
            console.log(`🟡 [${info.name || info.uid}] WebSocket closed:`, reason);
            session.status = "OFFLINE";
            accountRepo.updateStatus(info.id, "OFFLINE");
            this.broadcastAccountUpdate(session);
        });
        listener.onError((error) => {
            console.error(`🔴 [${info.name || info.uid}] WebSocket error:`, error);
            session.status = "ERROR";
            accountRepo.updateStatus(info.id, "ERROR", String(error));
            this.broadcastAccountUpdate(session);
        });
        listener.onMessage((message) => {
            var _a, _b, _c, _d, _e;
            try {
                const threadId = String(message.threadId || "");
                const threadType = String(message.type || "User");
                const senderId = String(((_a = message.data) === null || _a === void 0 ? void 0 : _a.uidFrom) || "");
                const content = typeof ((_b = message.data) === null || _b === void 0 ? void 0 : _b.content) === "string"
                    ? message.data.content
                    : JSON.stringify(((_c = message.data) === null || _c === void 0 ? void 0 : _c.content) || "");
                const msgId = String(((_d = message.data) === null || _d === void 0 ? void 0 : _d.msgId) || "");
                const timestamp = Number(((_e = message.data) === null || _e === void 0 ? void 0 : _e.ts) || Date.now());
                const isSelf = message.isSelf ? 1 : 0;
                const logRecord = {
                    id: uuidv4(),
                    accountId: info.id,
                    threadId,
                    threadType,
                    senderId,
                    content,
                    msgId,
                    timestamp,
                    isSelf,
                };
                messageLogRepo.insert(logRecord);
                // Emit realtime message to frontend
                if (this.io) {
                    this.io.emit("zalo:message", {
                        accountId: info.id,
                        accountName: info.name,
                        message: logRecord,
                        raw: message,
                    });
                }
            }
            catch (err) {
                console.error("Error processing incoming message event:", err);
            }
        });
        // Start listening
        try {
            listener.start();
        }
        catch (e) {
            console.error(`Failed to start listener for ${info.uid}:`, e);
        }
    }
    async disconnectSession(id) {
        const session = this.sessions.get(id);
        if (session) {
            try {
                session.api.listener.stop();
            }
            catch (e) {
                // Ignore stop errors
            }
            this.sessions.delete(id);
            accountRepo.updateStatus(id, "OFFLINE");
            session.status = "OFFLINE";
            this.broadcastAccountUpdate(session);
        }
    }
    async removeAccount(id) {
        await this.disconnectSession(id);
        accountRepo.delete(id);
        if (this.io) {
            this.io.emit("account:deleted", { id });
        }
    }
    getSession(id) {
        return this.sessions.get(id);
    }
    getAllAccountStates() {
        const allDbAccounts = accountRepo.getAll();
        return allDbAccounts.map((acc) => {
            const active = this.sessions.get(acc.id);
            return Object.assign(Object.assign({}, acc), { cookie: undefined, status: active ? active.status : acc.status, isOnline: active ? active.status === "ONLINE" : false });
        });
    }
    broadcastAccountUpdate(session) {
        if (this.io) {
            this.io.emit("account:status_change", {
                id: session.id,
                uid: session.info.uid,
                name: session.info.name,
                avatar: session.info.avatar,
                status: session.status,
                isOnline: session.status === "ONLINE",
            });
        }
    }
}
export const sessionManager = new SessionManager();
