import React from "react";
import type { Account } from "../api/client.js";
interface AccountsPageProps {
    accounts: Account[];
    onOpenQR: () => void;
    onSelectChat: (accountId: string) => void;
    onReconnect: (accountId: string) => Promise<void>;
    onDelete: (accountId: string) => Promise<void>;
}
export declare const AccountsPage: React.FC<AccountsPageProps>;
export {};
