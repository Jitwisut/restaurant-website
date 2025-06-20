"use client";

import { useState, useCallback, useContext } from "react";
import { BaseWebSocketProvider, WSContext } from "./BaseSocketProvider";

/* ——— Context + custom hook ——— */
export const KitchenWSContext = WSContext;
export const useKitchenWS = () => useContext(KitchenWSContext);
/* ———————————————————————— */

export default function KitchenWSProvider({ username, children }) {
  const [queue, setQueue] = useState([]);

  /* รับข้อความจาก WebSocket */
  const handleMsg = useCallback((e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "order") {
        const orderId = msg.orderId || crypto.randomUUID();
        setQueue((prev) =>
          prev.some((o) => o.orderId === orderId)
            ? prev
            : [...prev, { ...msg, orderId }]
        );
      }
    } catch (err) {
      console.error("WS parse error", err);
    }
  }, []);

  /* helper ส่งสถานะ */
  const buildSendStatus = (sendJSON) => (orderId, status) => {
    sendJSON({
      type: "order.status",
      orderId,
      status,
      timestamp: new Date().toISOString(),
    });
    if (status === "done") {
      setQueue((prev) => prev.filter((o) => o.orderId !== orderId));
    }
  };

  return (
    <BaseWebSocketProvider
      username={username}
      role="kitchen"
      onMessage={handleMsg}
    >
      <KitchenWSContext.Consumer>
        {({ sendJSON, ws, connected }) => (
          <KitchenWSContext.Provider
            value={{
              ws,
              connected,
              queue,
              sendStatus: buildSendStatus(sendJSON),
            }}
          >
            {children}
          </KitchenWSContext.Provider>
        )}
      </KitchenWSContext.Consumer>
    </BaseWebSocketProvider>
  );
}
