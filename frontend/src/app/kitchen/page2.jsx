"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";

/* -------------------- Constants -------------------- */
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
const WS_BASE = process.env.NEXT_PUBLIC_API_WS;

export default function KitchenDashboard() {
  /* identity / state */
  const [profile, setProfile] = useState(null); // { username, role, wsToken? }
  const [loading, setLoading] = useState(true);
  const [tablenumber, setTablenumber] = useState("");
  /* ---------- AUDIO ---------- */
  const audioRef = useRef(null);
  const [audioReady, setAudioReady] = useState(false);
  const pendingPlays = useRef(0); // คิวเสียงที่เข้าก่อนปลดล็อก

  /* สร้าง Audio ครั้งเดียวเมื่อ mount */
  useEffect(() => {
    // ตรวจสอบว่า `audioRef.current` ยังไม่มีค่าก่อนที่จะสร้าง Audio object ใหม่
    // เพื่อให้แน่ใจว่ามันถูกสร้างเพียงครั้งเดียวต่อการโหลดคอมโพเนนต์
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/notification.mp3");
      audioRef.current.volume = 0.7;
    }
  }, []); // [] เพื่อให้รันแค่ครั้งเดียวตอน mount

  /* ฟังก์ชันเล่นเสียงแจ้งเตือน */
  const playNotificationSound = useCallback(() => {
    if (audioReady && audioRef.current) {
      audioRef.current.currentTime = 0; // รีเซ็ตเสียงไปที่จุดเริ่มต้น
      audioRef.current
        .play()
        .then(() => {
          console.log("เล่นเสียงแจ้งเตือนสำเร็จ");
        })
        .catch((error) => {
          console.error("ไม่สามารถเล่นเสียงได้ (ปลดล็อกแล้ว):", error);
        });
    } else {
      // ถ้าเสียงยังไม่พร้อม (ยังไม่ถูกปลดล็อก) ให้เพิ่มเข้าคิว
      pendingPlays.current++;
      console.warn("เสียงยังไม่พร้อมเล่น เพิ่มเข้าคิว", pendingPlays.current);
    }
  }, [audioReady]); // ให้ฟังก์ชันนี้สร้างใหม่เมื่อ audioReady เปลี่ยน

  /* ปลดล็อกเสียงเมื่อมี gesture แรก */
  const unlockAudio = useCallback(() => {
    if (!audioRef.current || audioReady) return; // ถ้า audioRef ยังไม่พร้อม หรือปลดล็อกไปแล้ว ก็ไม่ต้องทำอะไร

    audioRef.current
      .play() // พยายามเล่นเสียง
      .then(() => {
        audioRef.current.pause(); // หยุดทันที
        audioRef.current.currentTime = 0; // รีเซ็ตตำแหน่ง
        setAudioReady(true); // ตั้งสถานะว่าเสียงพร้อมแล้ว
        console.log("เสียงปลดล็อกสำเร็จแล้ว!");

        // เล่นเสียงที่สะสมไว้ (ถ้ามี order มาก่อน gesture)
        while (pendingPlays.current > 0) {
          audioRef.current.play().catch(console.error);
          pendingPlays.current--;
        }
        window.removeEventListener("pointerdown", unlockAudio); // ลบ listener หลังจากปลดล็อก
      })
      .catch((error) => {
        console.error("ไม่สามารถปลดล็อกเสียงได้:", error);
        // อาจจะแสดงข้อความให้ผู้ใช้แตะเพื่อปลดล็อกเสียงอีกครั้ง
      });
  }, [audioReady]);

  /* ผูก listener สำหรับ gesture แรก */
  useEffect(() => {
    // ผูก listener เฉพาะเมื่อเสียงยังไม่พร้อม
    if (!audioReady) {
      window.addEventListener("pointerdown", unlockAudio, { once: true });
    }
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
    };
  }, [unlockAudio, audioReady]);

  /* STEP 1: sessionStorage > STEP 2: /profile > STEP 3: prompt */
  useEffect(() => {
    const token = sessionStorage.getItem("kitchenProfile");
    if (token) {
      try {
        setProfile(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        /* ignore */
      }
    }

    axios
      .get(`${API_BASE}/profile/kitchenprofile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => {
        const p = {
          username: r.data.username,
          role: r.data.role,
        };

        sessionStorage.setItem("kitchenProfile", JSON.stringify(p));
        setProfile(p);
      })
      .catch(() => {
        const name = prompt("กรุณาใส่ชื่อครัว (เช่น kitchen1):")?.trim();
        if (name) {
          const p = { username: name, role: "kitchen" };
          sessionStorage.setItem("kitchenProfile", JSON.stringify(p));
          setProfile(p);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  /* WebSocket */
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState([]); // [{ orderId, items }]
  const wsRef = useRef(null);
  const pingRef = useRef();
  const retryRef = useRef({ attempts: 0, timer: null });

  const connect = useCallback(() => {
    if (!profile) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const url =
      `${WS_BASE}/ws/${profile.username}?role=${profile.role}` +
      (profile.wsToken ? `&token=${profile.wsToken}` : "");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retryRef.current.attempts = 0;
      pingRef.current = setInterval(() => {
        ws.readyState === WebSocket.OPEN && ws.send("ping");
      }, 30_000);
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        console.log(d);
        if (d.type === "order") {
          playNotificationSound(); // <-- เรียกใช้ฟังก์ชันเล่นเสียงที่ถูกต้อง
          setQueue((q) => [
            ...q,
            {
              orderId: d.orderId || Date.now().toString(),
              items: d.menu?.items || [],
              tablenumber: d.menu?.items[0].table_number,
            },
          ]);
        } else if (d.type !== "pong") {
          console.warn("WS message (system):", d);
        }
      } catch (err) {
        console.error("WS: JSON parse error", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(pingRef.current);
      const delay = Math.min(2 ** retryRef.current.attempts * 1000, 30_000);
      retryRef.current.attempts += 1;
      retryRef.current.timer = setTimeout(connect, delay);
    };
  }, [profile, playNotificationSound]); // เพิ่ม playNotificationSound ใน dependency array

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearInterval(pingRef.current);
      clearTimeout(retryRef.current.timer);
    };
  }, [connect]);

  const sendStatus = (orderId, status) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "status", orderId, status }));
      if (status === "done")
        setQueue((q) => q.filter((o) => o.orderId !== orderId));
    }
  };

  /* UI */
  if (loading) return <p className="p-6">กำลังโหลด…</p>;
  if (!profile)
    return <p className="p-6 text-red-600">ไม่สามารถระบุตัวครัวได้</p>;

  return (
    <div className="min-h-screen p-6 space-y-4">
      <header className="flex items-center gap-4 text-xl font-bold">
        🍽️ Kitchen —{" "}
        <span className="text-base font-normal">{profile.username}</span>
        <span className={connected ? "text-green-600" : "text-red-600"}>
          {connected ? "● Online" : "● Offline"}
        </span>
      </header>

      {queue.length === 0 ? (
        <p className="text-gray-500 mt-16 text-center">ยังไม่มีออร์เดอร์</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {queue.map((o) => (
            <div key={o.orderId} className="border rounded-xl p-4 space-y-3">
              <h2 className="font-semibold text-lg">โต๊ะ {o.tablenumber}</h2>
              <ul className="text-sm space-y-1">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.name}</span>
                    <span>x{i.qty}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-2 text-sm">
                <button
                  onClick={() => sendStatus(o.orderId, "cooking")}
                  className="flex-1 bg-yellow-300/90 hover:bg-yellow-300 px-3 py-1 rounded"
                >
                  🍳 เริ่มทำ
                </button>
                <button
                  onClick={() => sendStatus(o.orderId, "done")}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded"
                >
                  ✅ เสร็จแล้ว
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
