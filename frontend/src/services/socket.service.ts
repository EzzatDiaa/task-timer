// src/services/socket.service.ts
import { io, Socket } from "socket.io-client";
import { useEffect, useState } from "react";

// The base API URL
const SOCKET_URL = "http://localhost:3001";
let socket: Socket | null = null;
let socketInitialized = false;

export const initializeSocket = (token: string) => {
  if (socket && socket.connected) {
    console.log("Socket already connected", socket.id);
    return socket;
  }

  console.log("Connecting to socket server:", SOCKET_URL);

  socket = io(SOCKET_URL, {
    query: { token },
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("Socket connected with ID:", socket.id);
    socketInitialized = true;
  });

  // Listen for all events (for debugging)
  socket.onAny((event, ...args) => {
    console.log(`[Socket] Event ${event}:`, args);
  });

  socket.on("timer:update", (data) => {
    console.log("[Socket] Timer update:", data);
  });

  socket.on("notification", (data) => {
    console.log("[Socket] Notification:", data);

    // Play notification sound
    try {
      const audio = new Audio("/notification.mp3");
      audio
        .play()
        .catch((e) => console.error("Failed to play notification sound:", e));
    } catch (e) {
      console.error("Error playing notification sound:", e);
    }

    // Show browser notification if available
    if (Notification && Notification.permission === "granted") {
      try {
        new Notification(data.title, { body: data.message });
      } catch (e) {
        console.error("Error showing notification:", e);
      }
    }
  });

  return socket;
};

// Add this function to get the current socket instance
export const getSocket = (): Socket | null => {
  return socket;
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketInitialized = false;
  }
};

// Custom hook to use socket connection
export const useSocket = (token: string | null) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = initializeSocket(token);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // Set initial connection state
    setIsConnected(socket.connected);

    // Cleanup listeners when component unmounts
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [token]);

  return { isConnected };
};
