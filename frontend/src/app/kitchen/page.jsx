"use client";

import { useEffect } from "react";
import { useKitchenWS } from "../components/kitchenProvider";
import axios from "axios";

/* ─────────────────────────────────────────────────── */

export default function KitchenPage() {
  /* ดึงค่าจาก Provider ฝั่งครัว */
  const { connected, queue, sendStatus } = useKitchenWS();

  /* (ไม่บังคับ) ดึง profile ของครัว */
  useEffect(() => {
    axios
      .get("http://localhost:4000/profile/", { withCredentials: true })
      .then((r) => console.log("profile:", r.data))
      .catch(() => {});
  }, []);

  /* Helper */
  const getConnStatus = () => (connected ? "🟢 Connected" : "🔴 Disconnected");

  /* UI */
  return (
    <div className="min-h-screen px-8 py-6">
      <h1 className="text-3xl font-bold mb-3">🍽️ Kitchen Dashboard</h1>
      <p className="text-sm mb-6">
        {getConnStatus()} | Queue: {queue.length}
      </p>

      {queue.length === 0 ? (
        <p className="text-gray-500 mt-24 text-center">
          ยังไม่มีออร์เดอร์เข้ามา
        </p>
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

/* ——— การ์ดออร์เดอร์ ——— */
function OrderCard({ order, onStart, onDone }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold flex justify-between">
        <span>#{order.orderId.slice(0, 6)}</span>
        <span className="text-xs text-gray-500">{order.from}</span>
      </h2>

      <ul className="text-sm text-gray-700">
        {(order.menu?.items || []).map((i) => (
          <li key={i.id} className="flex justify-between">
            <span>{i.id}</span>
            <span>× {i.qty}</span>
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
