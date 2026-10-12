import React, { useState } from "react";
import { Shield, Lock, User, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { authApi, type AuthUser } from "../api/client.js";

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    try {
      setLoading(true);
      const { token, user } = await authApi.login(username.trim(), password);
      localStorage.setItem("zalo_admin_token", token);
      localStorage.setItem("zalo_admin_user", JSON.stringify(user));
      onLoginSuccess(user, token);
    } catch (err: any) {
      const msg = err.response?.data?.error || "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-4 font-bold text-3xl">
            Z
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Zalo Multi-Account Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Đăng nhập hệ thống Quản trị & AI CSKH
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="flex items-center space-x-2 pb-4 mb-6 border-b border-slate-100">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Đăng nhập Quản trị</h2>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Tài khoản đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tài khoản (mặc định: admin)"
                  disabled={loading}
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu (mặc định: admin)"
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập hệ thống</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Notice */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Mặc định: <strong>admin</strong> / <strong>admin</strong></span>
            </span>
            <span className="text-slate-400">Bảo mật mã hóa Bcrypt</span>
          </div>
        </div>
      </div>
    </div>
  );
};
