// components/ws/BaseWebSocketProvider.jsx
"use client";
import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
} from "react";

export const WSContext = createContext({ ws: null, sendJSON: () => {} });
export const useWS = () => useContext(WSContext);
export function BaseWebSocketProvider({ username, role, children, onMessage }) {
  const wsRef = useRef(null);

  /* connect */
  useEffect(() => {
    const url = `${
      process.env.NEXT_PUBLIC_API_WS || "ws://localhost:4000"
    }/ws/${username}?role=${role}`;
    const socket = new WebSocket(url);
    wsRef.current = socket;

    if (onMessage) socket.addEventListener("message", onMessage);
    return () => socket.close();
  }, [username, role, onMessage]);

  /* helper */
  const sendJSON = useCallback((d) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(d));
  }, []);

  return (
    <WSContext.Provider value={{ ws: wsRef.current, sendJSON }}>
      {children}
    </WSContext.Provider>
  );
}
