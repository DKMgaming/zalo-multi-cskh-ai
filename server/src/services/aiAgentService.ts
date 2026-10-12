import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import {
    aiSettingsRepo,
    accountAiConfigRepo,
    conversationAiStateRepo,
    messageLogRepo,
    type AiSettingsRecord,
} from "../database/db.js";
import { ragService } from "./ragService.js";
import type { ActiveSession } from "./sessionManager.js";
import type { Server } from "socket.io";
import { ThreadType } from "zalo-api-final";

export class AiAgentService {
    private io: Server | null = null;

    public setSocketServer(io: Server) {
        this.io = io;
    }

    /**
     * Danh sách từ khóa báo hiệu khách hàng muốn gặp nhân viên trực tiếp
     */
    private takeoverKeywords = [
        "gặp nhân viên",
        "gặp người",
        "gặp tư vấn viên",
        "tư vấn viên",
        "chăm sóc khách hàng",
        "chuyển máy",
        "gặp quản lý",
        "nói chuyện với người",
        "nhân viên thật",
        "hỗ trợ trực tiếp",
        "gặp ad",
        "gặp admin",
        "chát với người",
        "chat với người",
    ];

    /**
     * Kiểm tra xem tin nhắn có chứa ý định yêu cầu nhân viên can thiệp không
     */
    public isTakeoverIntent(text: string): boolean {
        const lower = text.toLowerCase();
        return this.takeoverKeywords.some((kw) => lower.includes(kw));
    }

    /**
     * Gọi LLM (Google Gemini hoặc OpenAI / DeepSeek / Ollama) để sinh câu trả lời
     */
    public async generateAiResponse(params: {
        settings: AiSettingsRecord;
        systemPrompt: string;
        knowledgeContext: string;
        history: { role: "user" | "assistant"; content: string }[];
        query: string;
    }): Promise<string> {
        const { settings, systemPrompt, knowledgeContext, history, query } = params;

        if (!settings.apiKey) {
            throw new Error("Chưa cấu hình API Key trong mục Cài đặt AI!");
        }

        const combinedSystemPrompt = `${systemPrompt}

==================================================
${knowledgeContext}
==================================================

Hãy trả lời câu hỏi của khách hàng một cách lịch sự, nhã nhặn, tự nhiên và CHÍNH XÁC dựa vào thông tin tri thức trên. Nếu thông tin không có trong tài liệu, hãy báo khách hàng rằng em xin phép ghi nhận để chuyển cho nhân viên tư vấn hỗ trợ chi tiết.`;

        if (settings.provider === "gemini") {
            const genAI = new GoogleGenerativeAI(settings.apiKey);
            const modelName = settings.model || "gemini-1.5-flash";

            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: combinedSystemPrompt,
                generationConfig: {
                    temperature: settings.temperature || 0.7,
                },
            });

            // Format Gemini chat history
            const contents: any[] = [];
            for (const h of history) {
                contents.push({
                    role: h.role === "assistant" ? "model" : "user",
                    parts: [{ text: h.content }],
                });
            }
            contents.push({
                role: "user",
                parts: [{ text: query }],
            });

            const result = await model.generateContent({
                contents,
            });

