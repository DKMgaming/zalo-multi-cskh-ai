import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

// Attach Authorization Bearer token to all outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zalo_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handling - automatically clears token if unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("zalo_admin_token");
      localStorage.removeItem("zalo_admin_user");
      // Trigger a custom event or let state reflect it
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export interface Account {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  phone?: string;
  status: "ONLINE" | "OFFLINE" | "ERROR";
  isOnline: boolean;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Friend {
  userId: string;
  displayName: string;
  avatar: string;
  phoneNumber?: string;
}

export interface Group {
  groupId: string;
  groupName: string;
  avatar: string;
  totalMember: number;
}

export interface ChatMessage {
  id: string;
  accountId: string;
  threadId: string;
  threadType: string;
  senderId: string;
  content: string;
  msgId?: string;
  timestamp: number;
  isSelf: number;
}

export const accountsApi = {
  getAll: async (): Promise<Account[]> => {
    const res = await api.get<{ success: boolean; data: Account[] }>("/accounts");
    return res.data.data;
  },

  reconnect: async (id: string): Promise<void> => {
    await api.post(`/accounts/${id}/reconnect`);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/accounts/${id}`);
  },

  getFriends: async (id: string): Promise<any> => {
    const res = await api.get<{ success: boolean; data: any }>(`/chat/${id}/friends`);
    return res.data.data;
  },

  getGroups: async (id: string): Promise<any> => {
    const res = await api.get<{ success: boolean; data: any }>(`/chat/${id}/groups`);
    return res.data.data;
  },

  getHistory: async (id: string, threadId: string): Promise<ChatMessage[]> => {
    const res = await api.get<{ success: boolean; data: ChatMessage[] }>(`/chat/${id}/history/${threadId}`);
    return res.data.data;
  },

  sendMessage: async (id: string, toId: string, message: string, type: "User" | "Group" = "User") => {
    const res = await api.post(`/chat/${id}/send`, { toId, message, type });
    return res.data;
  },

  broadcast: async (accountIds: string[], recipients: any[], message: string, delayMs = 1500) => {
    const res = await api.post("/chat/broadcast", { accountIds, recipients, message, delayMs });
    return res.data;
  },
};

export interface AiSettings {
  id: string;
  provider: "gemini" | "openai";
  apiKey: string;
  baseURL: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  isGlobalEnabled: number;
  replyDelaySeconds: number;
  updatedAt: string;
}

export type ReplyScopeType = "all" | "direct_only" | "groups_only" | "direct_and_selected_groups";

export interface AccountAiConfig {
  accountId: string;
  isAiEnabled: number;
  specificPrompt: string;
  replyScope: ReplyScopeType;
  allowedGroupIds: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: string;
  type: "faq" | "doc";
  title: string;
  content: string;
  category: string;
  keywords: string;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestQueryResult {
  reply: string;
  isTakeover: boolean;
  matchedKnowledge: Array<{
    item: KnowledgeItem;
    score: number;
    matchReasons: string[];
  }>;
  knowledgeContext: string;
}

export const aiApi = {
  getSettings: async (): Promise<AiSettings> => {
    const res = await api.get<{ success: boolean; data: AiSettings }>("/ai/settings");
    return res.data.data;
  },

  updateSettings: async (settings: Partial<AiSettings>): Promise<AiSettings> => {
    const res = await api.post<{ success: boolean; data: AiSettings }>("/ai/settings", settings);
    return res.data.data;
  },

  getAccountConfigs: async (): Promise<AccountAiConfig[]> => {
    const res = await api.get<{ success: boolean; data: AccountAiConfig[] }>("/ai/account-configs");
    return res.data.data;
  },

  getAccountConfig: async (accountId: string): Promise<AccountAiConfig> => {
    const res = await api.get<{ success: boolean; data: AccountAiConfig }>(`/ai/account-configs/${accountId}`);
    return res.data.data;
  },

  updateAccountConfig: async (
    accountId: string,
    data: {
      isAiEnabled?: boolean;
      specificPrompt?: string;
      replyScope?: ReplyScopeType;
      allowedGroupIds?: string[] | string;
    }
  ): Promise<AccountAiConfig> => {
    const res = await api.post<{ success: boolean; data: AccountAiConfig }>(`/ai/account-configs/${accountId}`, data);
    return res.data.data;
  },

  getKnowledge: async (): Promise<KnowledgeItem[]> => {
    const res = await api.get<{ success: boolean; data: KnowledgeItem[] }>("/ai/knowledge");
    return res.data.data;
  },

  createKnowledge: async (item: Omit<KnowledgeItem, "id" | "createdAt" | "updatedAt">): Promise<KnowledgeItem> => {
    const res = await api.post<{ success: boolean; data: KnowledgeItem }>("/ai/knowledge", item);
    return res.data.data;
  },

  updateKnowledge: async (id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem> => {
    const res = await api.put<{ success: boolean; data: KnowledgeItem }>(`/ai/knowledge/${id}`, updates);
    return res.data.data;
  },

  deleteKnowledge: async (id: string): Promise<void> => {
    await api.delete(`/ai/knowledge/${id}`);
  },

  testQuery: async (query: string): Promise<TestQueryResult> => {
    const res = await api.post<{ success: boolean; data: TestQueryResult }>("/ai/test-query", { query });
    return res.data.data;
  },

  getConversationState: async (accountId: string, threadId: string): Promise<{ isHumanTakeover: number; takeoverReason?: string }> => {
    const res = await api.get<{ success: boolean; data: any }>(`/ai/conversations/${accountId}/${threadId}`);
    return res.data.data;
  },

  setTakeover: async (accountId: string, threadId: string, isHumanTakeover: boolean, reason = ""): Promise<any> => {
    const res = await api.post(`/ai/conversations/${accountId}/${threadId}/takeover`, { isHumanTakeover, reason });
    return res.data.data;
  },

  getPineconeStats: async (): Promise<PineconeStats> => {
    const res = await api.get<{ success: boolean; data: PineconeStats }>("/ai/pinecone/stats");
    return res.data.data;
  },

  syncAllToPinecone: async (): Promise<{ syncedCount: number; errors: string[] }> => {
    const res = await api.post<{ success: boolean; data: { syncedCount: number; errors: string[] } }>("/ai/pinecone/sync-all");
    return res.data.data;
  },

  deleteGroup: async (groupName: string): Promise<{ deletedCount: number; message: string }> => {
    const res = await api.delete<{ success: boolean; deletedCount: number; message: string }>(`/ai/pinecone/group/${encodeURIComponent(groupName)}`);
    return res.data;
  },

  uploadFiles: async (
    files: File[],
    category: string
  ): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("category", category);

    const res = await api.post<{
      success: boolean;
      message: string;
      createdCount: number;
      errors?: string[];
    }>("/ai/knowledge/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },
};

export interface PineconeStats {
  host: string;
  indexName: string;
  model: string;
  rerankModel?: string;
  dimension: number;
  totalRecordCount: number;
  namespaces: Record<string, { recordCount: number }>;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
}

export const authApi = {
  login: async (username: string, password: string): Promise<{ token: string; user: AuthUser }> => {
    const res = await api.post<{ success: boolean; data: { token: string; user: AuthUser } }>("/auth/login", {
      username,
      password,
    });
    return res.data.data;
  },

  getMe: async (): Promise<{ user: AuthUser }> => {
    const res = await api.get<{ success: boolean; data: { user: AuthUser } }>("/auth/me");
    return res.data.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.post<{ success: boolean; message: string }>("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return res.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("zalo_admin_token");
      localStorage.removeItem("zalo_admin_user");
    }
  },
};



