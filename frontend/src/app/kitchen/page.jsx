"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

/* WebSocket config */
const WS_BASE = process.env.NEXT_PUBLIC_API_WS || "ws://localhost:4000";
const KITCHEN_USERNAME = "kitchen1"; // เปลี่ยนเป็นชื่อ kitchen ที่ต้องการ

export default function KitchenPage() {
  const wsRef = useRef(null);
 const [profile, setProfile] = useState(null);
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState([]);
  const [wsMessages, setWsMessages] = useState([]);

  // 1. ดึง profile ก่อน
  useEffect(() => {
    axios.get("http://localhost:4000/profile/", { withCredentials: true })
      .then((r) => {
        // สมมุติ r.data = { username: "kitchen1", role: "kitchen" }
        setProfile({ username: r.data.username, role: r.data.role });
      });
  }, []);

  // เชื่อมต่อ WebSocket
  useEffect(() => {
      if (!profile) return;
     const ws = new WebSocket(`${WS_BASE}/ws/${profile.username}?role=${profile.role}`);
    wsRef.current=ws
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setWsMessages((prev) => [...prev, "WS error"]);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "order") {
          // เพิ่ม order ใหม่เข้า queue
          setQueue((prev) => [
            ...prev,
            {
              orderId: data.orderId || Date.now().toString(), // fallback id
              from: data.from,
              menu: data.menu,
              timestamp: data.timestamp,
            },
          ]);
        }
        if (data.type === "system" || data.type === "error") {
          setWsMessages((prev) => [...prev, data.message]);
        }
      } catch {
        setWsMessages((prev) => [...prev, "WS: รับข้อมูลผิดพลาด"]);
      }
    };

    return () => ws.close();
    // eslint-disable-next-line
  }, [profile]);

  // ส่งสถานะกลับไปยัง user
  const sendStatus = useCallback((orderId, status) => {
    if (wsRef.current && wsRef.current.readyState === window.WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "status",
          orderId,
          status,
        })
      );
      // อัปเดต queue (ลบ order ที่เสร็จแล้ว)
      if (status === "done") {
        setQueue((prev) => prev.filter((o) => o.orderId !== orderId));
      }
    }
  }, []);

  // (ไม่บังคับ) ดึง profile ของครัว
  useEffect(() => {
    axios
      .get("http://localhost:4000/profile/", { withCredentials: true })
      .then((r) => console.log("profile:", r.data))
      .catch(() => {});
  }, []);

  const getConnStatus = () => (connected ? "🟢 Connected" : "🔴 Disconnected");

  return (
    <div className="min-h-screen px-8 py-6">
      <h1 className="text-3xl font-bold mb-3">🍽️ Kitchen Dashboard</h1>
      <p className="text-sm mb-6">
        {getConnStatus()} | Queue: {queue.length}
      </p>
      {wsMessages.length > 0 && (
        <ul className="text-xs text-gray-500 mb-4">
          {wsMessages.map((msg, idx) => (
            <li key={idx}>{msg}</li>
          ))}
        </ul>
      )}

      {queue.length === 0 ? (
        <p className="text-gray-500 mt-24 text-center">ยังไม่มีออร์เดอร์เข้ามา</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {queue.map((o) => (
            <OrderCard
              key={o.orderId}
              order={o}
              onStart={() => sendStatus(o.orderId, "cooking")}
              onDone={() => sendStatus(o.orderId, "done")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onStart, onDone }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold flex justify-between">
        <span>#{order.orderId.slice(0, 6)}</span>
    {/* สมมุติ order.from คือ หมายเลขโต๊ะ */}
      <span className="text-xs text-gray-700 font-bold">
  โต๊ะ: {order.menu.items?.[0]?.table_number || "-"}
</span>
      </h2>
      <ul className="text-sm text-gray-700">
        {(order.menu?.items || []).map( (i) => (
          <li key={i.id} className="flex justify-between">  
            <span>ชื่ออาหาร {i.name}</span>
 
            <span>{i.qty}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-2">
        <button
          onClick={onStart}
          className="flex-1 bg-yellow-400 px-3 py-1 rounded"
        >
          🍳 เริ่มทำ
        </button>
        <button
          onClick={onDone}
          className="flex-1 bg-emerald-500 px-3 py-1 rounded text-white"
        >
          ✅ เสร็จแล้ว
        </button>
      </div>
    </div>
  );
}