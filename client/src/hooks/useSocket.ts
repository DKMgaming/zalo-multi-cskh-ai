import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to Realtime Gateway:", socket.id);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