            const response = await result.response;
            return response.text();
        } else {
            // OpenAI hoặc OpenAI-Compatible (DeepSeek, Groq, Ollama, OpenRouter...)
            const openai = new OpenAI({
                apiKey: settings.apiKey,
                baseURL: settings.baseURL?.trim() || undefined,
            });

            const messages: OpenAI.ChatCompletionMessageParam[] = [
                { role: "system", content: combinedSystemPrompt },
            ];

            for (const h of history) {
                messages.push({
                    role: h.role,
                    content: h.content,
                });
            }

            messages.push({
                role: "user",
                content: query,
            });

            const completion = await openai.chat.completions.create({
                model: settings.model || "gpt-4o-mini",
                messages,
                temperature: settings.temperature || 0.7,
            });

            return completion.choices[0]?.message?.content || "Dạ em đã nhận được tin nhắn của anh/chị ạ!";
        }
    }

    /**
     * Xử lý tin nhắn khách hàng gửi đến từ WebSocket Zalo Listener
     */
    public async handleIncomingMessage(session: ActiveSession, message: any): Promise<void> {
        try {
            // 1. Bỏ qua tin nhắn do chính mình gửi đi
            if (message.isSelf) {
                return;
            }

            const isGroup = message.type === ThreadType.Group || message.type === 1 || String(message.type).toLowerCase() === "group" || message.type === "1";
            const threadId = String(message.threadId || "");
            const threadType = isGroup ? ThreadType.Group : ThreadType.User;
            const threadTypeStr = isGroup ? "Group" : "User";
            const senderId = String(message.data?.uidFrom || "");
            const content = typeof message.data?.content === "string" ? message.data.content.trim() : "";

            // Nếu không có nội dung chữ hoặc tin nhắn trống thì bỏ qua
            if (!content || !threadId) {
                return;
            }

            // 2. Kiểm tra cài đặt toàn cục và tài khoản
            const settings = aiSettingsRepo.get();
            if (!settings.isGlobalEnabled) {
                return;
            }

            const accountConfig = accountAiConfigRepo.get(session.id);
            if (!accountConfig.isAiEnabled) {
                return;
            }

            // 2.1. KIỂM TRA PHẠM VI TRẢ LỜI CỦA NICK (Cá nhân 1-1 / Nhóm chỉ định)
            const replyScope = accountConfig.replyScope || "all";
            let allowedGroupIds: string[] = [];
            try {
                allowedGroupIds = JSON.parse(accountConfig.allowedGroupIds || "[]");
            } catch {
                allowedGroupIds = [];
            }

            if (!isGroup) {
                // Tin nhắn cá nhân (1-1 Direct Message)
                if (replyScope === "groups_only") {
                    console.log(`[AI CSKH] ⏭️ Bỏ qua tin nhắn cá nhân từ ${threadId} (Nick [${session.info.name || session.id}] cấu hình chỉ trả lời nhóm).`);
                    return;
                }
            } else {
                // Tin nhắn nhóm (Group Message)
                if (replyScope === "direct_only") {
                    console.log(`[AI CSKH] ⏭️ Bỏ qua tin nhắn nhóm ${threadId} (Nick [${session.info.name || session.id}] cấu hình chỉ trả lời tin nhắn cá nhân 1-1).`);
                    return;
                }

                if (replyScope === "groups_only" || replyScope === "direct_and_selected_groups") {
                    if (!allowedGroupIds.includes(threadId)) {
                        console.log(`[AI CSKH] ⏭️ Bỏ qua tin nhắn nhóm ${threadId} (Nhóm này không nằm trong ${allowedGroupIds.length} nhóm được chọn của nick [${session.info.name || session.id}]).`);
                        return;
                    }
                }
            }

            // 3. Kiểm tra xem hội thoại này nhân viên có đang tiếp quản không (Human Takeover)
            const convState = conversationAiStateRepo.get(session.id, threadId);
            if (convState.isHumanTakeover) {
                console.log(`[AI] Thread ${threadId} đang do nhân viên tiếp quản. Bỏ qua auto-reply.`);
                return;
            }

            // 4. Kiểm tra xem khách hàng có yêu cầu gặp người thật không
            if (this.isTakeoverIntent(content)) {
                console.log(`[AI Takeover] Phát hiện yêu cầu gặp nhân viên từ thread ${threadId}: "${content}"`);
                conversationAiStateRepo.setTakeover(session.id, threadId, 1, `Khách gửi: "${content}"`);

                const takeoverReply = "Dạ em đã nhận được yêu cầu ạ! Em xin phép chuyển cuộc trò chuyện này cho chuyên viên tư vấn trực tiếp hỗ trợ anh/chị ngay nhé ạ. Anh/chị đợi một chút ạ!";

                // Gửi thông báo chuyển giao cho khách
                await session.api.sendMessage(
                    { msg: takeoverReply },
                    threadId,
                    threadType
                );

                // Ghi log câu trả lời này
                const logRecord = {
                    id: uuidv4(),
                    accountId: session.id,
                    threadId,
                    threadType: threadTypeStr,
                    senderId: session.info.uid,
                    content: takeoverReply,
                    msgId: `ai_${Date.now()}`,
                    timestamp: Date.now(),
                    isSelf: 1,
                };
                messageLogRepo.insert(logRecord);

                // Phát Socket thông báo cho Dashboard
                if (this.io) {
                    this.io.emit("ai:takeover_triggered", {
                        accountId: session.id,
                        accountName: session.info.name,
                        threadId,
                        customerMessage: content,
                        timestamp: Date.now(),
                    });
                    this.io.emit("zalo:message", {
                        accountId: session.id,
                        accountName: session.info.name,
                        message: logRecord,
                    });
                }
                return;
            }

            // 5. Chuẩn bị ngữ cảnh RAG từ Kho tri thức (Pinecone & Local, TopK = 10, BGE Reranker)
            const knowledgeContext = await ragService.buildKnowledgeContext(content, 10);

            // 6. Lấy lịch sử 6 tin nhắn gần nhất
            const recentLogs = messageLogRepo.getRecentByThread(session.id, threadId, 6);
            const history: { role: "user" | "assistant"; content: string }[] = [];

            // Bỏ tin cuối cùng nếu chính là tin vừa nhận để tránh lặp
            const logsBeforeCurrent = recentLogs.slice(0, -1);
            for (const log of logsBeforeCurrent) {
                if (log.content && typeof log.content === "string") {
                    history.push({
                        role: log.isSelf ? "assistant" : "user",
                        content: log.content,
                    });
                }
            }

            // Kết hợp Prompt chung và Prompt riêng của nick
            let effectivePrompt = settings.systemPrompt;
            if (accountConfig.specificPrompt && accountConfig.specificPrompt.trim()) {
                effectivePrompt += `\n\n[LƯU Ý RIÊNG CHO TÀI KHOẢN NÀY]:\n${accountConfig.specificPrompt.trim()}`;
            }

            console.log(`🤖 [AI CSKH] Đang sinh câu trả lời cho thread ${threadId} [${threadTypeStr}] (query: "${content}")...`);

            // Gửi tín hiệu đang gõ typing nếu Zalo hỗ trợ
            try {
                if (typeof (session.api as any).sendTypingEvent === "function") {
                    await (session.api as any).sendTypingEvent(threadId, threadType);
                }
            } catch (e) {
                // Ignore typing event error
            }

            // 7. Gọi LLM
            const aiReply = await this.generateAiResponse({
                settings,
                systemPrompt: effectivePrompt,
                knowledgeContext,
                history,
                query: content,
            });

            // Delay giả lập người gõ tự nhiên (1 - 3 giây)
            const delaySec = Math.max(1, settings.replyDelaySeconds || 2);
            await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));

            // 8. Gửi phản hồi qua Zalo
            await session.api.sendMessage(
                { msg: aiReply },
                threadId,
                threadType
            );

            console.log(`✅ [AI CSKH] Đã trả lời tự động cho ${threadId} [${threadTypeStr}]: "${aiReply.substring(0, 60)}..."`);

            // 9. Ghi log vào SQLite
            const aiLogRecord = {
                id: uuidv4(),
                accountId: session.id,
                threadId,
                threadType: threadTypeStr,
                senderId: session.info.uid,
                content: aiReply,
                msgId: `ai_${Date.now()}`,
                timestamp: Date.now(),
                isSelf: 1,
            };
            messageLogRepo.insert(aiLogRecord);

            // 10. Bắn Socket cho Dashboard hiển thị tin nhắn vừa gửi
            if (this.io) {
                this.io.emit("zalo:message", {
                    accountId: session.id,
                    accountName: session.info.name,
                    message: aiLogRecord,
                });
            }
        } catch (error: any) {
            console.error("❌ [AI CSKH Error]:", error?.message || error);
        }
    }
}

export const aiAgentService = new AiAgentService();
