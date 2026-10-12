import React from "react";
import { Plus, Users, ShieldAlert, Sparkles } from "lucide-react";
import { AccountCard } from "../components/AccountCard.js";
import type { Account } from "../api/client.js";

interface AccountsPageProps {
  accounts: Account[];
  onOpenQR: () => void;
  onSelectChat: (accountId: string) => void;
  onReconnect: (accountId: string) => Promise<void>;
  onDelete: (accountId: string) => Promise<void>;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({
  accounts,
  onOpenQR,
  onSelectChat,
  onReconnect,
  onDelete,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner / Hero stats */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-blue-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-blue-100 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Multi-Account Session Hub</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Quản trị nhiều tài khoản Zalo tập trung
          </h2>
          <p className="text-blue-100/90 text-sm mt-1 max-w-xl">
            Tất cả phiên đăng nhập được lưu trữ an toàn trong SQLite và duy trì kết nối WebSocket thời gian thực 24/7.
          </p>
        </div>

        <button
          onClick={onOpenQR}
          className="bg-white text-blue-600 hover:bg-blue-50 px-5 py-3 rounded-2xl font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95 flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Thêm tài khoản mới</span>
        </button>
      </div>

      {/* Grid of Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-800 text-lg">
              Danh sách tài khoản ({accounts.length})
            </h3>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-slate-800 text-lg mb-1">
              Chưa có tài khoản Zalo nào
            </h4>
            <p className="text-slate-500 text-sm max-w-md mb-6">
              Bấm vào nút bên dưới để quét mã QR bằng ứng dụng Zalo trên điện thoại và thêm tài khoản đầu tiên vào hệ thống.
            </p>
            <button
              onClick={onOpenQR}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Quét mã QR thêm tài khoản</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                onSelectChat={onSelectChat}
                onReconnect={onReconnect}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-800">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold block mb-0.5">Lưu ý an toàn:</strong>
          Các tài khoản kết nối được quản lý độc lập. Để tránh checkpoint, hạn chế gửi quá nhiều tin nhắn với tần suất dồn dập trong thời gian ngắn tới người lạ chưa kết bạn.
        </div>
      </div>
    </div>
  );
};
