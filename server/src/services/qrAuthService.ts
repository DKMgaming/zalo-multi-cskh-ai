import { Zalo, LoginQRCallbackEventType } from "zalo-api-final";
import { v4 as uuidv4 } from "uuid";
import type { Server, Socket } from "socket.io";
import { accountRepo } from "../database/db.js";
import { sessionManager } from "./sessionManager.js";

interface QRSessionState {
    sessionId: string;
    abortFn?: () => void;
    retryFn?: () => void;
    socketId: string;
}

export class QRAuthService {
    private sessions: Map<string, QRSessionState> = new Map();
    private io: Server | null = null;

    public setSocketServer(io: Server) {
        this.io = io;
    }

    public async startQRSession(socket: Socket): Promise<string> {
        const sessionId = uuidv4();
        console.log(`📱 Starting new QR login session: ${sessionId} for socket ${socket.id}`);

        const sessionState: QRSessionState = {
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
            const credentialsHolder: { current: { cookie: any; imei: string; userAgent: string } | null } = { current: null };

            try {
                const api = await zalo.loginQR(
                    {
                        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                        language: "vi",
                    },
                    (event: any) => {
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
                                const loginData = event.data as { cookie: any; imei: string; userAgent: string };
                                credentialsHolder.current = {
                                    cookie: loginData.cookie,
                                    imei: loginData.imei,
                                    userAgent: loginData.userAgent,
                                };
                                break;
                            }
                        }
                    }
                );

                if (!api) {
                    throw new Error("Không thể khởi tạo API từ phiên QR");
                }

                // API is ready, retrieve user information
                const ownId = (api as any).getOwnId ? (api as any).getOwnId() : "";
                let displayName = `Zalo User ${ownId}`;
                let avatarUrl = "";
                let phoneNumber = "";

                try {
                    const profileRes = await api.fetchAccountInfo();
                    if (profileRes && (profileRes as any).data) {
                        const pData = (profileRes as any).data;
                        displayName = pData.display_name || displayName;
                        avatarUrl = pData.avatar || "";
                        phoneNumber = pData.phone_number || "";
                    }
                } catch (e) {
                    // Profile fetch fallback
                }

                const uid = ownId || String(Date.now());
                const accountRecord = accountRepo.upsert({
                    id: uuidv4(),
                    uid,
                    name: displayName,
                    avatar: avatarUrl,
                    phone: phoneNumber,
                    imei: credentialsHolder.current?.imei || "",
                    userAgent: credentialsHolder.current?.userAgent || "",
                    cookie: JSON.stringify(credentialsHolder.current?.cookie || []),
                    status: "ONLINE",
                });

                // Attach to sessionManager
                sessionManager.addActiveSession(accountRecord, api);

                console.log(`🎉 Account ${displayName} (${uid}) connected and saved successfully!`);
                socket.emit("qr:success", {
                    sessionId,
                    account: {
                        ...accountRecord,
                        cookie: undefined,
                    },
                });

                this.sessions.delete(sessionId);
            } catch (err: any) {
                console.error(`❌ QR Login error for session ${sessionId}:`, err?.message || err);
                socket.emit("qr:error", {
                    sessionId,
                    message: err?.message || "Đăng nhập QR thất bại hoặc bị hủy",
                });
                this.sessions.delete(sessionId);
            }
        })();

        return sessionId;
    }

    public cancelSession(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (session && session.abortFn) {
            try {
                session.abortFn();
            } catch (e) {
                // Ignore
            }
            this.sessions.delete(sessionId);
        }
    }
}

export const qrAuthService = new QRAuthService();
