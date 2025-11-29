"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";

/* -------------------- Constants -------------------- */
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
const WS_BASE = process.env.NEXT_PUBLIC_API_WS;

export default function KitchenDashboard() {
  /* Identity & State */
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Audio Management */
  const audioRef = useRef(null);
  const [audioReady, setAudioReady] = useState(false);
  const pendingPlays = useRef(0);

  /* WebSocket & Queue */
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState([]);
  const wsRef = useRef(null);
  const pingRef = useRef();
  const retryRef = useRef({ attempts: 0, timer: null });

  /* -------------------- Audio System -------------------- */
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/notification.mp3");
      audioRef.current.volume = 0.7;
      audioRef.current.preload = "auto";
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioReady && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => {
          console.log("🔊 เล่นเสียงแจ้งเตือนสำเร็จ");
        })
        .catch((error) => {
          console.error("❌ ไม่สามารถเล่นเสียงได้:", error);
        });
    } else {
      pendingPlays.current++;
      console.warn("⏳ เสียงยังไม่พร้อม เพิ่มเข้าคิว:", pendingPlays.current);
    }
  }, [audioReady]);

  const unlockAudio = useCallback(() => {
    if (!audioRef.current || audioReady) return;

    audioRef.current
      .play()
      .then(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setAudioReady(true);
        console.log("🔓 เสียงปลดล็อกสำเร็จแล้ว!");

        // เล่นเสียงที่รอคิวอยู่
        while (pendingPlays.current > 0) {
          setTimeout(() => {
            audioRef.current?.play().catch(console.error);
          }, 100);
          pendingPlays.current--;
        }
      })
      .catch((error) => {
        console.error("❌ ไม่สามารถปลดล็อกเสียงได้:", error);
      });
  }, [audioReady]);

  useEffect(() => {
    if (!audioReady) {
      const handleUserInteraction = () => {
        unlockAudio();
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);
      };

      document.addEventListener("click", handleUserInteraction);
      document.addEventListener("touchstart", handleUserInteraction);

      return () => {
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);
      };
    }
  }, [unlockAudio, audioReady]);

  /* -------------------- Profile Management -------------------- */
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ลองอ่านจาก sessionStorage ก่อน
      const cached = sessionStorage.getItem("kitchenProfile");
      if (cached) {
        try {
          const parsedProfile = JSON.parse(cached);
          setProfile(parsedProfile);
          setLoading(false);
          return;
        } catch (parseError) {
          console.warn("⚠️ ไม่สามารถแปลงข้อมูล cached profile:", parseError);
        }
      }

      // ลองดึงจาก API
      const token = sessionStorage.getItem("kitchenProfile");
      if (token) {
        try {
          const response = await axios.get(
            `${API_BASE}/profile/kitchenprofile`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              timeout: 10000,
            }
          );

          const profileData = {
            username: response.data.username,
            role: response.data.role,
            wsToken: response.data.wsToken,
            id: response.data.id,
          };

          sessionStorage.setItem("kitchenProfile", JSON.stringify(profileData));
          setProfile(profileData);
          return;
        } catch (apiError) {
          console.warn(
            "⚠️ ไม่สามารถดึงข้อมูล profile จาก API:",
            apiError.message
          );
        }
      }

      // ถ้าไม่สำเร็จทั้งสองวิธี ให้ prompt ผู้ใช้
      const kitchenName = prompt("กรุณาใส่ชื่อครัว (เช่น kitchen1):")?.trim();
      if (!kitchenName) {
        throw new Error("ไม่ได้ระบุชื่อครัว");
      }

      const manualProfile = {
        username: kitchenName,
        role: "kitchen",
        id: Date.now().toString(),
      };

      sessionStorage.setItem("kitchenProfile", JSON.stringify(manualProfile));
      setProfile(manualProfile);
    } catch (err) {
      setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลครัว");
      console.error("❌ Load profile error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /* -------------------- WebSocket Management -------------------- */
  const connect = useCallback(() => {
    if (!profile) {
      console.warn("⚠️ ไม่สามารถเชื่อมต่อได้ เพราะยังไม่มี profile");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("✅ WebSocket เชื่อมต่อแล้ว");
      return;
    }

    const wsUrl =
      `${WS_BASE}/ws/${encodeURIComponent(
        profile.username
      )}?role=${encodeURIComponent(profile.role)}` +
      (profile.wsToken ? `&token=${encodeURIComponent(profile.wsToken)}` : "");

    console.log(
      "🔌 กำลังเชื่อมต่อ WebSocket:",
      wsUrl.replace(/token=[^&]+/, "token=***")
    );

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket เชื่อมต่อสำเร็จ");
        setConnected(true);
        setError(null);
        retryRef.current.attempts = 0;

        // เริ่ม ping เพื่อรักษาการเชื่อมต่อ
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 ได้รับข้อความ:", data);

          if (data.type === "order") {
            playNotificationSound();

            const newOrder = {
              orderId: data.orderId || `order_${Date.now()}`,
              items: data.menu?.items || data.items || [],
              tableNumber: data.table_number,
              timestamp: new Date().toLocaleTimeString("th-TH"),
              status: "pending",
            };

            setQueue((prevQueue) => {
              // ตรวจสอบไม่ให้ duplicate
              const exists = prevQueue.some(
                (order) => order.orderId === newOrder.orderId
              );
              if (exists) {
                console.warn("⚠️ Order ซ้ำ:", newOrder.orderId);
                return prevQueue;
              }
              return [...prevQueue, newOrder];
            });
          } else if (data.type === "pong") {
            console.log("🏓 Pong received");
          } else if (data.type === "error") {
            console.error("❌ Server error:", data.message);
            setError(data.message);
          } else {
            console.log("ℹ️ System message:", data);
          }
        } catch (parseError) {
          console.error(
            "❌ ไม่สามารถแปลง JSON:",
            parseError,
            "Raw:",
            event.data
          );
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      };

      ws.onclose = (event) => {
        console.log("🔌 WebSocket ปิดการเชื่อมต่อ:", event.code, event.reason);
        setConnected(false);
        clearInterval(pingRef.current);

        // Auto-reconnect with exponential backoff
        if (retryRef.current.attempts < 10) {
          const delay = Math.min(
            Math.pow(2, retryRef.current.attempts) * 1000,
            30000
          );
          retryRef.current.attempts += 1;

          console.log(
            `🔄 จะลองเชื่อมต่อใหม่ในอีก ${delay}ms (ครั้งที่ ${retryRef.current.attempts})`
          );

          retryRef.current.timer = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาโหลดหน้าใหม่");
        }
      };
    } catch (connectionError) {
      console.error("❌ ไม่สามารถสร้าง WebSocket:", connectionError);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  }, [profile, playNotificationSound]);

  useEffect(() => {
    if (profile) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      clearInterval(pingRef.current);
      clearTimeout(retryRef.current.timer);
    };
  }, [connect]);

  /* -------------------- Order Management -------------------- */
  const sendStatus = useCallback(
    async (orderId, status) => {
      try {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          // อัพเดทสถานะใน state
          setQueue((prevQueue) => {
            if (status === "done") {
              
              return prevQueue.filter((order) => order.orderId !== orderId);
            } else {
              return prevQueue.map((order) =>
                order.orderId === orderId ? { ...order, status } : order
              );
            }
          });
        } else {
          throw new Error("ไม่ได้เชื่อมต่อกับเซิร์ฟเวอร์");
        }
      } catch (err) {
        console.error("❌ ส่งสถานะไม่สำเร็จ:", err);
        setError("ไม่สามารถส่งสถานะได้ กรุณาลองใหม่");

        // แสดง error แป้บเดียวแล้วหาย
        setTimeout(() => setError(null), 3000);
      }
    },
    [profile]
  );

  const clearQueue = useCallback(() => {
    if (confirm("ต้องการเคลียร์คิวทั้งหมดใช่หรือไม่?")) {
      setQueue([]);
      console.log("🗑️ เคลียร์คิวทั้งหมด");
    }
  }, []);

  const refreshConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    clearTimeout(retryRef.current.timer);
    retryRef.current.attempts = 0;
    setTimeout(connect, 1000);
  }, [connect]);

  /* -------------------- UI Render -------------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูลครัว...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-red-600 text-xl mb-4">
            ❌ ไม่สามารถระบุตัวครัวได้
          </p>
          <button
            onClick={loadProfile}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <header className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">
              🍽️ Kitchen Dashboard
            </h1>
            <span className="text-gray-600">{profile.username}</span>
          </div>

          <div className="flex items-center gap-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                connected
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {connected ? "🟢 Online" : "🔴 Offline"}
            </span>

            {!connected && (
              <button
                onClick={refreshConnection}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                🔄 เชื่อมต่อใหม่
              </button>
            )}

            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                🗑️ เคลียร์คิว
              </button>
            )}
          </div>
        </div>

        {/* Audio Status */}
        {!audioReady && (
          <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
            <p className="text-yellow-800 text-sm">
              🔊 กรุณาแตะหน้าจอเพื่อเปิดใช้งานเสียงแจ้งเตือน
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-800 text-sm">❌ {error}</p>
          </div>
        )}
      </header>

      {/* Queue Status */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              📋 คิวปัจจุบัน ({queue.length} รายการ)
            </h2>
            {queue.length > 0 && (
              <span className="text-sm text-gray-500">
                อัพเดทล่าสุด: {new Date().toLocaleTimeString("th-TH")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Orders Queue */}
      {queue.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🍽️</div>
          <p className="text-gray-500 text-xl">ยังไม่มีออร์เดอร์ในคิว</p>
          <p className="text-gray-400 mt-2">รอรับออร์เดอร์จากลูกค้า...</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queue.map((order) => (
            
            <div
              key={order.orderId}
              className={`bg-white rounded-lg shadow-sm border-l-4 p-4 transition-all hover:shadow-md ${
                order.status === "cooking"
                  ? "border-l-yellow-400"
                  : "border-l-blue-400"
              }`}
            >
              
              {/* Order Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    
                    🪑 โต๊ะ {order.tableNumber}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {order.timestamp} • {order.orderId.slice(-6)}
                  </p>
                </div>
                {order.status === "cooking" && (
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                    🍳 กำลังทำ
                  </span>
                )}
              </div>

              {/* Order Items */}
              <div className="space-y-2 mb-4">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.id || index}`}
                    className="flex justify-between items-center bg-gray-50 rounded-lg p-2"
                  >
                    <span className="text-gray-800 font-medium">
                      {item.name || item.menu_name || "ไม่ระบุชื่อเมนู"}
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                      x{item.qty || item.quantity || 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => sendStatus(order.orderId, "cooking")}
                  disabled={order.status === "cooking"}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    order.status === "cooking"
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-yellow-400 hover:bg-yellow-500 text-yellow-900"
                  }`}
                >
                  🍳 {order.status === "cooking" ? "กำลังทำ" : "เริ่มทำ"}
                </button>
                <button
                  onClick={() => sendStatus(order.orderId, "done")}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
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
