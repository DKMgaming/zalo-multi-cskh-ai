import { Server, Socket } from "socket.io";
import { qrAuthService } from "../services/qrAuthService.js";
export function setupSocketIO(io) {
    qrAuthService.setSocketServer(io);
    io.on("connection", (socket) => {
        console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);
        socket.on("qr:start", async () => {
            try {
                await qrAuthService.startQRSession(socket);
            }
            catch (err) {
                socket.emit("qr:error", { message: (err === null || err === void 0 ? void 0 : err.message) || "Không thể tạo phiên quét QR" });
            }
        });
        socket.on("qr:cancel", ({ sessionId }) => {
            if (sessionId) {
                qrAuthService.cancelSession(sessionId);
            }
        });
        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected from Socket.IO: ${socket.id}`);
        });
    });
}
