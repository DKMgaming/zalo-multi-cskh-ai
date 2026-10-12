import { type API } from "zalo-api-final";
import { type AccountRecord } from "../database/db.js";
import type { Server } from "socket.io";
export interface ActiveSession {
    id: string;
    api: API;
    info: AccountRecord;
    status: "ONLINE" | "OFFLINE" | "ERROR";
}
export declare class SessionManager {
    private sessions;
    private io;
    setSocketServer(io: Server): void;
    initAll(): Promise<void>;
    connectAccount(account: AccountRecord): Promise<ActiveSession>;
    addActiveSession(account: AccountRecord, api: API): ActiveSession;
    private setupListeners;
    disconnectSession(id: string): Promise<void>;
    removeAccount(id: string): Promise<void>;
    getSession(id: string): ActiveSession | undefined;
    getAllAccountStates(): {
        cookie: undefined;
        status: "ONLINE" | "OFFLINE" | "ERROR";
        isOnline: boolean;
        id: string;
        uid: string;
        name: string;
        avatar: string;
        phone?: string;
        imei: string;
        userAgent: string;
        lastError?: string;
        createdAt: string;
        updatedAt: string;
    }[];
    private broadcastAccountUpdate;
}
export declare const sessionManager: SessionManager;
