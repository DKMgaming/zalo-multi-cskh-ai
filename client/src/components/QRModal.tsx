import React, { useEffect, useState } from "react";
import { X, RefreshCw, CheckCircle2, AlertCircle, QrCode } from "lucide-react";
import type { Socket } from "socket.io-client";

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  onSuccess: () => void;
}

type QRStatus = "LOADING" | "GENERATED" | "SCANNED" | "SUCCESS" | "EXPIRED" | "ERROR";

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  socket,
  onSuccess,
}) => {
  const [status, setStatus] = useState<QRStatus>("LOADING");
  const [qrImage, setQrImage] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [scannedUser, setScannedUser] = useState<{ name: string; avatar: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!isOpen || !socket) return;

    // Reset state
    setStatus("LOADING");
    setQrImage("");
    setScannedUser(null);
    setErrorMessage("");

    // Start QR login
    socket.emit("qr:start");

    const handleGenerated = (data: { sessionId: string; qrImage: string }) => {
      setSessionId(data.sessionId);
      setQrImage(data.qrImage);
      setStatus("GENERATED");
    };

    const handleScanned = (data: { name: string; avatar: string }) => {
      setScannedUser(data);
      setStatus("SCANNED");
    };

    const handleExpired = () => {
      setStatus("EXPIRED");
    };

    const handleDeclined = () => {
      setStatus("ERROR");
      setErrorMessage("Yêu cầu đăng nhập đã bị từ chối trên điện thoại.");
    };

    const handleSuccess = () => {
      setStatus("SUCCESS");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    };

    const handleError = (data: { message: string }) => {
      setStatus("ERROR");
      setErrorMessage(data.message || "Đã xảy ra lỗi khi tạo mã QR");
    };

    socket.on("qr:generated", handleGenerated);
    socket.on("qr:scanned", handleScanned);
    socket.on("qr:expired", handleExpired);
    socket.on("qr:declined", handleDeclined);
    socket.on("qr:success", handleSuccess);
    socket.on("qr:error", handleError);

    return () => {
      socket.off("qr:generated", handleGenerated);
      socket.off("qr:scanned", handleScanned);
      socket.off("qr:expired", handleExpired);
      socket.off("qr:declined", handleDeclined);
      socket.off("qr:success", handleSuccess);
      socket.off("qr:error", handleError);
    };
  }, [isOpen, socket]);

  const handleCancel = () => {
    if (socket && sessionId) {
      socket.emit("qr:cancel", { sessionId });
    }
    onClose();
  };

  const handleRetry = () => {
    if (socket) {
      setStatus("LOADING");
      socket.emit("qr:start");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-lg">
              Thêm tài khoản Zalo mới
            </h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center text-center">
          {status === "LOADING" && (
            <div className="py-12 flex flex-col items-center">
              <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-600 font-medium text-sm">
                Đang tạo mã QR bảo mật từ máy chủ Zalo...
              </p>
            </div>
          )}

          {status === "GENERATED" && (
            <div className="flex flex-col items-center">
              <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-blue-200 shadow-inner mb-4">
                <img
                  src={qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`}
                  alt="Zalo QR Code"
                  className="w-64 h-64 object-contain rounded-lg"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 mb-2 max-w-xs">
                Mở ứng dụng <strong>Zalo</strong> trên điện thoại &rarr; Chọn biểu tượng <strong>Quét mã QR</strong> để đăng nhập.
              </div>
              <p className="text-xs text-slate-400">
                Mã sẽ tự động làm mới khi hết hạn
              </p>
            </div>
          )}

          {status === "SCANNED" && scannedUser && (
            <div className="py-8 flex flex-col items-center">
              <div className="relative mb-4">
                <img
                  src={scannedUser.avatar || "https://stc-zaloprofile.zdn.vn/default-avatar.jpg"}
                  alt={scannedUser.name}
                  className="w-20 h-20 rounded-full border-4 border-blue-100 shadow-md object-cover"
                />
                <span className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white text-xs">
                  ✓
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-base mb-1">
                {scannedUser.name}
              </h4>
              <p className="text-sm text-slate-600 max-w-xs animate-pulse">
                Đã quét mã! Vui lòng bấm <strong>[Đăng nhập]</strong> trên điện thoại để xác nhận.
              </p>
            </div>
          )}

          {status === "SUCCESS" && (
            <div className="py-10 flex flex-col items-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-3 animate-bounce" />
              <h4 className="font-bold text-slate-900 text-lg mb-1">
                Đăng nhập thành công!
              </h4>
              <p className="text-sm text-slate-500">
                Đã lưu phiên kết nối và sẵn sàng hoạt động.
              </p>
            </div>
          )}

          {status === "EXPIRED" && (
            <div className="py-10 flex flex-col items-center">
              <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-base mb-1">
                Mã QR đã hết hạn
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Vui lòng bấm nút bên dưới để tạo mã mới.
              </p>
              <button
                onClick={handleRetry}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-blue-500/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tạo lại mã QR</span>
              </button>
            </div>
          )}

          {status === "ERROR" && (
            <div className="py-10 flex flex-col items-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 text-base mb-1">
                Đăng nhập thất bại
              </h4>
              <p className="text-xs text-rose-600 mb-4">
                {errorMessage || "Không thể kết nối tới Zalo"}
              </p>
              <button
                onClick={handleRetry}
                className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thử lại</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
