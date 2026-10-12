import { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar.js";
import { QRModal } from "./components/QRModal.js";
import { AccountsPage } from "./pages/AccountsPage.js";
import { ChatPage } from "./pages/ChatPage.js";
import { BroadcastPage } from "./pages/BroadcastPage.js";
import { AiAgentPage } from "./pages/AiAgentPage.js";
import { accountsApi, authApi, type Account, type AuthUser } from "./api/client.js";
import { useSocket } from "./hooks/useSocket.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ChangePasswordModal } from "./components/ChangePasswordModal.js";

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("zalo_admin_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("zalo_admin_token");
  });
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeTab, setActiveTab] = useState<"accounts" | "chat" | "broadcast" | "ai">("accounts");
  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const socketRef = useSocket();

  // Listen for unauthorized 401 events to log user out
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setCurrentUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await accountsApi.getAll();
      setAccounts(data);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchAccounts();
    }
  }, [fetchAccounts, token]);

  // Listen to socket account events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleStatusChange = () => {
      fetchAccounts();
    };

    const handleDeleted = ({ id }: { id: string }) => {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (selectedAccountId === id) {
        setSelectedAccountId(null);
      }
    };

    socket.on("account:status_change", handleStatusChange);
    socket.on("account:deleted", handleDeleted);

    return () => {
      socket.off("account:status_change", handleStatusChange);
      socket.off("account:deleted", handleDeleted);
    };
  }, [socketRef, fetchAccounts, selectedAccountId]);

  const handleSelectChat = (accountId: string) => {
    setSelectedAccountId(accountId);
    setActiveTab("chat");
  };

  const handleReconnect = async (accountId: string) => {
    try {
      await accountsApi.reconnect(accountId);
      await fetchAccounts();
    } catch (err: any) {
      alert("Kết nối lại thất bại: " + (err?.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      await accountsApi.delete(accountId);
      await fetchAccounts();
    } catch (err: any) {
      alert("Xóa thất bại: " + (err?.response?.data?.error || err.message));
    }
  };

  const handleLoginSuccess = (user: AuthUser, tokenVal: string) => {
    setCurrentUser(user);
    setToken(tokenVal);
  };

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      await authApi.logout();
      setToken(null);
      setCurrentUser(null);
    }
  };

  // If user is not authenticated, show LoginPage
  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <Navbar
        accounts={accounts}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQR={() => setIsQROpen(true)}
        currentUser={currentUser}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === "accounts" && (
          <AccountsPage
            accounts={accounts}
            onOpenQR={() => setIsQROpen(true)}
            onSelectChat={handleSelectChat}
            onReconnect={handleReconnect}
            onDelete={handleDelete}
          />
        )}

        {activeTab === "chat" && (
          <ChatPage
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            socket={socketRef.current}
          />
        )}

        {activeTab === "broadcast" && (
          <BroadcastPage accounts={accounts} />
        )}

        {activeTab === "ai" && (
          <AiAgentPage accounts={accounts} />
        )}
      </main>

      {/* QR Login Modal */}
      <QRModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        socket={socketRef.current}
        onSuccess={fetchAccounts}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}

export default App;
