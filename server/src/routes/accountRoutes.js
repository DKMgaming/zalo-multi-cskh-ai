import { Router, Request, Response } from "express";
import { sessionManager } from "../services/sessionManager.js";
import { accountRepo } from "../database/db.js";
export const accountRouter = Router();
// GET /api/accounts - List all accounts
accountRouter.get("/", (_req, res) => {
    try {
        const accounts = sessionManager.getAllAccountStates();
        res.json({ success: true, data: accounts });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/accounts/:id/reconnect - Reconnect account
accountRouter.post("/:id/reconnect", async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const account = accountRepo.getById(id);
    if (!account) {
        return res.status(404).json({ success: false, error: "Tài khoản không tồn tại" });
    }
    try {
        const session = await sessionManager.connectAccount(account);
        res.json({
            success: true,
            data: {
                id: session.id,
                uid: session.info.uid,
                name: session.info.name,
                status: session.status,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || "Kết nối lại thất bại" });
    }
});
// DELETE /api/accounts/:id - Disconnect and delete account
accountRouter.delete("/:id", async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
        await sessionManager.removeAccount(id);
        res.json({ success: true, message: "Đã xóa tài khoản thành công" });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/accounts/:id/info - Get detailed profile
accountRouter.get("/:id/info", async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = sessionManager.getSession(id);
    if (!session) {
        return res.status(400).json({ success: false, error: "Tài khoản chưa được kết nối" });
    }
    try {
        const profile = await session.api.fetchAccountInfo();
        res.json({ success: true, data: profile });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
