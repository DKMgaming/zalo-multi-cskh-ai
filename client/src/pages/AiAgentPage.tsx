import React, { useState, useEffect, useCallback } from "react";
import {
  Bot,
  BookOpen,
  Settings,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Send,
  Eye,
  EyeOff,
  UserCheck,
  Zap,
  Search,
  Database,
  RefreshCw,
  FolderMinus,
  Layers,
  UploadCloud,
  User,
  Users,
  Globe,
  Sliders,
  X,
  Check,
} from "lucide-react";
import {
  aiApi,
  accountsApi,
  type AiSettings,
  type AccountAiConfig,
  type KnowledgeItem,
  type Account,
  type TestQueryResult,
  type PineconeStats,
  type ReplyScopeType,
} from "../api/client.js";

interface AiAgentPageProps {
  accounts: Account[];
}

export const AiAgentPage: React.FC<AiAgentPageProps> = ({ accounts }) => {
  const [activeSubTab, setActiveSubTab] = useState<"knowledge" | "settings" | "playground">("knowledge");

  // Global AI Settings State
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Per-account Config State
  const [accountConfigs, setAccountConfigs] = useState<Record<string, AccountAiConfig>>({});

  // Knowledge Base State
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "faq" | "doc">("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<KnowledgeItem> | null>(null);

  // Pinecone Vector DB State
  const [pineconeStats, setPineconeStats] = useState<PineconeStats | null>(null);
  const [isSyncingPinecone, setIsSyncingPinecone] = useState(false);
  const [pineconeMessage, setPineconeMessage] = useState<string | null>(null);

  // File Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState("Chung");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ count: number; message: string; errors?: string[] } | null>(null);

  // Playground State
  const [testInput, setTestInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestQueryResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Account Scope & Config Modal State
  const [editingAccountModal, setEditingAccountModal] = useState<Account | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isAiEnabled: boolean;
    specificPrompt: string;
    replyScope: ReplyScopeType;
    allowedGroupIds: string[];
  }>({
    isAiEnabled: false,
    specificPrompt: "",
    replyScope: "all",
    allowedGroupIds: [],
  });
  const [accountGroups, setAccountGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [manualGroupId, setManualGroupId] = useState("");
  const [isSavingAccountConfig, setIsSavingAccountConfig] = useState(false);

  // Load Settings, Knowledge Items and Pinecone Stats
  const fetchData = useCallback(async () => {
    try {
      const [fetchedSettings, fetchedKnowledge, fetchedConfigs, fetchedPinecone] = await Promise.all([
        aiApi.getSettings(),
        aiApi.getKnowledge(),
        aiApi.getAccountConfigs(),
        aiApi.getPineconeStats().catch(() => null),
      ]);

      setSettings(fetchedSettings);
      setKnowledgeList(fetchedKnowledge);
      if (fetchedPinecone) {
        setPineconeStats(fetchedPinecone);
      }

      const configMap: Record<string, AccountAiConfig> = {};
      fetchedConfigs.forEach((c) => {
        configMap[c.accountId] = c;
      });
      setAccountConfigs(configMap);
    } catch (err: any) {
      console.error("Lỗi tải dữ liệu AI:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load fresh Pinecone stats
  const refreshPineconeStats = async () => {
    try {
      const stats = await aiApi.getPineconeStats();
      setPineconeStats(stats);
    } catch (e: any) {
      console.error("Lỗi lấy Pinecone stats:", e);
    }
  };

  // Sync All to Pinecone
  const handleSyncAllToPinecone = async () => {
    setIsSyncingPinecone(true);
    setPineconeMessage(null);
    try {
      const res = await aiApi.syncAllToPinecone();
      setPineconeMessage(`Đã đồng bộ thành công ${res.syncedCount} tài liệu lên Pinecone!`);
      await refreshPineconeStats();
    } catch (err: any) {
      alert("Lỗi đồng bộ Pinecone: " + (err?.response?.data?.error || err.message));
    } finally {
      setIsSyncingPinecone(false);
    }
  };

  // Delete an entire Group (Namespace)
  const handleDeleteGroup = async (groupName: string) => {
    if (
      !confirm(
        `CẢNH BÁO: Bạn có chắc chắn muốn XÓA TOÀN BỘ tài liệu trong nhóm "${groupName}"?\nThao tác này sẽ xóa sạch vectors trên Pinecone (Index CSKH) và toàn bộ tài liệu tương ứng!`
      )
    ) {
      return;
    }

    try {
      const res = await aiApi.deleteGroup(groupName);
      alert(res.message || `Đã xóa sạch nhóm ${groupName}`);
      setSelectedGroup("all");
      await fetchData();
      await refreshPineconeStats();
    } catch (err: any) {
      alert("Lỗi xóa nhóm: " + (err?.response?.data?.error || err.message));
    }
  };

  // Upload Files handler
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      alert("Vui lòng chọn ít nhất 1 file!");
      return;
    }

    setIsUploading(true);
    setUploadProgress("Đang tải file lên máy chủ và bóc tách dữ liệu...");
    setUploadResult(null);

    try {
      setUploadProgress("Đang phân đoạn RAG Chunking và gọi model llama-text-embed-v2 sinh vector 1024d...");
      const res = await aiApi.uploadFiles(uploadFiles, uploadCategory);

      setUploadResult({
        count: res.createdCount,
        message: res.message,
        errors: res.errors,
      });

      await fetchData();
      await refreshPineconeStats();
      setUploadFiles([]);
    } catch (err: any) {
      alert("Lỗi upload tài liệu: " + (err?.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Save AI Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSavingSettings(true);
    setSettingsMessage(null);
    try {
      const updated = await aiApi.updateSettings(settings);
      setSettings(updated);
      setSettingsMessage({ type: "success", text: "Đã lưu cài đặt AI thành công!" });
    } catch (err: any) {
      setSettingsMessage({ type: "error", text: "Lỗi lưu cài đặt: " + (err?.response?.data?.error || err.message) });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Toggle Account AI
  const handleToggleAccountAi = async (accountId: string, currentEnabled: boolean) => {
    try {
      const currentConfig = accountConfigs[accountId];
      const updated = await aiApi.updateAccountConfig(accountId, {
        isAiEnabled: !currentEnabled,
        specificPrompt: currentConfig?.specificPrompt || "",
        replyScope: currentConfig?.replyScope || "all",
        allowedGroupIds: currentConfig?.allowedGroupIds || "[]",
      });
      setAccountConfigs((prev) => ({ ...prev, [accountId]: updated }));
    } catch (err: any) {
      alert("Không thể cập nhật tài khoản: " + (err?.response?.data?.error || err.message));
    }
  };

  // Open Account Config Modal
  const handleOpenAccountConfigModal = async (acc: Account) => {
    setEditingAccountModal(acc);
    const cfg = accountConfigs[acc.id] || {
      isAiEnabled: 0,
      specificPrompt: "",
      replyScope: "all",
      allowedGroupIds: "[]",
    };
    let groups: string[] = [];
    try {
      groups = JSON.parse(cfg.allowedGroupIds || "[]");
    } catch {
      groups = [];
    }
    setModalConfig({
      isAiEnabled: !!cfg.isAiEnabled,
      specificPrompt: cfg.specificPrompt || "",
      replyScope: (cfg.replyScope as ReplyScopeType) || "all",
      allowedGroupIds: groups,
    });
    setGroupSearchQuery("");
    setManualGroupId("");

    // Load groups for this account
    setLoadingGroups(true);
    try {
      const res = await accountsApi.getGroups(acc.id);
      const list = Array.isArray(res) ? res : res?.data || [];
      setAccountGroups(list);
    } catch (err) {
      console.warn("Không thể tải nhóm:", err);
      setAccountGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Toggle single group in modal
  const handleToggleGroupInModal = (groupId: string) => {
    setModalConfig((prev) => {
      const exists = prev.allowedGroupIds.includes(groupId);
      return {
        ...prev,
        allowedGroupIds: exists
          ? prev.allowedGroupIds.filter((id) => id !== groupId)
          : [...prev.allowedGroupIds, groupId],
      };
    });
  };

  // Select all or Deselect all filtered groups
  const handleSelectAllFilteredGroups = (select: boolean, filteredList: any[]) => {
    setModalConfig((prev) => {
      const filteredIds = filteredList.map((g) => String(g.id || g.groupId));
      let nextList = [...prev.allowedGroupIds];
      if (select) {
        for (const id of filteredIds) {
          if (!nextList.includes(id)) nextList.push(id);
        }
      } else {
        nextList = nextList.filter((id) => !filteredIds.includes(id));
      }
      return { ...prev, allowedGroupIds: nextList };
    });
  };

  // Add manual group ID
  const handleAddManualGroupId = () => {
    const trimmed = manualGroupId.trim();
    if (!trimmed) return;
    if (!modalConfig.allowedGroupIds.includes(trimmed)) {
      setModalConfig((prev) => ({
        ...prev,
        allowedGroupIds: [...prev.allowedGroupIds, trimmed],
      }));
    }
    setManualGroupId("");
  };

  // Save Account Config
  const handleSaveAccountModalConfig = async () => {
    if (!editingAccountModal) return;
    setIsSavingAccountConfig(true);
    try {
      const updated = await aiApi.updateAccountConfig(editingAccountModal.id, {
        isAiEnabled: modalConfig.isAiEnabled,
        specificPrompt: modalConfig.specificPrompt,
        replyScope: modalConfig.replyScope,
        allowedGroupIds: modalConfig.allowedGroupIds,
      });
      setAccountConfigs((prev) => ({ ...prev, [editingAccountModal.id]: updated }));
      setEditingAccountModal(null);
    } catch (err: any) {
      alert("Lỗi lưu cấu hình nick: " + (err?.response?.data?.error || err.message));
    } finally {
      setIsSavingAccountConfig(false);
    }
  };

  // Knowledge Item Form Submit
  const handleSaveKnowledgeItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.title || !editingItem.content) {
      alert("Vui lòng điền đầy đủ tiêu đề và nội dung");
      return;
    }

    try {
      if (editingItem.id) {
        await aiApi.updateKnowledge(editingItem.id, editingItem);
      } else {
        await aiApi.createKnowledge({
          type: editingItem.type || "faq",
          title: editingItem.title,
          content: editingItem.content,
          category: editingItem.category?.trim() || "Chung",
          keywords: editingItem.keywords || "",
          enabled: editingItem.enabled ?? 1,
        });
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
      await fetchData();
      await refreshPineconeStats();
    } catch (err: any) {
      alert("Lỗi lưu tri thức: " + (err?.response?.data?.error || err.message));
    }
  };

  // Delete Knowledge Item
  const handleDeleteKnowledgeItem = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa mục tri thức này?")) return;
    try {
      await aiApi.deleteKnowledge(id);
      setKnowledgeList((prev) => prev.filter((item) => item.id !== id));
      await refreshPineconeStats();
    } catch (err: any) {
      alert("Lỗi xóa: " + (err?.response?.data?.error || err.message));
    }
  };

  // Playground Test Run
  const handleRunTestQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await aiApi.testQuery(testInput.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestError(err?.response?.data?.error || err.message || "Lỗi khi gọi AI");
    } finally {
      setIsTesting(false);
    }
  };

  // Compute unique groups (categories) from both local items and Pinecone namespaces
  const uniqueGroups = Array.from(
    new Set([
      ...knowledgeList.map((k) => k.category).filter(Boolean),
      ...Object.keys(pineconeStats?.namespaces || {}),
    ])
  ).sort();

  // Filtered Knowledge Items
  const filteredKnowledge = knowledgeList.filter((item) => {
    const matchType = filterType === "all" || item.type === filterType;
    const matchGroup = selectedGroup === "all" || item.category === selectedGroup;
    const matchQuery =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keywords.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchGroup && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-white">
              <Bot className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Agent Chăm Sóc Khách Hàng</h1>
              <p className="text-blue-100 text-sm">
                Kết nối trực tiếp Pinecone Vector DB (Index CSKH, llama-text-embed-v2) & Zalo Multi-Account
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-2">
            <Database className="w-3.5 h-3.5 text-emerald-300" />
            <span>
              Pinecone: <strong className="text-emerald-300">CSKH</strong> + <strong className="text-amber-300">BGE-Reranker-v2-m3</strong>
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                settings?.isGlobalEnabled ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            <span>
              Auto-Reply: <strong>{settings?.isGlobalEnabled ? "BẬT" : "TẮT"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab("knowledge")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeSubTab === "knowledge"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Kho Tri Thức (Pinecone RAG) ({knowledgeList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("settings")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeSubTab === "settings"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cấu hình AI & Nick Zalo</span>
        </button>

        <button
          onClick={() => setActiveSubTab("playground")}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeSubTab === "playground"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Thử nghiệm (Playground)</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* SUB-TAB 1: KHO TRI THỨC (KNOWLEDGE BASE & PINECONE) */}
      {/* ============================================================ */}
      {activeSubTab === "knowledge" && (
        <div className="space-y-5">
          {/* Pinecone Vector DB Status Bar */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-sm text-slate-100">Pinecone Vector Database</h4>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                    ĐÃ KẾT NỐI
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Host: <code className="text-slate-300">semirag-gpxczi5.svc.aped-4627-b74a.pinecone.io</code> &bull; Index: <strong className="text-white">CSKH</strong> &bull; Model: <span className="text-indigo-300 font-mono">llama-text-embed-v2 (1024d)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs text-slate-400">Tổng vectors trong index:</div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {pineconeStats?.totalRecordCount ?? 0} vectors
                </div>
              </div>

              <button
                onClick={handleSyncAllToPinecone}
                disabled={isSyncingPinecone}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all"
                title="Sinh vector lại cho toàn bộ tài liệu và nạp lên Pinecone"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPinecone ? "animate-spin" : ""}`} />
                <span>{isSyncingPinecone ? "Đang đồng bộ..." : "Đồng bộ lên Pinecone"}</span>
              </button>
            </div>
          </div>

          {pineconeMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{pineconeMessage}</span>
            </div>
          )}

          {/* Group / Namespace Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Quản lý theo Nhóm tài liệu (Namespaces):
                </span>
              </div>

              {/* Delete Group Button */}
              {selectedGroup !== "all" && (
                <button
                  onClick={() => handleDeleteGroup(selectedGroup)}
                  className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  title="Xóa sạch toàn bộ vectors trên Pinecone và tài liệu trong nhóm này"
                >
                  <FolderMinus className="w-3.5 h-3.5 text-rose-600" />
                  <span>Xóa toàn bộ nhóm "{selectedGroup}"</span>
                </button>
              )}
            </div>

            {/* Group Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setSelectedGroup("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedGroup === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả nhóm ({knowledgeList.length})
              </button>

              {uniqueGroups.map((grp) => {
                const countInDb = knowledgeList.filter((k) => k.category === grp).length;
                const countInPinecone = pineconeStats?.namespaces?.[grp]?.recordCount;

                return (
                  <button
                    key={grp}
                    onClick={() => setSelectedGroup(grp)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      selectedGroup === grp
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span>{grp}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedGroup === grp
                          ? "bg-indigo-800 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                      title={`${countInDb} trong DB, ${countInPinecone ?? 0} trong Pinecone`}
                    >
                      {countInDb}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm kiếm câu hỏi, nội dung, từ khóa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type Filter */}
              <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-3 py-1.5 rounded-md ${
                    filterType === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterType("faq")}
                  className={`px-3 py-1.5 rounded-md ${
                    filterType === "faq" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
                  }`}
                >
                  FAQ
                </button>
                <button
                  onClick={() => setFilterType("doc")}
                  className={`px-3 py-1.5 rounded-md ${
                    filterType === "doc" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Tài liệu
                </button>
              </div>
            </div>

            {/* Add Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setEditingItem({
                    type: "faq",
                    title: "",
                    content: "",
                    category: selectedGroup === "all" ? "Chung" : selectedGroup,
                    keywords: "",
                    enabled: 1,
                  });
                  setIsItemModalOpen(true);
                }}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Hỏi Đáp (FAQ)</span>
              </button>

              <button
                onClick={() => {
                  setEditingItem({
                    type: "doc",
                    title: "",
                    content: "",
                    category: selectedGroup === "all" ? "Chung" : selectedGroup,
                    keywords: "",
                    enabled: 1,
                  });
                  setIsItemModalOpen(true);
                }}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Tài liệu</span>
              </button>

              <button
                onClick={() => {
                  setUploadFiles([]);
                  setUploadCategory(selectedGroup === "all" ? "Chung" : selectedGroup);
                  setUploadResult(null);
                  setIsUploadModalOpen(true);
                }}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
                title="Tải lên file Word (.docx), PDF, Excel (.xlsx/.xls/.csv), Text (.txt)"
              >
                <UploadCloud className="w-4 h-4" />
                <span>+ Tải lên File (PDF/Word/Excel)</span>
              </button>
            </div>
          </div>

          {/* List of Knowledge Items */}
          {filteredKnowledge.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 text-base">Không có tài liệu nào trong nhóm này</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Hãy bấm nút "+ Thêm Hỏi Đáp" hoặc "+ Thêm Tài liệu" để tải tài liệu lên nhóm này. Dữ liệu sẽ tự động vector hóa bằng model llama-text-embed-v2 và nạp vào Pinecone Index CSKH.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKnowledge.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                    item.enabled ? "border-slate-200" : "border-slate-200 opacity-60 bg-slate-50"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center space-x-2">
                        {item.type === "faq" ? (
                          <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-md font-semibold flex items-center space-x-1">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>FAQ</span>
                          </span>
                        ) : (
                          <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-md font-semibold flex items-center space-x-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Tài liệu</span>
                          </span>
                        )}
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          Nhóm: {item.category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsItemModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteKnowledgeItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa tài liệu này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="font-semibold text-slate-900 text-base mb-2">
                      {item.type === "faq" ? `Q: ${item.title}` : item.title}
                    </h4>

                    {/* Content */}
                    <p className="text-slate-600 text-sm whitespace-pre-line line-clamp-4 mb-3">
                      {item.content}
                    </p>
                  </div>

                  {/* Footer: Keywords & Pinecone Tag */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                    {item.keywords ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[11px] text-slate-400 mr-0.5">Từ khóa:</span>
                        {item.keywords.split(",").map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                          >
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div />
                    )}

                    <span className="text-[10px] text-emerald-600 font-medium flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Pinecone Vector Sync</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 2: CẤU HÌNH AI & TÀI KHOẢN ZALO */}
      {/* ============================================================ */}
      {activeSubTab === "settings" && settings && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings Form (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-base">Cài đặt Mô hình AI & Prompt</h3>
                </div>

                {/* Master AI Toggle */}
                <label className="flex items-center cursor-pointer space-x-2">
                  <span className="text-sm font-medium text-slate-700">Tự động hóa toàn cục:</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!settings.isGlobalEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, isGlobalEnabled: e.target.checked ? 1 : 0 })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </div>
                </label>
              </div>

              {settingsMessage && (
                <div
                  className={`p-3.5 rounded-xl text-sm flex items-center space-x-2 ${
                    settingsMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {settingsMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{settingsMessage.text}</span>
                </div>
              )}

              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nhà cung cấp Mô hình (Provider)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        provider: "gemini",
                        model: "gemini-1.5-flash",
                      })
                    }
                    className={`p-3.5 border rounded-xl text-left transition-all ${
                      settings.provider === "gemini"
                        ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">Google Gemini</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Nhanh, thông minh, chi phí cực thấp hoặc miễn phí (Gemini Flash).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        provider: "openai",
                        model: "gpt-4o-mini",
                      })
                    }
                    className={`p-3.5 border rounded-xl text-left transition-all ${
                      settings.provider === "openai"
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">OpenAI / DeepSeek / Ollama</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Chuẩn OpenAI-Compatible (GPT-4o, DeepSeek, Groq, Ollama...).
                    </div>
                  </button>
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  API Key ({settings.provider === "gemini" ? "Google AI Studio" : "OpenAI / DeepSeek"})
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder={
                      settings.provider === "gemini" ? "AIzaSy..." : "sk-..."
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Base URL (if OpenAI-compatible) */}
              {settings.provider === "openai" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Base URL (Để trống nếu dùng OpenAI trực tiếp)
                  </label>
                  <input
                    type="text"
                    value={settings.baseURL}
                    onChange={(e) => setSettings({ ...settings, baseURL: e.target.value })}
                    placeholder="https://api.deepseek.com/v1"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Gợi ý: DeepSeek (<code>https://api.deepseek.com/v1</code>), OpenRouter (<code>https://openrouter.ai/api/v1</code>)
                  </p>
                </div>
              )}

              {/* Model selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Model Tên
                </label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs text-slate-400 mr-1 self-center">Mẫu nhanh:</span>
                  {["gemini-1.5-flash", "gemini-2.0-flash", "gpt-4o-mini", "deepseek-chat"].map(
                    (m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSettings({ ...settings, model: m })}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-mono"
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-slate-700">
                    System Prompt (Tính cách & Quy tắc CSKH)
                  </label>
                </div>
                <textarea
                  rows={6}
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-sans"
                />
              </div>

              {/* Sliders: Delay & Temperature */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Thời gian chờ gõ phím:</span>
                    <span>{settings.replyDelaySeconds} giây</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={settings.replyDelaySeconds}
                    onChange={(e) =>
                      setSettings({ ...settings, replyDelaySeconds: parseInt(e.target.value) })
                    }
                    className="w-full accent-blue-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Tạo cảm giác tự nhiên như nhân viên đang gõ tin nhắn.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Nhiệt độ sáng tạo (Temperature):</span>
                    <span>{settings.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) =>
                      setSettings({ ...settings, temperature: parseFloat(e.target.value) })
                    }
                    className="w-full accent-blue-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    0.2 - 0.7: Phù hợp nhất cho chăm sóc khách hàng chuẩn xác.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? "Đang lưu..." : "Lưu Cài Đặt AI"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Per-Account AI Toggles (1 Col) */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center space-x-2 mb-3">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Bật/Tắt theo Nick Zalo</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Chọn tài khoản Zalo nào được phép cho bot AI tự động trả lời khách hàng:
              </p>

              {accounts.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Chưa có tài khoản Zalo nào trong hệ thống
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((acc) => {
                    const config = accountConfigs[acc.id] || { isAiEnabled: 0 };
                    const isEnabled = !!config.isAiEnabled;

                    return (
                      <div
                        key={acc.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          isEnabled
                            ? "border-emerald-200 bg-emerald-50/30"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <img
                            src={acc.avatar || "https://placehold.co/100x100?text=Zalo"}
                            alt={acc.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://placehold.co/100x100?text=Zalo";
                            }}
                          />
                          <div className="truncate">
                            <div className="font-semibold text-slate-900 text-sm truncate flex items-center space-x-2">
                              <span>{acc.name || acc.uid}</span>
                              <span
                                className={`w-2 h-2 rounded-full inline-block ${
                                  acc.isOnline ? "bg-emerald-500" : "bg-slate-300"
                                }`}
                                title={acc.isOnline ? "Đang Online" : "Offline"}
                              />
                            </div>
                            {/* Scope Badge */}
                            <div className="mt-1 flex items-center space-x-1.5 flex-wrap gap-y-1">
                              {!isEnabled ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-400">
                                  Đang tắt AI
                                </span>
                              ) : (
                                <>
                                  {config.replyScope === "direct_only" && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center space-x-1">
                                      <User className="w-3 h-3 text-purple-600" />
                                      <span>Chỉ cá nhân (1-1)</span>
                                    </span>
                                  )}
                                  {config.replyScope === "groups_only" && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
                                      <Users className="w-3 h-3 text-indigo-600" />
                                      <span>
                                        Chỉ nhóm ({(() => {
                                          try {
                                            return JSON.parse(config.allowedGroupIds || "[]").length;
                                          } catch {
                                            return 0;
                                          }
                                        })()} nhóm)
                                      </span>
                                    </span>
                                  )}
                                  {config.replyScope === "direct_and_selected_groups" && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                                      <Users className="w-3 h-3 text-blue-600" />
                                      <span>
                                        Cá nhân &amp; {(() => {
                                          try {
                                            return JSON.parse(config.allowedGroupIds || "[]").length;
                                          } catch {
                                            return 0;
                                          }
                                        })()} nhóm
                                      </span>
                                    </span>
                                  )}
                                  {(!config.replyScope || config.replyScope === "all") && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                                      <Globe className="w-3 h-3 text-emerald-600" />
                                      <span>Tất cả (Cá nhân &amp; Nhóm)</span>
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleOpenAccountConfigModal(acc)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 shadow-sm transition-all hover:border-blue-400 hover:text-blue-600"
                            title="Cài đặt phạm vi trả lời tin nhắn cá nhân hoặc nhóm"
                          >
                            <Sliders className="w-3.5 h-3.5 text-blue-600" />
                            <span>Cài đặt phạm vi</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleAccountAi(acc.id, isEnabled)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isEnabled
                                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {isEnabled ? "🤖 BẬT" : "TẮT"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note on Human Takeover */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
              <div className="font-bold flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Quy tắc chuyển giao (Human Takeover):</span>
              </div>
              <p>
                Khi khách hàng nhắn các câu như <em>"gặp nhân viên"</em>, <em>"tư vấn viên"</em>, hoặc khi bạn bấm nút <strong>"Tiếp quản"</strong> trong mục Nhắn tin, AI sẽ tự động ngưng auto-reply cho khách hàng đó để bạn tự chat trực tiếp.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 3: THỬ NGHIỆM AI (PLAYGROUND) */}
      {/* ============================================================ */}
      {activeSubTab === "playground" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Query input card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Thử nghiệm Câu hỏi Khách hàng</h3>
            </div>
            <p className="text-xs text-slate-500">
              Nhập câu hỏi để kiểm tra RAG vector hóa qua Pinecone (llama-text-embed-v2) và sinh câu trả lời:
            </p>

            <form onSubmit={handleRunTestQuery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tin nhắn khách gửi:
                </label>
                <textarea
                  rows={3}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Ví dụ: Shop có ship COD không và phí thế nào ạ? hoặc Cho tôi gặp nhân viên..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-400 mr-1 self-center">Câu hỏi mẫu:</span>
                {[
                  "Shop có ship COD không?",
                  "Chính sách bảo hành thế nào?",
                  "Địa chỉ shop ở đâu ạ?",
                  "Cho em gặp nhân viên tư vấn",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setTestInput(q)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isTesting || !testInput.trim()}
                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-500/20 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{isTesting ? "Đang truy vấn Pinecone & AI..." : "Gửi Thử Nghiệm"}</span>
              </button>
            </form>

            {testError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-sm flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <span>{testError}</span>
              </div>
            )}
          </div>

          {/* Result view card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
              Kết Quả Phản Hồi của AI
            </h3>

            {!testResult && !isTesting && (
              <div className="text-center py-12 text-slate-400 text-sm">
                Nhập câu hỏi bên trái và bấm "Gửi Thử Nghiệm" để xem kết quả tại đây.
              </div>
            )}

            {isTesting && (
              <div className="text-center py-12 space-y-2">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                <p className="text-slate-500 text-xs">Đang tìm kiếm trên Pinecone Vector và sinh câu trả lời...</p>
              </div>
            )}

            {testResult && (
              <div className="space-y-4">
                {/* Takeover flag alert */}
                {testResult.isTakeover && (
                  <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Hệ thống nhận diện ý định "Gặp Nhân Viên" (Human Takeover triggered)</span>
                  </div>
                )}

                {/* AI Reply Bubble */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center space-x-1">
                    <Bot className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Câu trả lời mô phỏng gửi qua Zalo:</span>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 text-slate-800 text-sm leading-relaxed whitespace-pre-line shadow-sm">
                    {testResult.reply}
                  </div>
                </div>

                {/* Matched Knowledge Chunks */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">
                    Tri thức được trích xuất (RAG Matches): ({testResult.matchedKnowledge.length})
                  </div>
                  {testResult.matchedKnowledge.length === 0 ? (
                    <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      Không tìm thấy mục tri thức nào phù hợp.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {testResult.matchedKnowledge.map((match, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-800">
                              #{idx + 1} [{match.item.category}] {match.item.title}
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold">
                              Điểm: {match.score}%
                            </span>
                          </div>
                          <p className="text-slate-600 line-clamp-2">{match.item.content}</p>
                          <div className="text-[10px] text-slate-400">
                            Lý do khớp: {match.matchReasons.join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: THÊM / SỬA MỤC TRI THỨC */}
      {/* ============================================================ */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingItem.id ? "Chỉnh sửa Tri Thức" : "Thêm Mục Tri Thức Mới"}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveKnowledgeItem} className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Loại thông tin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, type: "faq" })}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center ${
                      editingItem.type === "faq"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Hỏi đáp (FAQ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, type: "doc" })}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center ${
                      editingItem.type === "doc"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Tài liệu / Chính sách
                  </button>
                </div>
              </div>

              {/* Group / Category (Namespace) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhóm tài liệu (Pinecone Namespace)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chung, Bảo hành, Bảng giá, Giao hàng, Kỹ thuật..."
                  value={editingItem.category || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[11px] text-slate-400 self-center">Chọn nhanh:</span>
                  {["Chung", "Bảo hành", "Bảng giá", "Giao hàng"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, category: g })}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title / Question */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingItem.type === "faq" ? "Câu hỏi khách thường hỏi:" : "Tiêu đề tài liệu:"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    editingItem.type === "faq"
                      ? "Ví dụ: Shop có ship COD không?"
                      : "Ví dụ: Chính sách đổi trả hàng trong 7 ngày"
                  }
                  value={editingItem.title || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Từ khóa nhận diện nhanh (cách nhau bởi dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: ship cod, giao hàng, phí vận chuyển, nhận hàng thanh toán"
                  value={editingItem.keywords || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, keywords: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Content / Answer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingItem.type === "faq" ? "Câu trả lời mẫu:" : "Nội dung tài liệu chi tiết:"}
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={
                    editingItem.type === "faq"
                      ? "Dạ bên em có hỗ trợ ship COD toàn quốc, khách được kiểm tra hàng trước khi thanh toán ạ."
                      : "Quy định đổi trả: Sản phẩm còn nguyên tem mác trong 7 ngày được đổi trả miễn phí..."
                  }
                  value={editingItem.content || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="enabledCheck"
                  checked={editingItem.enabled !== 0}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, enabled: e.target.checked ? 1 : 0 })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="enabledCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Kích hoạt mục tri thức này cho AI sử dụng
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
                >
                  Lưu & Đồng bộ Pinecone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: TẢI LÊN FILE TÀI LIỆU (DOCX, PDF, EXCEL, TXT) */}
      {/* ============================================================ */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Tải lên File Tài Liệu (RAG & Pinecone)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hỗ trợ Word (.docx), PDF (.pdf), Excel (.xlsx, .xls, .csv), Text (.txt, .md)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    setUploadResult(null);
                  }
                }}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-4">
              {/* Group / Namespace target */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhóm tài liệu đích (Pinecone Namespace):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chung, Bảo hành, Bảng giá, Sản phẩm..."
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[11px] text-slate-400 self-center">Chọn nhanh:</span>
                  {uniqueGroups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setUploadCategory(g)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drag and drop / File selector zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const newFiles = Array.from(e.dataTransfer.files);
                    setUploadFiles((prev) => [...prev, ...newFiles]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all"
                onClick={() => document.getElementById("file-input-element")?.click()}
              >
                <UploadCloud className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  Kéo và thả file vào đây, hoặc <span className="text-emerald-600 underline">bấm để duyệt</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Định dạng: .docx, .pdf, .xlsx, .xls, .csv, .txt, .md (Tối đa 30MB mỗi file)
                </p>
                <input
                  id="file-input-element"
                  type="file"
                  multiple
                  accept=".docx,.pdf,.xlsx,.xls,.csv,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const newFiles = Array.from(e.target.files);
                      setUploadFiles((prev) => [...prev, ...newFiles]);
                    }
                  }}
                />
              </div>

              {/* Selected Files List */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>Đã chọn ({uploadFiles.length} file):</span>
                    <button
                      type="button"
                      onClick={() => setUploadFiles([])}
                      className="text-rose-600 hover:underline"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {uploadFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-medium text-slate-800 truncate">{file.name}</span>
                          <span className="text-slate-400 text-[10px]">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setUploadFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-rose-600 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress Message */}
              {isUploading && (
                <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-xs text-indigo-900 flex items-center space-x-2.5 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 flex-shrink-0" />
                  <span>{uploadProgress || "Đang xử lý tài liệu..."}</span>
                </div>
              )}

              {/* Upload Result Alert */}
              {uploadResult && (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{uploadResult.message}</span>
                  </div>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="text-rose-600 text-[11px] pt-1">
                      {uploadResult.errors.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* Pipeline explanation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">Quy trình tự động:</div>
                <p>
                  1. Tự động bóc tách chữ từ PDF / Word / Text hoặc chuyển bảng Excel thành dữ liệu có cấu trúc.
                </p>
                <p>
                  2. Tự động phân đoạn thông minh (RAG Chunking 450 từ) kèm độ gối đầu.
                </p>
                <p>
                  3. Gọi mô hình <strong>llama-text-embed-v2</strong> tạo vector 1024d và nạp thẳng vào <strong>Pinecone Index CSKH</strong> theo nhóm tương ứng.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadResult(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  {uploadResult ? "Đóng" : "Hủy"}
                </button>
                <button
                  type="submit"
                  disabled={isUploading || uploadFiles.length === 0}
                  className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {isUploading ? "Đang xử lý & Vector hóa..." : "Bắt đầu Tải Lên & Nạp Pinecone"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL CẤU HÌNH PHẠM VI TRẢ LỜI CHO NICK ZALO */}
      {/* ============================================================ */}
      {editingAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center space-x-3">
                <img
                  src={editingAccountModal.avatar || "https://placehold.co/100x100?text=Zalo"}
                  alt={editingAccountModal.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=Zalo";
                  }}
                />
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                    <span>Cấu hình AI cho {editingAccountModal.name || editingAccountModal.uid}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chọn phạm vi trả lời tin nhắn cá nhân hoặc nhóm chat được chỉ định
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccountModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
              {/* Toggle Enable AI for this account */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <div className="font-semibold text-sm text-slate-900">Kích hoạt Bot AI cho tài khoản này</div>
                  <div className="text-xs text-slate-500">
                    Khi bật, bot sẽ tự động trả lời theo phạm vi cấu hình bên dưới
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setModalConfig((prev) => ({ ...prev, isAiEnabled: !prev.isAiEnabled }))
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    modalConfig.isAiEnabled
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {modalConfig.isAiEnabled ? "🤖 Đang BẬT" : "Đang TẮT"}
                </button>
              </div>

              {/* Reply Scope Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Phạm vi trả lời tin nhắn (Scope)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: all */}
                  <div
                    onClick={() => setModalConfig((prev) => ({ ...prev, replyScope: "all" }))}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                      modalConfig.replyScope === "all"
                        ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        modalConfig.replyScope === "all"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900">Tất cả tin nhắn</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Trả lời cả khách nhắn riêng (1-1) và mọi nhóm nick tham gia.
                      </div>
                    </div>
                  </div>

                  {/* Option 2: direct_only */}
                  <div
                    onClick={() => setModalConfig((prev) => ({ ...prev, replyScope: "direct_only" }))}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                      modalConfig.replyScope === "direct_only"
                        ? "border-purple-500 bg-purple-50/50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        modalConfig.replyScope === "direct_only"
                          ? "bg-purple-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900">Chỉ tin nhắn cá nhân (1-1)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Chỉ trả lời khách chat riêng. Tuyệt đối KHÔNG trả lời trong nhóm.
                      </div>
                    </div>
                  </div>

                  {/* Option 3: groups_only */}
                  <div
                    onClick={() => setModalConfig((prev) => ({ ...prev, replyScope: "groups_only" }))}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                      modalConfig.replyScope === "groups_only"
                        ? "border-indigo-500 bg-indigo-50/50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        modalConfig.replyScope === "groups_only"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900">Chỉ nhóm được chọn</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Không trả lời chat riêng 1-1. Chỉ phản hồi trong nhóm được tích chọn.
                      </div>
                    </div>
                  </div>

                  {/* Option 4: direct_and_selected_groups */}
                  <div
                    onClick={() =>
                      setModalConfig((prev) => ({ ...prev, replyScope: "direct_and_selected_groups" }))
                    }
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                      modalConfig.replyScope === "direct_and_selected_groups"
                        ? "border-blue-500 bg-blue-50/50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        modalConfig.replyScope === "direct_and_selected_groups"
                          ? "bg-blue-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-900">Cá nhân &amp; Nhóm được chọn</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Trả lời chat riêng 1-1 VÀ các nhóm chat được tích chọn.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group Selector (when scope is groups_only or direct_and_selected_groups) */}
              {(modalConfig.replyScope === "groups_only" ||
                modalConfig.replyScope === "direct_and_selected_groups") && (
                <div className="space-y-3 p-4 rounded-xl border border-indigo-200 bg-indigo-50/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span>Danh sách nhóm được phép trả lời</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                          {modalConfig.allowedGroupIds.length} đã chọn
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Chỉ các nhóm được tích chọn dưới đây mới kích hoạt AI tự động phản hồi
                      </div>
                    </div>

                    {/* Quick select buttons */}
                    {(() => {
                      // Kết hợp danh sách từ Zalo với bất kỳ ID nào đã lưu trước đó
                      const combinedGroups = [...accountGroups];
                      const existingSet = new Set(accountGroups.map((g) => String(g.id || g.groupId)));
                      for (const savedId of modalConfig.allowedGroupIds) {
                        if (!existingSet.has(savedId)) {
                          combinedGroups.push({
                            id: savedId,
                            groupId: savedId,
                            name: `Nhóm ${savedId}`,
                            groupName: `Nhóm ${savedId}`,
                            avatar: "",
                            totalMember: 0,
                            isCustomSaved: true,
                          });
                        }
                      }

                      const getFiltered = () => {
                        const q = groupSearchQuery.trim().toLowerCase();
                        if (!q) return combinedGroups;
                        return combinedGroups.filter((g) => {
                          const gName = String(g.name || g.groupName || "").toLowerCase();
                          const gId = String(g.id || g.groupId || "").toLowerCase();
                          return gName.includes(q) || gId.includes(q);
                        });
                      };

                      const filtered = getFiltered();

                      return (
                        <>
                          <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleSelectAllFilteredGroups(true, filtered)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              Chọn tất cả
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAllFilteredGroups(false, filtered)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              Bỏ chọn
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm nhóm theo tên hoặc ID..."
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Group list scrollable */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-xl p-2 bg-white">
                    {loadingGroups ? (
                      <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Đang tải danh sách nhóm từ Zalo...</span>
                      </div>
                    ) : accountGroups.length === 0 && modalConfig.allowedGroupIds.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                        <div>Không tìm thấy nhóm chat nào của tài khoản này.</div>
                        <div className="text-[11px] text-slate-400">
                          (Nếu nick đang offline, hãy kết nối lại hoặc nhập ID nhóm thủ công bên dưới)
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const combinedGroups = [...accountGroups];
                        const existingSet = new Set(accountGroups.map((g) => String(g.id || g.groupId)));
                        for (const savedId of modalConfig.allowedGroupIds) {
                          if (!existingSet.has(savedId)) {
                            combinedGroups.push({
                              id: savedId,
                              groupId: savedId,
                              name: `Nhóm ${savedId}`,
                              groupName: `Nhóm ${savedId}`,
                              avatar: "",
                              totalMember: 0,
                              isCustomSaved: true,
                            });
                          }
                        }

                        const q = groupSearchQuery.trim().toLowerCase();
                        const filtered = q
                          ? combinedGroups.filter((g) => {
                              const gName = String(g.name || g.groupName || "").toLowerCase();
                              const gId = String(g.id || g.groupId || "").toLowerCase();
                              return gName.includes(q) || gId.includes(q);
                            })
                          : combinedGroups;

                        if (filtered.length === 0) {
                          return (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Không có nhóm nào khớp với tìm kiếm "{groupSearchQuery}"
                            </div>
                          );
                        }

                        return filtered.map((g) => {
                          const gId = String(g.id || g.groupId || "");
                          const gName = g.name || g.groupName || `Nhóm ${gId}`;
                          const isChecked = modalConfig.allowedGroupIds.includes(gId);

                          return (
                            <div
                              key={gId}
                              onClick={() => handleToggleGroupInModal(gId)}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                                isChecked
                                  ? "bg-indigo-50/70 border-indigo-200 text-slate-900"
                                  : "hover:bg-slate-50 border-transparent text-slate-700"
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 overflow-hidden">
                                <div
                                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    isChecked
                                      ? "bg-indigo-600 border-indigo-600 text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden shrink-0">
                                  {g.avatar ? (
                                    <img src={g.avatar} alt={gName} className="w-full h-full object-cover" />
                                  ) : (
                                    <Users className="w-4 h-4 text-indigo-500" />
                                  )}
                                </div>
                                <div className="truncate">
                                  <div className="font-semibold text-xs truncate">{gName}</div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    ID: {gId} {g.totalMember ? `• ${g.totalMember} thành viên` : ""}
                                    {g.isCustomSaved ? " • Đã lưu trước đó" : ""}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>

                  {/* Manual Group ID input */}
                  <div className="pt-2 border-t border-indigo-100 flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Nhập ID nhóm thủ công..."
                      value={manualGroupId}
                      onChange={(e) => setManualGroupId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddManualGroupId();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualGroupId}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0"
                    >
                      Thêm ID
                    </button>
                  </div>
                </div>
              )}

              {/* Specific Prompt for this Account */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lưu ý riêng cho tài khoản này (Specific Prompt)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Chỉ dẫn bổ sung dành riêng cho nick này (ví dụ: xưng hô, phân công nhiệm vụ bộ phận...).
                </p>
                <textarea
                  rows={3}
                  value={modalConfig.specificPrompt}
                  onChange={(e) =>
                    setModalConfig((prev) => ({ ...prev, specificPrompt: e.target.value }))
                  }
                  placeholder="Ví dụ: Bạn là nhân viên phụ trách tư vấn kỹ thuật. Luôn xưng là 'Kỹ thuật viên'..."
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditingAccountModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingAccountConfig}
                onClick={handleSaveAccountModalConfig}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingAccountConfig ? "Đang lưu..." : "Lưu Cấu Hình"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
