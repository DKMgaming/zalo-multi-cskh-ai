import React from "react";
import type { Socket } from "socket.io-client";
interface QRModalProps {
    isOpen: boolean;
    onClose: () => void;
    socket: Socket | null;
    onSuccess: () => void;
}
export declare const QRModal: React.FC<QRModalProps>;
export {};
