import type { Server, Socket } from "socket.io";
export declare class QRAuthService {
    private sessions;
    private io;
    setSocketServer(io: Server): void;
    startQRSession(socket: Socket): Promise<string>;
    cancelSession(sessionId: string): void;
}
export declare const qrAuthService: QRAuthService;
