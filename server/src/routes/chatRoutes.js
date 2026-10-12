import { Router, Request, Response } from "express";
import { sessionManager } from "../services/sessionManager.js";
import { messageLogRepo } from "../database/db.js";
import { ThreadType } from "zalo-api-final";
import { v4 as uuidv4 } from "uuid";
export const chatRouter = Router();
// GET /api/accounts/:id/friends - Get friend list
chatRouter.get("/:id/friends", async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = sessionManager.getSession(id);
    if (!session) {
        return res.status(400).json({ success: false, error: "Tài khoản chưa được kết nối trực tuyến" });
    }
    try {
        const friends = await session.api.getAllFriends();
        res.json({ success: true, data: friends });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/accounts/:id/groups - Get all groups
chatRouter.get("/:id/groups", async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = sessionManager.getSession(id);
    if (!session) {
        return res.status(400).json({ success: false, error: "Tài khoản chưa được kết nối trực tuyến" });
    }
    try {
        const groups = await session.api.getAllGroups();
        res.json({ success: true, data: groups });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/accounts/:id/history/:threadId - Get local chat history
chatRouter.get("/:id/history/:threadId", (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const threadId = Array.isArray(req.params.threadId) ? req.params.threadId[0] : req.params.threadId;
    const limit = Number(req.query.limit || 50);
    try {
        const history = messageLogRepo.getRecentByThread(id, threadId, limit);
        res.json({ success: true, data: history });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/accounts/:id/send - Send message
chatRouter.post("/:id/send", async (req, res) => {
    var _a;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { toId, message, type = "User" } = req.body;
    if (!toId || !message) {
        return res.status(400).json({ success: false, error: "Thiếu toId hoặc message" });
    }
    const session = sessionManager.getSession(id);
    if (!session) {
        return res.status(400).json({ success: false, error: "Tài khoản chưa được kết nối trực tuyến" });
    }
    try {
        const threadType = type === "Group" ? ThreadType.Group : ThreadType.User;
        const result = await session.api.sendMessage(message, toId, threadType);
        // Save to message log
        const log = {
            id: uuidv4(),
            accountId: id,
            threadId: String(toId),
            threadType: String(type),
            senderId: session.info.uid,
            content: typeof message === "string" ? message : JSON.stringify(message),
            msgId: String(((_a = result === null || result === void 0 ? void 0 : result.message) === null || _a === void 0 ? void 0 : _a.msgId) || ""),
            timestamp: Date.now(),
            isSelf: 1,
        };
        messageLogRepo.insert(log);
        res.json({ success: true, data: result, log });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/chat/broadcast - Send broadcast campaign
chatRouter.post("/broadcast", async (req, res) => {
    const { accountIds, recipients, message, delayMs = 1500 } = req.body;
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({ success: false, error: "Cần chọn ít nhất 1 tài khoản gửi" });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ success: false, error: "Cần chọn ít nhất 1 người/nhóm nhận" });
    }
    if (!message) {
        return res.status(400).json({ success: false, error: "Nội dung tin nhắn không được để trống" });
    }
    // Verify all accounts exist and are online
    const activeSenders = accountIds
        .map((accId) => sessionManager.getSession(accId))
        .filter((s) => Boolean(s && s.status === "ONLINE"));
    if (activeSenders.length === 0) {
        return res.status(400).json({ success: false, error: "Không có tài khoản nào được chọn đang online" });
    }
    const results = [];
    // Distribute send operations across available sender accounts
    let senderIndex = 0;
    for (const recipient of recipients) {
        const sender = activeSenders[senderIndex % activeSenders.length];
        senderIndex++;
        const toId = typeof recipient === "string" ? recipient : recipient.id;
        const isGroup = typeof recipient === "object" && recipient.isGroup;
        const threadType = isGroup ? ThreadType.Group : ThreadType.User;
        try {
            await sender.api.sendMessage(message, toId, threadType);
            results.push({
                recipientId: toId,
                senderId: sender.info.uid,
                status: "SUCCESS",
            });
        }
        catch (err) {
            results.push({
                recipientId: toId,
                senderId: sender.info.uid,
                status: "FAILED",
                error: (err === null || err === void 0 ? void 0 : err.message) || "Send failed",
            });
        }
        // Delay between sends to prevent Zalo rate-limiting
        if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    const successCount = results.filter((r) => r.status === "SUCCESS").length;
    res.json({
        success: true,
        summary: {
            total: recipients.length,
            success: successCount,
            failed: recipients.length - successCount,
        },
        details: results,
    });
});
