import React from "react";
import { type Account } from "../api/client.js";
import type { Socket } from "socket.io-client";
interface ChatPageProps {
    accounts: Account[];
    selectedAccountId: string | null;
    setSelectedAccountId: (id: string) => void;
    socket: Socket | null;
}
export declare const ChatPage: React.FC<ChatPageProps>;
export {};
