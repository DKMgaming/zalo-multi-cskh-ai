import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Send,
  User,
  Users,
  RefreshCw,
  MessageCircle,
  AlertCircle,
  Bot,
  UserCheck,
} from "lucide-react";
import { accountsApi, aiApi, type Account, type ChatMessage } from "../api/client.js";
import type { Socket } from "socket.io-client";

interface ChatPageProps {
  accounts: Account[];
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string) => void;
  socket: Socket | null;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  accounts,
  selectedAccountId,
  setSelectedAccountId,
  socket,
}) => {
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactTab, setContactTab] = useState<"friends" | "groups">("friends");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedThread, setSelectedThread] = useState<{
    id: string;
    name: string;
    avatar: string;
    type: "User" | "Group";
  } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isHumanTakeover, setIsHumanTakeover] = useState(false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set active account from props or default to first online
  useEffect(() => {
    if (selectedAccountId) {
      const found = accounts.find((a) => a.id === selectedAccountId);
      if (found) setActiveAccount(found);
    } else {
      const onlineOne = accounts.find((a) => a.isOnline);
      if (onlineOne) {
        setActiveAccount(onlineOne);
        setSelectedAccountId(onlineOne.id);
      } else if (accounts.length > 0) {
        setActiveAccount(accounts[0]);
        setSelectedAccountId(accounts[0].id);
      }
    }
  }, [selectedAccountId, accounts]);

  // Load contacts when active account changes
  useEffect(() => {
    if (!activeAccount || !activeAccount.isOnline) {
      setFriends([]);
      setGroups([]);
      return;
    }

    const loadContacts = async () => {
      try {
        setLoadingContacts(true);
        const [friendsRes, groupsRes] = await Promise.allSettled([
          accountsApi.getFriends(activeAccount.id),
          accountsApi.getGroups(activeAccount.id),
        ]);

        if (friendsRes.status === "fulfilled") {
          // Zalo returns friend list as array or object with data
          const list = Array.isArray(friendsRes.value) ? friendsRes.value : (friendsRes.value as any)?.data || [];
          setFriends(list);
        }

        if (groupsRes.status === "fulfilled") {
          const gList = Array.isArray(groupsRes.value) ? groupsRes.value : (groupsRes.value as any)?.data || [];
          setGroups(gList);
        }
      } finally {
        setLoadingContacts(false);
      }
    };

    loadContacts();
  }, [activeAccount?.id, activeAccount?.isOnline]);

  // Load messages history when thread selected
  useEffect(() => {
    if (!activeAccount || !selectedThread) {
      setMessages([]);
      return;
    }

    const loadHistory = async () => {
      try {
        setLoadingMessages(true);
        const history = await accountsApi.getHistory(activeAccount.id, selectedThread.id);
        setMessages(history);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadHistory();
  }, [activeAccount?.id, selectedThread?.id]);

  // Load conversation AI Takeover state
  useEffect(() => {
    if (!activeAccount || !selectedThread) return;
    aiApi
      .getConversationState(activeAccount.id, selectedThread.id)
      .then((state) => {
        setIsHumanTakeover(!!state.isHumanTakeover);
      })
      .catch(() => setIsHumanTakeover(false));
  }, [activeAccount?.id, selectedThread?.id]);

  // Listen to incoming messages and AI takeover triggers via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: { accountId: string; message: ChatMessage }) => {
      if (
        data.accountId === activeAccount?.id &&
        selectedThread &&
        data.message.threadId === selectedThread.id
      ) {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    const handleTakeover = (data: { accountId: string; threadId: string }) => {
      if (
        data.accountId === activeAccount?.id &&
        selectedThread &&
        data.threadId === selectedThread.id
      ) {
        setIsHumanTakeover(true);
      }
    };

    socket.on("zalo:message", handleMessage);
    socket.on("ai:takeover_triggered", handleTakeover);

    return () => {
      socket.off("zalo:message", handleMessage);
      socket.off("ai:takeover_triggered", handleTakeover);
    };
  }, [socket, activeAccount?.id, selectedThread?.id]);

  const handleToggleTakeover = async () => {
    if (!activeAccount || !selectedThread) return;
    setTakeoverLoading(true);
    try {
      const nextVal = !isHumanTakeover;
      await aiApi.setTakeover(
        activeAccount.id,
        selectedThread.id,
        nextVal,
        nextVal ? "Nhân viên bấm can thiệp trực tiếp" : ""
      );
      setIsHumanTakeover(nextVal);
    } catch (e: any) {
      alert("Lỗi cập nhật trạng thái AI: " + (e?.message || e));
    } finally {
      setTakeoverLoading(false);
    }
  };

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeAccount || !selectedThread || sending) return;

    const content = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    try {
      const res = await accountsApi.sendMessage(
        activeAccount.id,
        selectedThread.id,
        content,
        selectedThread.type
      );

      if (res && res.log) {
        setMessages((prev) => [...prev, res.log]);
      }
    } catch (err: any) {
      alert("Gửi tin nhắn thất bại: " + (err?.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  const filteredFriends = friends.filter((f) => {
    const name = f.displayName || f.name || f.userId || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredGroups = groups.filter((g) => {
    const name = g.groupName || g.name || g.groupId || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-3" />
        <h3 className="font-bold text-slate-800 text-lg">Chưa có tài khoản nào</h3>
        <p className="text-slate-500 text-sm">Vui lòng thêm ít nhất 1 tài khoản Zalo để bắt đầu trò chuyện.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-140px)] flex flex-col">
      {/* Top Header: Account Switcher */}
      <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tài khoản gửi:
          </span>
          <select
            value={activeAccount?.id || ""}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedThread(null);
            }}
            className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name || acc.uid} {acc.isOnline ? "(🟢 Online)" : "(🔴 Offline)"}
              </option>
            ))}
          </select>
        </div>

        {activeAccount && !activeAccount.isOnline && (
          <div className="flex items-center space-x-2 text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
            <AlertCircle className="w-4 h-4" />
            <span>Tài khoản này đang Offline. Vui lòng kết nối lại để gửi tin.</span>
          </div>
        )}
      </div>

      {/* Main Chat Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Contacts List */}
        <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
          {/* Search box */}
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm bạn bè, nhóm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Contact Category Tabs */}
          <div className="flex p-2 bg-slate-100 mx-3 my-2 rounded-xl text-xs font-medium">
            <button
              onClick={() => setContactTab("friends")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                contactTab === "friends"
                  ? "bg-white text-blue-600 font-bold shadow-sm"
                  : "text-slate-600"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Bạn bè ({friends.length})</span>
            </button>
            <button
              onClick={() => setContactTab("groups")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                contactTab === "groups"
                  ? "bg-white text-blue-600 font-bold shadow-sm"
                  : "text-slate-600"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Nhóm ({groups.length})</span>
            </button>
          </div>

          {/* Contact Items */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {loadingContacts ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">Đang tải danh bạ...</span>
              </div>
            ) : contactTab === "friends" ? (
              filteredFriends.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy bạn bè
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const id = friend.userId || friend.id || "";
                  const name = friend.displayName || friend.name || id;
                  const avatar = friend.avatar || "";
                  const isSelected = selectedThread?.id === id;

                  return (
                    <button
                      key={id}
                      onClick={() =>
                        setSelectedThread({
                          id,
                          name,
                          avatar,
                          type: "User",
                        })
                      }
                      className={`w-full flex items-center space-x-3 p-2.5 rounded-2xl text-left transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                          : "hover:bg-slate-100 text-slate-800"
                      }`}
                    >
                      <img
                        src={avatar || "https://stc-zaloprofile.zdn.vn/default-avatar.jpg"}
                        alt={name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200/60"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://stc-zaloprofile.zdn.vn/default-avatar.jpg";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-slate-900"}`}>
                          {name}
                        </p>
                        <p className={`text-[11px] truncate ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                          ID: {id}
                        </p>
                      </div>
                    </button>
                  );
                })
              )
            ) : filteredGroups.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Không tìm thấy nhóm
              </div>
            ) : (
              filteredGroups.map((group) => {
                const id = group.groupId || group.id || "";
                const name = group.groupName || group.name || id;
                const avatar = group.avatar || "";
                const isSelected = selectedThread?.id === id;

                return (
                  <button
                    key={id}
                    onClick={() =>
                      setSelectedThread({
                        id,
                        name,
                        avatar,
                        type: "Group",
                      })
                    }
                    className={`w-full flex items-center space-x-3 p-2.5 rounded-2xl text-left transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                        : "hover:bg-slate-100 text-slate-800"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {name}
                      </p>
                      <p className={`text-[11px] truncate ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                        Nhóm ({group.totalMember || 0} thành viên)
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Area: Messages Stream & Input */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedThread ? (
            <>
              {/* Conversation Header */}
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-3">
                  {selectedThread.avatar ? (
                    <img
                      src={selectedThread.avatar}
                      alt={selectedThread.name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-100"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      {selectedThread.type === "Group" ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {selectedThread.name}
                    </h4>
                    <span className="text-xs text-slate-400">
                      {selectedThread.type === "Group" ? "Nhóm chat" : "Hội thoại cá nhân"} &bull; {selectedThread.id}
                    </span>
                  </div>
                </div>

                {/* AI / Human Takeover Control Button */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleTakeover}
                    disabled={takeoverLoading}
                    title={
                      isHumanTakeover
                        ? "Nhân viên đang can thiệp trực tiếp (AI đã tắt). Bấm để trao lại quyền cho AI."
                        : "AI đang tự động trả lời. Bấm để nhân viên can thiệp và dừng AI."
                    }
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isHumanTakeover
                        ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                    }`}
                  >
                    {isHumanTakeover ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>👤 Bạn đang trực (Bật lại AI)</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-indigo-600" />
                        <span>🤖 AI đang tự động (Tiếp quản)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
                {loadingMessages ? (
                  <div className="py-12 flex justify-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Đang nạp lịch sử tin nhắn...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center">
                    <MessageCircle className="w-12 h-12 text-slate-300 mb-2" />
                    <p className="text-slate-500 text-sm font-medium">Chưa có tin nhắn trong phiên này</p>
                    <p className="text-slate-400 text-xs mt-1">Gửi tin nhắn đầu tiên để bắt đầu hội thoại!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.isSelf === 1 || m.senderId === activeAccount?.uid;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-xs ${
                            isMine
                              ? "bg-blue-600 text-white rounded-br-none"
                              : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {new Date(m.timestamp).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex items-center space-x-3">
                <input
                  type="text"
                  placeholder={`Gửi tin nhắn với tư cách [${activeAccount?.name || activeAccount?.uid}]...`}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={!activeAccount?.isOnline || sending}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || !activeAccount?.isOnline || sending}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-2xl shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageCircle className="w-16 h-16 text-slate-200 mb-3" />
              <h4 className="font-bold text-slate-700 text-base mb-1">
                Chọn người nhận hoặc nhóm
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Chọn một liên hệ từ danh sách bên trái để bắt đầu nhắn tin qua tài khoản Zalo đang hoạt động.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
