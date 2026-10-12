import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
    aiSettingsRepo,
    accountAiConfigRepo,
    knowledgeRepo,
    conversationAiStateRepo,
    type KnowledgeItemRecord,
} from "../database/db.js";
import { ragService } from "../services/ragService.js";
import { aiAgentService } from "../services/aiAgentService.js";
import { pineconeService } from "../services/pineconeService.js";
import { docExtractorService } from "../services/docExtractorService.js";
import multer from "multer";

export const aiRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

// ==========================================
// 1. AI Global Settings
// ==========================================
aiRouter.get("/settings", (_req: Request, res: Response) => {
    try {
        const settings = aiSettingsRepo.get();
        res.json({ success: true, data: settings });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

aiRouter.post("/settings", (req: Request, res: Response) => {
    try {
        const { provider, apiKey, baseURL, model, systemPrompt, temperature, isGlobalEnabled, replyDelaySeconds } = req.body;
        const updated = aiSettingsRepo.update({
            provider,
            apiKey,
            baseURL,
            model,
            systemPrompt,
            temperature: typeof temperature === "number" ? temperature : undefined,
            isGlobalEnabled: typeof isGlobalEnabled === "number" ? isGlobalEnabled : undefined,
            replyDelaySeconds: typeof replyDelaySeconds === "number" ? replyDelaySeconds : undefined,
        });
        res.json({ success: true, data: updated });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 2. Per-Account AI Config
// ==========================================
aiRouter.get("/account-configs", (_req: Request, res: Response) => {
    try {
        const configs = accountAiConfigRepo.getAll();
        res.json({ success: true, data: configs });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

aiRouter.get("/account-configs/:accountId", (req: Request, res: Response) => {
    try {
        const accountId = String(req.params.accountId);
        const config = accountAiConfigRepo.get(accountId);
        res.json({ success: true, data: config });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

aiRouter.post("/account-configs/:accountId", (req: Request, res: Response) => {
    try {
        const accountId = String(req.params.accountId);
        const { isAiEnabled, specificPrompt, replyScope, allowedGroupIds } = req.body;

        let groupsJson = "[]";
        if (Array.isArray(allowedGroupIds)) {
            groupsJson = JSON.stringify(allowedGroupIds);
        } else if (typeof allowedGroupIds === "string") {
            groupsJson = allowedGroupIds;
        }

        const validScope = ["all", "direct_only", "groups_only", "direct_and_selected_groups"].includes(replyScope)
            ? replyScope
            : "all";

        const updated = accountAiConfigRepo.upsert(
            accountId,
            isAiEnabled ? 1 : 0,
            specificPrompt !== undefined ? String(specificPrompt) : "",
            validScope,
            groupsJson
        );
        res.json({ success: true, data: updated });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 3. Knowledge Base Items (FAQ / Docs) & Pinecone Sync
// ==========================================
aiRouter.get("/knowledge", (_req: Request, res: Response) => {
    try {
        const items = knowledgeRepo.getAll();
        res.json({ success: true, data: items });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

aiRouter.post("/knowledge/upload", upload.array("files", 10), async (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, error: "Vui lòng chọn ít nhất 1 file để tải lên" });
        }

        const category = ((req.body.category as string) || "").trim() || "Chung";
        const allCreatedItems: any[] = [];
        const errors: string[] = [];

        for (const file of files) {
            let fileName = file.originalname;
            try {
                const decoded = Buffer.from(file.originalname, "latin1").toString("utf8");
                if (decoded && decoded !== file.originalname) {
                    fileName = decoded;
                }
            } catch {
                fileName = file.originalname;
            }

            try {
                // Bóc tách văn bản và tự động phân đoạn RAG Chunking
                const extractedItems = await docExtractorService.processUploadedFile(
                    file.buffer,
                    fileName,
                    category
                );

                for (const item of extractedItems) {
                    const created = knowledgeRepo.create({
                        id: uuidv4(),
                        type: item.type,
                        title: item.title,
                        content: item.content,
                        category: item.category,
                        keywords: item.keywords,
                        enabled: 1,
                    });

                    // Nạp vector lên Pinecone
                    pineconeService.upsertItem(created).catch((err) => {
                        console.warn(`⚠️ Lỗi sync Pinecone cho đoạn [${created.title}]:`, err?.message || err);
                    });

                    allCreatedItems.push(created);
                }
            } catch (fileErr: any) {
                console.error(`Lỗi bóc tách file ${fileName}:`, fileErr);
                errors.push(`[${fileName}]: ${fileErr?.message || fileErr}`);
            }
        }

        res.json({
            success: true,
            message: `Đã nạp thành công ${allCreatedItems.length} đoạn tri thức từ ${files.length} file vào nhóm "${category}".`,
            processedFiles: files.length,
            createdCount: allCreatedItems.length,
            items: allCreatedItems,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message || "Lỗi xử lý file tải lên" });
    }
});

aiRouter.post("/knowledge", async (req: Request, res: Response) => {
    try {
        const { type, title, content, category, keywords, enabled } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, error: "Tiêu đề và nội dung không được để trống" });
        }

        const newItem = knowledgeRepo.create({
            id: uuidv4(),
            type: type || "faq",
            title,
            content,
            category: category || "Chung",
            keywords: keywords || "",
            enabled: enabled ?? 1,
        });

        // Tự động đẩy vector lên Pinecone
        pineconeService.upsertItem(newItem).catch((err) => {
            console.warn("⚠️ Lỗi đồng bộ Pinecone khi tạo tài liệu:", err?.message || err);
        });

        res.json({ success: true, data: newItem });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

aiRouter.put("/knowledge/:id", async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const updated = knowledgeRepo.update(id, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, error: "Không tìm thấy mục tri thức" });
        }

        // Cập nhật lại vector trên Pinecone
        pineconeService.upsertItem(updated).catch((err) => {
            console.warn("⚠️ Lỗi cập nhật Pinecone:", err?.message || err);
        });

        res.json({ success: true, data: updated });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

aiRouter.delete("/knowledge/:id", async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const existing = knowledgeRepo.getById(id);
        if (existing) {
            pineconeService.deleteItem(id, existing.category).catch((err) => {
                console.warn("⚠️ Lỗi xóa Pinecone vector:", err?.message || err);
            });
        }

        knowledgeRepo.delete(id);
        res.json({ success: true, message: "Đã xóa mục tri thức" });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 3.1 Pinecone Vector Database Management
// ==========================================
aiRouter.get("/pinecone/stats", async (_req: Request, res: Response) => {
    try {
        const stats = await pineconeService.describeStats();
        res.json({ success: true, data: stats });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message || "Lỗi đọc trạng thái Pinecone" });
    }
});

aiRouter.post("/pinecone/sync-all", async (_req: Request, res: Response) => {
    try {
        const activeItems = knowledgeRepo.getActive();
        const result = await pineconeService.syncAll(activeItems);
        res.json({ success: true, data: result });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message || "Lỗi đồng bộ Pinecone" });
    }
});

aiRouter.delete("/pinecone/group/:groupName", async (req: Request, res: Response) => {
    try {
        const groupName = String(req.params.groupName);
        if (!groupName) {
            return res.status(400).json({ success: false, error: "Tên nhóm không hợp lệ" });
        }

        // 1. Xóa toàn bộ vectors trong namespace trên Pinecone
        await pineconeService.deleteGroup(groupName);

        // 2. Xóa các tài liệu thuộc nhóm này trong SQLite
        const deletedCount = knowledgeRepo.deleteByCategory(groupName);

        res.json({
            success: true,
            message: `Đã xóa sạch toàn bộ tài liệu trong nhóm "${groupName}" trên Pinecone và CSDL.`,
            deletedCount,
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message || "Lỗi xóa nhóm trên Pinecone" });
    }
});

// ==========================================
// 4. AI Playground & Query Testing
// ==========================================
aiRouter.post("/test-query", async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query || typeof query !== "string") {
            return res.status(400).json({ success: false, error: "Vui lòng nhập câu hỏi thử nghiệm" });
        }

        const settings = aiSettingsRepo.get();
        if (!settings.apiKey) {
            return res.status(400).json({
                success: false,
                error: "Vui lòng nhập và lưu API Key trước khi thử nghiệm câu hỏi!",
            });
        }

        // 1. Kiểm tra intent takeover
        const isTakeover = aiAgentService.isTakeoverIntent(query);

        // 2. RAG search (Pinecone & Local, TopK = 10, BGE Reranker)
        const matchedKnowledge = await ragService.searchKnowledge(query, 10);
        const knowledgeContext = await ragService.buildKnowledgeContext(query, 10);

        // 3. Generate response
        let reply = "";
        if (isTakeover) {
            reply = "[HỆ THỐNG PHÁT HIỆN YÊU CẦU GẶP NGƯỜI THẬT] -> Bot sẽ chuyển cuộc trò chuyện sang chế độ Nhân viên hỗ trợ và tạm dừng auto-reply.";
        } else {
            reply = await aiAgentService.generateAiResponse({
                settings,
                systemPrompt: settings.systemPrompt,
                knowledgeContext,
                history: [],
                query,
            });
        }

        res.json({
            success: true,
            data: {
                reply,
                isTakeover,
                matchedKnowledge,
                knowledgeContext,
            },
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message || "Lỗi thử nghiệm AI" });
    }
});

// ==========================================
// 5. Conversation AI State (Human Takeover)
// ==========================================
aiRouter.get("/conversations/:accountId/:threadId", (req: Request, res: Response) => {
    try {
        const accountId = String(req.params.accountId);
        const threadId = String(req.params.threadId);
        const state = conversationAiStateRepo.get(accountId, threadId);
        res.json({ success: true, data: state });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

aiRouter.post("/conversations/:accountId/:threadId/takeover", (req: Request, res: Response) => {
    try {
        const accountId = String(req.params.accountId);
        const threadId = String(req.params.threadId);
        const { isHumanTakeover, reason } = req.body;
        const updated = conversationAiStateRepo.setTakeover(
            accountId,
            threadId,
            isHumanTakeover ? 1 : 0,
            reason || ""
        );
        res.json({ success: true, data: updated });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});
