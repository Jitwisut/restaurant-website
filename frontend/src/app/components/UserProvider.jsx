// components/ws/UserWSProvider.jsx
"use client";

import { useState, useCallback, useContext } from "react";
import { BaseWebSocketProvider, WSContext } from "./BaseSocketProvider";

/* ===== export context + custom hook ===== */
export const UserWSContext = WSContext;
export const useWS = () => useContext(UserWSContext);
/* ======================================== */

export default function UserWSProvider({ username, children }) {
  const [orders, setOrders] = useState([]);

  /* --- handler: ฟังข้อความจากครัว --- */
  const handleMsg = useCallback((e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "order.status") {
        setOrders((prev) =>
          prev.map((o) =>
            o.orderId === msg.orderId ? { ...o, status: msg.status } : o
          )
        );
      }
    } catch (err) {
      console.error("WS parse error", err);
    }
  }, []);

  /* --- helper: สร้างฟังก์ชัน placeOrder --- */
  const buildPlaceOrder = (sendJSON) => (menu) => {
    const orderId = crypto.randomUUID();
    sendJSON({
      type: "order",
      orderId,
      menu,
      timestamp: new Date().toISOString(),
    });
    setOrders((prev) => [...prev, { orderId, menu, status: "queued" }]);
  };

  return (
    <BaseWebSocketProvider
      username={username}
      role="user"
      onMessage={handleMsg}
    >
      {/* ดึง sendJSON จาก BaseProvider แล้วโยนต่อให้ context */}
      <UserWSContext.Consumer>
        {({ sendJSON }) => (
          <UserWSContext.Provider
            value={{
              sendJSON, // ← ⭐️ ให้ OrderPage ใช้ sendJSON ได้
              placeOrder: buildPlaceOrder(sendJSON),
              orders,
            }}
          >
            {children}
          </UserWSContext.Provider>
        )}
      </UserWSContext.Consumer>
    </BaseWebSocketProvider>
  );
}
