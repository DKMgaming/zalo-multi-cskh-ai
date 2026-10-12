export declare const api: import("axios").AxiosInstance;
export interface Account {
    id: string;
    uid: string;
    name: string;
    avatar: string;
    phone?: string;
    status: "ONLINE" | "OFFLINE" | "ERROR";
    isOnline: boolean;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Friend {
    userId: string;
    displayName: string;
    avatar: string;
    phoneNumber?: string;
}
export interface Group {
    groupId: string;
    groupName: string;
    avatar: string;
    totalMember: number;
}
export interface ChatMessage {
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
export declare const accountsApi: {
    getAll: () => Promise<Account[]>;
    reconnect: (id: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
    getFriends: (id: string) => Promise<any>;
    getGroups: (id: string) => Promise<any>;
    getHistory: (id: string, threadId: string) => Promise<ChatMessage[]>;
    sendMessage: (id: string, toId: string, message: string, type?: "User" | "Group") => Promise<any>;
    broadcast: (accountIds: string[], recipients: any[], message: string, delayMs?: number) => Promise<any>;
};
