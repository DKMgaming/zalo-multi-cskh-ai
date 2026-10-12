import React from "react";
import type { Account } from "../api/client.js";
interface AccountCardProps {
    account: Account;
    onSelectChat: (accountId: string) => void;
    onReconnect: (accountId: string) => Promise<void>;
    onDelete: (accountId: string) => Promise<void>;
}
export declare const AccountCard: React.FC<AccountCardProps>;
export {};
