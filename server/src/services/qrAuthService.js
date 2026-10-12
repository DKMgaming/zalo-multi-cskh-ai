import { Zalo, LoginQRCallbackEventType } from "zalo-api-final";
import { v4 as uuidv4 } from "uuid";
import { accountRepo } from "../database/db.js";
import { sessionManager } from "./sessionManager.js";
export class QRAuthService {
    constructor() {
        this.sessions = new Map();
        this.io = null;
    }
    setSocketServer(io) {
        this.io = io;
    }
    async startQRSession(socket) {
        const sessionId = uuidv4();
        console.log(`📱 Starting new QR login session: ${sessionId} for socket ${socket.id}`);
        const sessionState = {
            sessionId,
            socketId: socket.id,
        };
        this.sessions.set(sessionId, sessionState);
        const zalo = new Zalo({
            logging: false,
            selfListen: false,
        });
        // Run loginQR in background
        (async () => {
            var _a, _b, _c;
            const credentialsHolder = { current: null };
            try {
                const api = await zalo.loginQR({
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                    language: "vi",
                }, (event) => {
                    // Keep track of abort and retry actions
                    if (event && "actions" in event && event.actions) {
                        sessionState.abortFn = event.actions.abort;
                        sessionState.retryFn = event.actions.retry;
                    }
                    switch (event.type) {
                        case LoginQRCallbackEventType.QRCodeGenerated: {
                            const rawImage = String(event.data.image || "");
                            const formattedImage = rawImage.startsWith("data:")
                                ? rawImage
                                : `data:image/png;base64,${rawImage}`;
                            console.log(`📷 QR Code generated for session ${sessionId} (length: ${rawImage.length})`);
                            socket.emit("qr:generated", {
                                sessionId,
                                qrImage: formattedImage,
                            });
                            break;
                        }
                        case LoginQRCallbackEventType.QRCodeScanned: {
                            console.log(`👀 QR Code scanned by user: ${event.data.display_name}`);
                            socket.emit("qr:scanned", {
                                sessionId,
                                avatar: event.data.avatar,
                                name: event.data.display_name,
                            });
                            break;
                        }
                        case LoginQRCallbackEventType.QRCodeExpired: {
                            console.log(`⌛ QR Code expired for session ${sessionId}`);
                            socket.emit("qr:expired", { sessionId });
                            break;
                        }
                        case LoginQRCallbackEventType.QRCodeDeclined: {
                            console.log(`❌ QR Code declined for session ${sessionId}`);
                            socket.emit("qr:declined", { sessionId });
                            break;
                        }
                        case LoginQRCallbackEventType.GotLoginInfo: {
                            console.log(`🔑 Received login info for session ${sessionId}`);
                            const loginData = event.data;
                            credentialsHolder.current = {
                                cookie: loginData.cookie,
                                imei: loginData.imei,
                                userAgent: loginData.userAgent,
                            };
                            break;
                        }
                    }
                });
                if (!api) {
                    throw new Error("Không thể khởi tạo API từ phiên QR");
                }
                // API is ready, retrieve user information
                const ownId = api.getOwnId ? api.getOwnId() : "";
                let displayName = `Zalo User ${ownId}`;
                let avatarUrl = "";
                let phoneNumber = "";
                try {
                    const profileRes = await api.fetchAccountInfo();
                    if (profileRes && profileRes.data) {
                        const pData = profileRes.data;
                        displayName = pData.display_name || displayName;
                        avatarUrl = pData.avatar || "";
                        phoneNumber = pData.phone_number || "";
                    }
                }
                catch (e) {
                    // Profile fetch fallback
                }
                const uid = ownId || String(Date.now());
                const accountRecord = accountRepo.upsert({
                    id: uuidv4(),
                    uid,
                    name: displayName,
                    avatar: avatarUrl,
                    phone: phoneNumber,
                    imei: ((_a = credentialsHolder.current) === null || _a === void 0 ? void 0 : _a.imei) || "",
                    userAgent: ((_b = credentialsHolder.current) === null || _b === void 0 ? void 0 : _b.userAgent) || "",
                    cookie: JSON.stringify(((_c = credentialsHolder.current) === null || _c === void 0 ? void 0 : _c.cookie) || []),
                    status: "ONLINE",
                });
                // Attach to sessionManager
                sessionManager.addActiveSession(accountRecord, api);
                console.log(`🎉 Account ${displayName} (${uid}) connected and saved successfully!`);
                socket.emit("qr:success", {
                    sessionId,
                    account: Object.assign(Object.assign({}, accountRecord), { cookie: undefined }),
                });
                this.sessions.delete(sessionId);
            }
            catch (err) {
                console.error(`❌ QR Login error for session ${sessionId}:`, (err === null || err === void 0 ? void 0 : err.message) || err);
                socket.emit("qr:error", {
                    sessionId,
                    message: (err === null || err === void 0 ? void 0 : err.message) || "Đăng nhập QR thất bại hoặc bị hủy",
                });
                this.sessions.delete(sessionId);
            }
        })();
        return sessionId;
    }
    cancelSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.abortFn) {
            try {
                session.abortFn();
            }
            catch (e) {
                // Ignore
            }
            this.sessions.delete(sessionId);
        }
    }
}
export const qrAuthService = new QRAuthService();
