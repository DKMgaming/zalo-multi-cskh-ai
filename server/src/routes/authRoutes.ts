import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { adminUserRepo } from "../database/db.js";
import { generateToken, requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";

export const authRouter = Router();

// Rate limiter for login: OWASP brute-force defense (max 10 requests / 15 minutes per IP)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau 15 phút."
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
authRouter.post("/login", loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: "Vui lòng nhập tên đăng nhập và mật khẩu."
            });
        }

        const admin = adminUserRepo.getByUsername(username.trim());
        if (!admin) {
            // Generic error message to prevent username enumeration
            return res.status(401).json({
                success: false,
                error: "Tên đăng nhập hoặc mật khẩu không chính xác."
            });
        }

        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: "Tên đăng nhập hoặc mật khẩu không chính xác."
            });
        }

        const token = generateToken({
            id: admin.id,
            username: admin.username,
            name: admin.name
        });

        return res.json({
            success: true,
            data: {
                token,
                user: {
                    id: admin.id,
                    username: admin.username,
                    name: admin.name
                }
            }
        });
    } catch (err: any) {
        console.error("Login error:", err);
        return res.status(500).json({
            success: false,
            error: "Đã xảy ra lỗi trong quá trình đăng nhập."
        });
    }
});

/**
 * GET /api/auth/me
 * Returns current admin information
 */
authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
    return res.json({
        success: true,
        data: {
            user: req.user
        }
    });
});

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
authRouter.post("/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới."
            });
        }

        if (typeof newPassword !== "string" || newPassword.length < 5) {
            return res.status(400).json({
                success: false,
                error: "Mật khẩu mới phải có ít nhất 5 ký tự."
            });
        }

        const adminId = req.user!.id;
        const admin = adminUserRepo.getById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                error: "Tài khoản quản trị không tồn tại."
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                error: "Mật khẩu hiện tại không chính xác."
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                error: "Mật khẩu mới không được trùng với mật khẩu hiện tại."
            });
        }

        const salt = await bcrypt.genSalt(12);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        adminUserRepo.updatePassword(adminId, newPasswordHash);

        return res.json({
            success: true,
            message: "Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới."
        });
    } catch (err: any) {
        console.error("Change password error:", err);
        return res.status(500).json({
            success: false,
            error: "Lỗi hệ thống khi đổi mật khẩu."
        });
    }
});

/**
 * POST /api/auth/logout
 */
authRouter.post("/logout", (_req, res) => {
    return res.json({
        success: true,
        message: "Đăng xuất thành công."
    });
});
