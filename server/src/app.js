import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { initDatabase } from "./database/db.js";
import { sessionManager } from "./services/sessionManager.js";
import { setupSocketIO } from "./socket/index.js";
import { accountRouter } from "./routes/accountRoutes.js";
import { chatRouter } from "./routes/chatRoutes.js";
dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "DELETE", "PUT"],
    },
});
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// Basic health check
app.get("/api/health", (_req, res) => {
    res.json({
        status: "OK",
        name: "Zalo Multi-Account Management Server",
        time: new Date().toISOString(),
    });
});
// Mount Routes
app.use("/api/accounts", accountRouter);
app.use("/api/chat", chatRouter);
// Serve frontend static if client build exists
const clientDistPath = path.resolve(process.cwd(), "../client/dist");
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
            return next();
        }
        res.sendFile(path.join(clientDistPath, "index.html"));
    });
}
// Initialize DB and Socket
initDatabase();
sessionManager.setSocketServer(io);
setupSocketIO(io);
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Zalo Multi-Account Server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO Realtime gateway ready`);
    console.log(`==================================================\n`);
    // Restore sessions in background
    await sessionManager.initAll();
});
