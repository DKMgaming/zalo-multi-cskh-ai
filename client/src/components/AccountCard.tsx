import React, { useState } from "react";
import { MessageSquare, RefreshCw, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import type { Account } from "../api/client.js";

interface AccountCardProps {
  account: Account;
  onSelectChat: (accountId: string) => void;
  onReconnect: (accountId: string) => Promise<void>;
  onDelete: (accountId: string) => Promise<void>;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onSelectChat,
  onReconnect,
  onDelete,
}) => {
  const [loading, setLoading] = useState(false);

  const handleReconnect = async () => {
    try {
      setLoading(true);
      await onReconnect(account.id);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản [${account.name || account.uid}] không?`)) {
      try {
        setLoading(true);
        await onDelete(account.id);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Top Info */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={account.avatar || "https://stc-zaloprofile.zdn.vn/default-avatar.jpg"}
                alt={account.name}
                className="w-13 h-13 rounded-2xl object-cover border border-slate-100 shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://stc-zaloprofile.zdn.vn/default-avatar.jpg";
                }}
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  account.isOnline ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base leading-tight group-hover:text-blue-600 transition-colors">
                {account.name || "Zalo User"}
              </h4>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                UID: {account.uid}
              </p>
              {account.phone && (
                <p className="text-xs text-slate-500 mt-0.5">
                  SĐT: {account.phone}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {account.isOnline ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Online</span>
              </span>
            ) : account.status === "ERROR" ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100" title={account.lastError}>
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                <span>Lỗi phiên</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Account Details Box */}
        <div className="bg-slate-50 rounded-xl p-3 mb-4 text-xs space-y-1.5 border border-slate-100">
          <div className="flex justify-between text-slate-500">
            <span>Phiên kết nối:</span>
            <span className="font-semibold text-slate-700 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Đã mã hóa Cookie</span>
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Cập nhật gần nhất:</span>
            <span className="text-slate-600">
              {new Date(account.updatedAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => onSelectChat(account.id)}
          disabled={!account.isOnline}
          className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            account.isOnline
              ? "bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
          title="Mở chat"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Nhắn tin</span>
        </button>

        <button
          onClick={handleReconnect}
          disabled={loading}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
          title="Kết nối lại tài khoản"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Kết nối</span>
        </button>

        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 transition-all disabled:opacity-50"
          title="Xóa tài khoản khỏi hệ thống"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xóa</span>
        </button>
      </div>
    </div>
  );
};
