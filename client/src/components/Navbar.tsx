import React, { useState } from "react";
import { Users, MessageSquare, Send, PlusCircle, Radio, Bot, LogOut, KeyRound, ChevronDown } from "lucide-react";
import type { Account, AuthUser } from "../api/client.js";

interface NavbarProps {
  accounts: Account[];
  activeTab: "accounts" | "chat" | "broadcast" | "ai";
  setActiveTab: (tab: "accounts" | "chat" | "broadcast" | "ai") => void;
  onOpenQR: () => void;
  currentUser?: AuthUser | null;
  onChangePassword: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  accounts,
  activeTab,
  setActiveTab,
  onOpenQR,
  currentUser,
  onChangePassword,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const onlineCount = accounts.filter((a) => a.isOnline).length;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-xl tracking-tight">
              Z
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">
                  Zalo Multi-Account
                </span>
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  AI CSKH
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Hệ thống Quản lý & Tự động hóa Đa tài khoản Zalo
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("accounts")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "accounts"
                  ? "bg-white text-blue-600 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Tài khoản ({accounts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "chat"
                  ? "bg-white text-blue-600 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Nhắn tin</span>
            </button>

            <button
              onClick={() => setActiveTab("broadcast")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "broadcast"
                  ? "bg-white text-blue-600 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Gửi hàng loạt</span>
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "ai"
                  ? "bg-white text-indigo-600 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Bot className="w-4 h-4 text-indigo-500" />
              <span>AI Chăm sóc KH</span>
            </button>
          </nav>

          {/* Right Action: Online Status & Add Account */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  onlineCount > 0
                    ? "text-emerald-500 animate-pulse"
                    : "text-slate-400"
                }`}
              />
              <span className="text-slate-600">
                Online: <strong className="text-slate-900">{onlineCount}</strong> / {accounts.length}
              </span>
            </div>

            <button
              onClick={onOpenQR}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold shadow-sm shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm tài khoản</span>
            </button>

            {/* Admin User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 pl-2 pr-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-700"
              >
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  {currentUser?.name?.[0] || "A"}
                </div>
                <span className="font-semibold text-slate-800 max-w-[90px] truncate">
                  {currentUser?.name || currentUser?.username || "Admin"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="font-bold text-slate-800">{currentUser?.name || "Quản trị viên"}</p>
                      <p className="text-slate-500 font-mono text-[11px]">@{currentUser?.username || "admin"}</p>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onChangePassword();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      <span>Đổi mật khẩu</span>
                    </button>

                    <div className="border-t border-slate-100 my-1"></div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
