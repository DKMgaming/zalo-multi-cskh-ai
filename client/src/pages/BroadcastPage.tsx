import React, { useState } from "react";
import { Send, Users, ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";
import { accountsApi, type Account } from "../api/client.js";

interface BroadcastPageProps {
  accounts: Account[];
}

export const BroadcastPage: React.FC<BroadcastPageProps> = ({ accounts }) => {
  const onlineAccounts = accounts.filter((a) => a.isOnline);

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    onlineAccounts.map((a) => a.id)
  );
  const [recipientListRaw, setRecipientListRaw] = useState("");
  const [message, setMessage] = useState("");
  const [delaySec, setDelaySec] = useState(2);
  const [isSending, setIsSending] = useState(false);
  const [resultSummary, setResultSummary] = useState<any | null>(null);

  const handleToggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedAccountIds.length === onlineAccounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(onlineAccounts.map((a) => a.id));
    }
  };

  const handleStartBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAccountIds.length === 0) {
      alert("Vui lòng chọn ít nhất 1 tài khoản Zalo đang online để gửi.");
      return;
    }

    const recipients = recipientListRaw
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (recipients.length === 0) {
      alert("Vui lòng nhập ít nhất 1 ID người nhận hoặc nhóm.");
      return;
    }

    if (!message.trim()) {
      alert("Vui lòng nhập nội dung tin nhắn.");
      return;
    }

    if (
      !confirm(
        `Xác nhận gửi tin nhắn tới ${recipients.length} người nhận qua ${selectedAccountIds.length} tài khoản Zalo?`
      )
    ) {
      return;
    }

    setIsSending(true);
    setResultSummary(null);

    try {
      const res = await accountsApi.broadcast(
        selectedAccountIds,
        recipients,
        message.trim(),
        delaySec * 1000
      );
      setResultSummary(res);
    } catch (err: any) {
      alert("Gửi chiến dịch thất bại: " + (err?.response?.data?.error || err.message));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Chiến dịch Gửi tin nhắn Hàng loạt (Broadcast)
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Hệ thống sẽ tự động luân phiên (load balance) giữa các tài khoản Zalo được chọn để chia đều tải gửi tin.
        </p>
      </div>

      <form onSubmit={handleStartBroadcast} className="space-y-6">
        {/* Step 1: Sender Accounts Selection */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-800 text-base">
                1. Chọn tài khoản Zalo gửi ({selectedAccountIds.length}/{onlineAccounts.length} đã chọn)
              </h3>
            </div>
            {onlineAccounts.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                {selectedAccountIds.length === onlineAccounts.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            )}
          </div>

          {onlineAccounts.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Hiện không có tài khoản Zalo nào đang Online. Vui lòng kết nối tài khoản trước.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {onlineAccounts.map((acc) => {
                const isSelected = selectedAccountIds.includes(acc.id);
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleToggleAccount(acc.id)}
                    className={`flex items-center space-x-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                    />
                    <img
                      src={acc.avatar || "https://stc-zaloprofile.zdn.vn/default-avatar.jpg"}
                      alt={acc.name}
                      className="w-8 h-8 rounded-xl object-cover"
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {acc.name || acc.uid}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {acc.uid}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2: Recipients List */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-2">
            2. Danh sách người nhận / Nhóm nhận (Mỗi dòng 1 ID)
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Nhập User ID hoặc Group ID Zalo của người nhận. Có thể lấy ID từ danh sách bạn bè ở trang Nhắn tin.
          </p>
          <textarea
            rows={5}
            placeholder="Ví dụ:&#10;1234567890123456789&#10;9876543210987654321"
            value={recipientListRaw}
            onChange={(e) => setRecipientListRaw(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Step 3: Message Content & Delay Settings */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-base">
            3. Nội dung tin nhắn & Giãn cách an toàn
          </h3>

          <div>
            <textarea
              rows={4}
              placeholder="Nhập nội dung tin nhắn gửi đi (ví dụ: Thông báo khuyến mãi, CSKH...)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/60 max-w-md">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Giãn cách giữa mỗi tin gửi:</span>
            <input
              type="number"
              min={1}
              max={30}
              value={delaySec}
              onChange={(e) => setDelaySec(Number(e.target.value))}
              className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-slate-800"
            />
            <span>giây (khuyến nghị 2-3s)</span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSending || onlineAccounts.length === 0}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            <Send className={`w-4 h-4 ${isSending ? "animate-spin" : ""}`} />
            <span>{isSending ? "Đang gửi chiến dịch..." : "Bắt đầu gửi ngay"}</span>
          </button>
        </div>
      </form>

      {/* Results Summary Box */}
      {resultSummary && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm animate-in fade-in space-y-4">
          <h4 className="font-bold text-slate-900 text-base">
            Kết quả gửi chiến dịch
          </h4>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Tổng số người nhận</span>
              <strong className="text-xl text-slate-800">{resultSummary.summary?.total || 0}</strong>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <span className="text-xs text-emerald-600 block">Gửi thành công</span>
              <strong className="text-xl text-emerald-700">{resultSummary.summary?.success || 0}</strong>
            </div>
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
              <span className="text-xs text-rose-600 block">Thất bại</span>
              <strong className="text-xl text-rose-700">{resultSummary.summary?.failed || 0}</strong>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
            {resultSummary.details?.map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs"
              >
                <div className="flex items-center space-x-2">
                  {item.status === "SUCCESS" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500" />
                  )}
                  <span className="font-mono text-slate-700">Tới: {item.recipientId}</span>
                </div>
                <span className="text-slate-400">
                  {item.status === "SUCCESS" ? `Qua Zalo UID ${item.senderId}` : item.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
