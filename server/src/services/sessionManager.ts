import { Zalo, type API } from "zalo-api-final";
import { accountRepo, messageLogRepo, type AccountRecord } from "../database/db.js";
import { aiAgentService } from "./aiAgentService.js";
import { v4 as uuidv4 } from "uuid";
import type { Server } from "socket.io";

export interface ActiveSession {
    id: string;
    api: API;
    info: AccountRecord;
    status: "ONLINE" | "OFFLINE" | "ERROR";
}

export class SessionManager {
    private sessions: Map<string, ActiveSession> = new Map();
    private io: Server | null = null;

    public setSocketServer(io: Server) {
        this.io = io;
        aiAgentService.setSocketServer(io);
    }

    public async initAll() {
        console.log("🔄 Restoring saved Zalo accounts from database...");
        const accounts = accountRepo.getAll();

        for (const account of accounts) {
            try {
                console.log(`📡 Connecting account: ${account.name || account.uid}...`);
                await this.connectAccount(account);
            } catch (err: any) {
                console.error(`❌ Failed to restore account ${account.uid}:`, err?.message || err);
                accountRepo.updateStatus(account.id, "ERROR", err?.message || "Failed to login");
            }
        }
        console.log(`✅ Restored ${this.sessions.size}/${accounts.length} active sessions.`);
    }

    public async connectAccount(account: AccountRecord): Promise<ActiveSession> {
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
            if (profile && (profile as any).data) {
                const pData = (profile as any).data;
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
        } catch (e) {
            // Ignore error fetching profile, continue
        }

        const session: ActiveSession = {
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

    public addActiveSession(account: AccountRecord, api: API): ActiveSession {
        const session: ActiveSession = {
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

    private setupListeners(session: ActiveSession) {
        const { api, info } = session;
        const listener = api.listener;

        listener.onConnected(() => {
            console.log(`🟢 [${info.name || info.uid}] WebSocket connected`);
            session.status = "ONLINE";
            accountRepo.updateStatus(info.id, "ONLINE");
            this.broadcastAccountUpdate(session);
        });

        listener.onClosed((reason: any) => {
            console.log(`🟡 [${info.name || info.uid}] WebSocket closed:`, reason);
            session.status = "OFFLINE";
            accountRepo.updateStatus(info.id, "OFFLINE");
            this.broadcastAccountUpdate(session);
        });

        listener.onError((error: any) => {
            console.error(`🔴 [${info.name || info.uid}] WebSocket error:`, error);
            session.status = "ERROR";
            accountRepo.updateStatus(info.id, "ERROR", String(error));
            this.broadcastAccountUpdate(session);
        });

        listener.onMessage((message: any) => {
            try {
                const threadId = String(message.threadId || "");
                const isGroup = message.type === 1 || message.type === "Group" || message.type === "1";
                const threadType = isGroup ? "Group" : "User";
                const senderId = String(message.data?.uidFrom || "");
                const content = typeof message.data?.content === "string" 
                    ? message.data.content 
                    : JSON.stringify(message.data?.content || "");
                const msgId = String(message.data?.msgId || "");
                const timestamp = Number(message.data?.ts || Date.now());
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

                // Xử lý AI Agent tự động phản hồi khách hàng (nếu được kích hoạt)
                if (!message.isSelf) {
                    aiAgentService.handleIncomingMessage(session, message).catch((aiErr) => {
                        console.error(`[AI CSKH] Lỗi xử lý tin nhắn thread ${threadId}:`, aiErr);
                    });
                }
            } catch (err) {
                console.error("Error processing incoming message event:", err);
            }
        });

        // Start listening
        try {
            listener.start();
        } catch (e) {
            console.error(`Failed to start listener for ${info.uid}:`, e);
        }
    }

    public async disconnectSession(id: string) {
        const session = this.sessions.get(id);
        if (session) {
            try {
                session.api.listener.stop();
            } catch (e) {
                // Ignore stop errors
            }
            this.sessions.delete(id);
            accountRepo.updateStatus(id, "OFFLINE");
            session.status = "OFFLINE";
            this.broadcastAccountUpdate(session);
        }
    }

    public async removeAccount(id: string) {
        await this.disconnectSession(id);
        accountRepo.delete(id);
        if (this.io) {
            this.io.emit("account:deleted", { id });
        }
    }

    public getSession(id: string): ActiveSession | undefined {
        return this.sessions.get(id);
    }

    public getAllAccountStates() {
        const allDbAccounts = accountRepo.getAll();
        return allDbAccounts.map((acc) => {
            const active = this.sessions.get(acc.id);
            return {
                ...acc,
                cookie: undefined, // Don't expose cookie raw string to frontend
                status: active ? active.status : acc.status,
                isOnline: active ? active.status === "ONLINE" : false,
            };
        });
    }

    private broadcastAccountUpdate(session: ActiveSession) {
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
