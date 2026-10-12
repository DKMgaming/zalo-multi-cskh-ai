import React from "react";
import type { Account } from "../api/client.js";
interface NavbarProps {
    accounts: Account[];
    activeTab: "accounts" | "chat" | "broadcast";
    setActiveTab: (tab: "accounts" | "chat" | "broadcast") => void;
    onOpenQR: () => void;
}
export declare const Navbar: React.FC<NavbarProps>;
export {};
