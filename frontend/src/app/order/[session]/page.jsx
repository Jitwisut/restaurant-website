"use client";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import toast, { Toaster } from "react-hot-toast";
import {
  ShoppingCart,
  Plus,
  Minus,
  Utensils,
  Clock,
  Star,
  Search,
  Filter,
  Heart,
  Share2,
  MapPin,
  ChefHat,
  Award,
  TrendingUp,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

// ================================
// CONFIGURATION & VALIDATION
// ================================
const getEnvVar = (key, fallback = null) => {
  const value = process.env[key];
  
  // Debug: แสดงค่าที่โหลดได้
  if (typeof window === 'undefined') {
    console.log(`[ENV] ${key}:`, value || 'NOT SET');
  }
  
  if (!value && !fallback) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || fallback;
};

// ใส่ URL ของ backend ที่นี่ หรือใช้ .env.local
const API_BASE = getEnvVar("NEXT_PUBLIC_BACKEND_URL", "http://localhost:4000");
const WS_BASE = getEnvVar("NEXT_PUBLIC_API_WS", "ws://localhost:4000");
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;
const ORDER_SUBMIT_TIMEOUT = 500;

// ================================
// MAIN COMPONENT
// ================================
export default function OrderPage() {
  const { session: sessionHash } = useParams();
  const router = useRouter();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef();
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef();

  const [wsStatus, setWsStatus] = useState("connecting");
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [sending, setSending] = useState(false);
  const orderTimeoutRef = useRef();
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState(new Set());
  const [sortBy, setSortBy] = useState("default");
  const [showFilters, setShowFilters] = useState(false);

  // ================================
  // WEBSOCKET
  // ================================
  const connectWebSocket = useCallback(() => {
    if (!sessionHash) return;

    const wsURL = `${WS_BASE}/ws/${sessionHash}?role=user`;
    try {
      const ws = new WebSocket(wsURL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected successfully");
        setWsStatus("connected");
        reconnectAttemptsRef.current = 0;

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: "ping" }));
            } catch (e) {
              console.error("ping error", e);
            }
          }
        }, PING_INTERVAL);
      };

      ws.onclose = () => {
        console.log("[WS] Closed");
        setWsStatus("disconnected");
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          setWsStatus("reconnecting");
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
        } else {
          setWsStatus("error");
          toast.error("ไม่สามารถเชื่อมต่อได้ กรุณารีเฟรช");
        }
      };

      ws.onerror = (err) => {
        console.error(err);
        setWsStatus("error");
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          console.log("WS msg:", msg);
          
          // ✅ รับ system message เมื่อส่ง order สำเร็จ
          if (msg.type === "system") {
            // เช็คว่าเป็นการตอบกลับ order หรือไม่
            if (msg.message.includes("ส่งคำสั่งอาหาร")) {
              // ล้าง timeout
              if (orderTimeoutRef.current) {
                clearTimeout(orderTimeoutRef.current);
                orderTimeoutRef.current = undefined;
              }
              
              // ล้างตะกร้า
              setCart([]);
              setSending(false);
              
              // แสดง success เฉพาะเมื่อ backend ตอบกลับแล้ว
              toast.success("✅ ส่งคำสั่งอาหารไปยังครัวแล้ว", { 
                duration: 4000 
              });
            } else if (msg.message.includes("เชื่อมต่อสำเร็จ")) {
              // แสดงข้อความเชื่อมต่อ
              console.log("Connected:", msg.message);
            } else {
              // system message อื่นๆ
              toast(msg.message, { 
                icon: "ℹ️", 
                duration: 3000 
              });
            }
          } 
          // ❌ รับ error message
          else if (msg.type === "error") {
            // ล้าง timeout
            if (orderTimeoutRef.current) {
              clearTimeout(orderTimeoutRef.current);
              orderTimeoutRef.current = undefined;
            }
            
            setSending(false);
            
            // แสดง error ตามที่ backend ส่งมา
            if (msg.message.includes("ไม่พบครัว")) {
              toast.error("ครัวยังไม่พร้อมรับออร์เดอร์\n• แจ้งพนักงาน\n• หรือลองใหม่อีกครั้ง", { 
                duration: 6000
              });
            } else {
              toast.error(msg.message, { duration: 4000 });
            }
          } 
          // 🏓 Pong
          else if (msg.type === "pong") {
            console.log("pong received");
          }
          // 📦 Order Status Updates
          else if (msg.type === "order_status") {
            const statusText = {
              accepted: "ครัวรับออร์เดอร์แล้ว",
              preparing: "กำลังเตรียมอาหาร",
              done: "อาหารพร้อมเสิร์ฟ",
              rejected: "ครัวปฏิเสธออร์เดอร์"
            };
            toast(statusText[msg.status] || "สถานะอัพเดท", {
              icon: msg.status === "done" ? "🍽️" : msg.status === "rejected" ? "❌" : "👨‍🍳",
              duration: 5000
            });
          }
        } catch (err) {
          console.error("parse err", err);
        }
      };
    } catch (err) {
      console.error(err);
      setWsStatus("error");
    }
  }, [sessionHash]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (orderTimeoutRef.current) clearTimeout(orderTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // ================================
  // LOAD DATA
  // ================================
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [tableRes, menuRes] = await Promise.allSettled([
          axios.get(`${API_BASE}/tables/checktable/${sessionHash}`),
          axios.get(`${API_BASE}/menu/get`),
        ]);

        if (tableRes.status === "fulfilled" && tableRes.value.status === 200) {
          const tableData = tableRes.value.data.table;
          
          // รองรับทั้ง table_number และ number
          const tableNumber = tableData?.table_number || tableData?.number;
          
          // แปลงเป็น string เสมอ เพื่อให้แน่ใจว่าเป็นรูปแบบเดียวกัน
          const tableNumberStr = tableNumber ? String(tableNumber) : null;
          
          // เซ็ต table พร้อมทำให้แน่ใจว่ามี table_number เป็น string
          setTable({
            ...tableData,
            table_number: tableNumberStr
          });
          
          // Debug: แสดงข้อมูลโต๊ะที่โหลดได้
          console.log("[TABLE] Loaded:", tableData);
          console.log("[TABLE] Table Number (original):", tableNumber, typeof tableNumber);
          console.log("[TABLE] Table Number (converted):", tableNumberStr, typeof tableNumberStr);
          
          if (!tableNumberStr) {
            console.error("[TABLE] ERROR: No table_number found in API response");
            toast.error("ข้อมูลโต๊ะไม่ครบถ้วน กรุณาแจ้งพนักงาน");
          }
        } else {
          toast.error("QR Code ไม่ถูกต้องหรือหมดอายุ");
          setTimeout(() => router.replace("/"), 2000);
          return;
        }

        if (menuRes.status === "fulfilled") {
          const data = menuRes.value.data;
          setMenu(Array.isArray(data) ? data : data.menu || []);
        } else toast.error("โหลดเมนูไม่สำเร็จ");
      } catch (e) {
        console.error("[LOAD ERROR]", e);
        toast.error("โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionHash, router]);

  // ================================
  // ONLINE DETECT
  // ================================
  useEffect(() => {
    const online = () => {
      setIsOnline(true);
      toast.success("กลับมาออนไลน์แล้ว", { icon: "🌐" });
      if (wsStatus === "error" || wsStatus === "disconnected") connectWebSocket();
    };
    const offline = () => {
      setIsOnline(false);
      toast.error("ไม่มีอินเทอร์เน็ต", { icon: "📡" });
    };

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [wsStatus, connectWebSocket]);

  // ================================
  // CART
  // ================================
  useEffect(() => {
    const saved = localStorage.getItem(`cart_${sessionHash}`);
    if (saved) setCart(JSON.parse(saved));
  }, [sessionHash]);

  useEffect(() => {
    if (cart.length) localStorage.setItem(`cart_${sessionHash}`, JSON.stringify(cart));
    else localStorage.removeItem(`cart_${sessionHash}`);
  }, [cart, sessionHash]);

  const categories = useMemo(
    () => ["ทั้งหมด", ...new Set(menu.map((i) => i.category).filter(Boolean))],
    [menu]
  );

  const filteredMenu = useMemo(() => {
    let filtered = [...menu];
    if (selectedCategory !== "ทั้งหมด")
      filtered = filtered.filter((i) => i.category === selectedCategory);

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(s) ||
          i.description?.toLowerCase().includes(s)
      );
    }

    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }
    return filtered;
  }, [menu, selectedCategory, searchTerm, sortBy]);

  const totalPrice = useMemo(
    () => cart.reduce((sum, i) => sum + i.item.price * i.qty, 0),
    [cart]
  );

  const totalItems = useMemo(() => cart.reduce((sum, i) => sum + i.qty, 0), [cart]);

  const addToCart = (item) => {
    // เช็คว่ามีข้อมูลโต๊ะหรือไม่
    if (!table?.table_number) {
      toast.error("ไม่พบข้อมูลโต๊ะ กรุณารีเฟรชหน้าใหม่");
      return;
    }
    
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.item.id === item.id);
      if (idx !== -1)
        return prev.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x));
      return [
        ...prev,
        {
          table_number: table.table_number, // ใช้ table.table_number โดยตรง
          name: item.name,
          item,
          qty: 1,
          image: item.image,
        },
      ];
    });
    toast.success(`เพิ่ม ${item.name} ลงตะกร้าแล้ว`, { icon: "🛒" });
  };

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev.flatMap((i) =>
        i.item.id === id && i.qty + delta <= 0
          ? []
          : i.item.id === id
          ? [{ ...i, qty: i.qty + delta }]
          : [i]
      )
    );
  };

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const f = new Set(prev);
      if (f.has(id)) {
        f.delete(id);
        toast("ลบออกจากรายการโปรด", { icon: "💔" });
      } else {
        f.add(id);
        toast("เพิ่มในรายการโปรด", { icon: "❤️" });
      }
      return f;
    });
  };

  const shareMenu = async (item) => {
    if (navigator.share)
      await navigator.share({
        title: item.name,
        text: `ลองเมนู ${item.name} ที่ราคา ฿${item.price}`,
        url: window.location.href,
      });
    else toast.error("เบราว์เซอร์ไม่รองรับ");
  };

  const submitOrder = () => {
    if (!cart.length) return toast.error("กรุณาเลือกเมนูก่อนสั่ง");
    if (!isOnline) return toast.error("ไม่มีอินเทอร์เน็ต");
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      return toast.error("ยังเชื่อมต่อไม่สำเร็จ กรุณารอสักครู่");
    
    // เช็คว่ามีเลขโต๊ะหรือไม่
    if (!table?.table_number) {
      return toast.error("ไม่พบข้อมูลโต๊ะ กรุณารีเฟรชหน้าใหม่");
    }

    setSending(true);
    
    // แปลง table_number เป็น string หรือ number (แล้วแต่ backend ต้องการ)
    const tableNumber = String(table.table_number);
    
    // สร้าง order payload ตาม backend format
    const orderPayload = {
      type: "order",
      menu: {
        items: cart.map((c) => ({
          id: c.item.id,
          qty: c.qty,
          name: c.item.name,
          price: c.item.price,
        })),
      },
      table_number: tableNumber, // ส่งเป็น string
    };

    console.log("[ORDER] Sending:", orderPayload);
    console.log("[ORDER] Table Number:", tableNumber, typeof tableNumber);
    
    try {
      // ส่ง order ไปยัง WebSocket
      wsRef.current.send(JSON.stringify(orderPayload));
      
      // ตั้ง timeout เผื่อ backend ไม่ตอบกลับ (5 วินาที)
      orderTimeoutRef.current = setTimeout(() => {
        setSending(false);
        
        toast.error("ไม่ได้รับการตอบกลับจากระบบ\nกรุณาแจ้งพนักงาน", {
          duration: 5000
        });
      }, 5000);
      
    } catch (error) {
      console.error("[ORDER] Send error:", error);
      setSending(false);
      toast.error("เกิดข้อผิดพลาดในการส่งคำสั่ง");
    }
  };

  // ================================
  // RENDER
  // ================================
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <Loader2 className="h-16 w-16 text-purple-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-600 text-lg font-medium">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pb-20 lg:pb-0">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Connection Status */}
      <div className="fixed top-2 right-2 z-50 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-xl shadow-lg border text-sm flex items-center space-x-2">
        {wsStatus === "connected" ? (
          <>
            <Wifi className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-600">เชื่อมต่อแล้ว</span>
          </>
        ) : wsStatus === "reconnecting" ? (
          <>
            <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
            <span className="font-medium text-yellow-600">กำลังเชื่อมต่อ...</span>
          </>
        ) : wsStatus === "error" ? (
          <>
            <WifiOff className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-600">ขัดข้อง</span>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 text-gray-600 animate-spin" />
            <span className="font-medium text-gray-600">กำลังเชื่อมต่อ</span>
          </>
        )}
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-xl sticky top-0 z-40 border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 py-4 lg:py-6">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <div className="flex items-center space-x-2 lg:space-x-4">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 lg:p-3 rounded-xl shadow-lg">
                <ChefHat className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl lg:text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                  โต๊ะ {table?.table_number}
                </h1>
                <div className="text-xs lg:text-sm text-gray-600 flex items-center space-x-2 mt-1">
                  <MapPin className="h-3 w-3 lg:h-4 lg:w-4" />
                  <span>เลือกเมนูที่ต้องการสั่ง</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 lg:p-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
                <ShoppingCart className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
                {totalItems > 0 && (
                  <div className="absolute -top-1 -right-1 bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs rounded-full h-5 w-5 lg:h-6 lg:w-6 flex items-center justify-center font-bold shadow-lg animate-pulse">
                    {totalItems}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col gap-2 lg:flex-row lg:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาเมนู..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 lg:pl-12 lg:py-3 rounded-2xl border border-gray-200 focus:border-purple-400 focus:ring-2 lg:focus:ring-4 focus:ring-purple-100 outline-none transition-all bg-white/70 backdrop-blur-sm text-sm lg:text-base"
                aria-label="ค้นหาเมนู"
              />
            </div>
            <div className="flex items-center space-x-2 lg:space-x-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 lg:px-4 lg:py-3 rounded-2xl border border-gray-200 focus:border-purple-400 focus:ring-2 lg:focus:ring-4 focus:ring-purple-100 outline-none bg-white/70 backdrop-blur-sm text-sm lg:text-base"
                aria-label="เรียงลำดับเมนู"
              >
                <option value="default">เรียงตาม</option>
                <option value="price-low">ราคา: ต่ำ-สูง</option>
                <option value="price-high">ราคา: สูง-ต่ำ</option>
                <option value="rating">คะแนนสูงสุด</option>
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 lg:p-3 rounded-2xl border transition-all ${
                  showFilters
                    ? "bg-purple-500 text-white border-purple-500"
                    : "bg-white/70 text-gray-700 border-gray-200 hover:border-purple-400"
                }`}
                aria-label="แสดง/ซ่อนตัวกรอง"
              >
                <Filter className="h-4 w-4 lg:h-5 lg:w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 lg:py-8 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
        {/* Menu Section */}
        <section className="lg:col-span-2 order-2 lg:order-1">
          {categories.length > 1 && (
            <div className="mb-6 lg:mb-8">
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <h2 className="text-lg lg:text-xl font-bold text-gray-800 flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-purple-500" />
                  <span>หมวดหมู่เมนู</span>
                </h2>
                <div className="text-xs lg:text-sm text-gray-500">
                  {filteredMenu.length} รายการ
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 lg:px-4 lg:py-2 rounded-xl lg:rounded-2xl font-medium transition-all duration-300 shadow-md hover:shadow-lg text-sm lg:text-base ${
                      selectedCategory === cat
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-white/80 text-gray-700 hover:bg-purple-50 border border-gray-200 backdrop-blur-sm"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            {filteredMenu.map((item) => {
              const cartItem = cart.find((c) => c.item.id === item.id);
              const isFavorite = favorites.has(item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white/80 backdrop-blur-sm rounded-xl lg:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden group border border-white/50"
                >
                  {item.image && (
                    <div className="relative overflow-hidden aspect-square">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        priority={false}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <div className="absolute top-2 left-2 lg:top-3 lg:left-3 flex flex-col space-y-1 lg:space-y-2">
                        {item.category && (
                          <span className="bg-white/90 backdrop-blur-sm px-2 py-0.5 lg:px-3 lg:py-1 rounded-full text-xs font-bold text-gray-800 border border-white/50">
                            {item.category}
                          </span>
                        )}
                        {item.rating && item.rating >= 4.5 && (
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 lg:px-3 lg:py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                            <Award className="h-2 w-2 lg:h-3 lg:w-3" />
                            <span>Best</span>
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 lg:top-3 lg:right-3 flex flex-col space-y-1 lg:space-y-2">
                        {item.rating && (
                          <div className="bg-white/95 backdrop-blur-sm px-2 py-1 lg:px-3 lg:py-2 rounded-full shadow-lg flex items-center space-x-1">
                            <Star className="h-3 w-3 lg:h-4 lg:w-4 text-yellow-400 fill-current" />
                            <span className="text-xs lg:text-sm font-bold text-gray-800">
                              {item.rating}
                            </span>
                          </div>
                        )}
                        <div className="flex space-x-1 lg:space-x-2">
                          <button
                            onClick={() => toggleFavorite(item.id)}
                            className={`p-1 lg:p-2 rounded-full backdrop-blur-sm transition-all duration-300 ${
                              isFavorite
                                ? "bg-red-500 text-white shadow-md"
                                : "bg-white/80 text-gray-600 hover:bg-red-50"
                            }`}
                            aria-label={
                              isFavorite ? "ลบออกจากรายการโปรด" : "เพิ่มในรายการโปรด"
                            }
                          >
                            <Heart
                              className={`h-3 w-3 lg:h-4 lg:w-4 ${
                                isFavorite ? "fill-current" : ""
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => shareMenu(item)}
                            className="p-1 lg:p-2 rounded-full bg-white/80 text-gray-600 hover:bg-blue-50 backdrop-blur-sm transition-all duration-300"
                            aria-label="แชร์เมนู"
                          >
                            <Share2 className="h-3 w-3 lg:h-4 lg:w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 lg:p-4">
                    <div className="flex justify-between items-start mb-2 lg:mb-3">
                      <h3 className="font-bold text-base lg:text-lg text-gray-800 group-hover:text-purple-600 transition-colors">
                        {item.name}
                      </h3>
                      <div className="text-right">
                        <span className="text-lg lg:text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          ฿{item.price}
                        </span>
                      </div>
                    </div>
                    {item.time && (
                      <div className="flex items-center space-x-1 text-xs lg:text-sm text-gray-500 mb-1 lg:mb-2">
                        <Clock className="h-3 w-3 lg:h-4 lg:w-4" />
                        <span>{item.time}</span>
                      </div>
                    )}
                    {item.description && (
                      <p className="text-gray-600 text-xs lg:text-sm mb-2 lg:mb-3 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {cartItem ? (
                      <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 p-2 lg:p-3 rounded-xl lg:rounded-2xl border border-purple-100">
                        <div className="flex items-center space-x-2 lg:space-x-3">
                          <button
                            onClick={() => changeQty(item.id, -1)}
                            className="bg-white hover:bg-red-50 p-2 lg:p-2 rounded-full border border-red-200 shadow-sm transition-all duration-300"
                            aria-label="ลดจำนวน"
                          >
                            <Minus className="h-3 w-3 lg:h-4 lg:w-4 text-red-500" />
                          </button>
                          <span className="font-bold text-lg lg:text-xl w-8 text-center text-gray-800 bg-white px-2 py-1 lg:px-3 lg:py-2 rounded-lg lg:rounded-xl shadow-sm">
                            {cartItem.qty}
                          </span>
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 p-2 lg:p-2 rounded-full shadow-md transition-all duration-300"
                            aria-label="เพิ่มจำนวน"
                          >
                            <Plus className="h-3 w-3 lg:h-4 lg:w-4 text-white" />
                          </button>
                        </div>
                        <span className="font-bold text-base lg:text-lg text-purple-600 bg-white px-2 py-1 lg:px-3 lg:py-2 rounded-lg lg:rounded-xl shadow-sm">
                          ฿{item.price * cartItem.qty}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 hover:from-purple-600 hover:via-pink-600 hover:to-indigo-600 text-white font-medium py-2 lg:py-3 px-4 rounded-xl lg:rounded-2xl shadow-md hover:shadow-lg flex items-center justify-center space-x-2 transform hover:scale-[1.02] transition-all duration-300 group text-sm lg:text-base"
                        aria-label={`เพิ่ม ${item.name} ลงตะกร้า`}
                      >
                        <Plus className="h-4 w-4 lg:h-5 lg:w-5 group-hover:rotate-90 transition-transform duration-300" />
                        <span>เพิ่มลงตะกร้า</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMenu.length === 0 && (
            <div className="text-center py-8 lg:py-12">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-lg border border-white/50">
                <div className="relative mb-4 lg:mb-6">
                  <Utensils className="h-12 w-12 lg:h-16 lg:w-16 text-gray-300 mx-auto" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 rounded-full blur-lg"></div>
                </div>
                <p className="text-gray-500 text-base lg:text-lg mb-2">
                  ไม่พบเมนูที่ค้นหา
                </p>
                <p className="text-gray-400 text-xs lg:text-sm">
                  ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Cart Section */}
        <aside className="lg:col-span-1 order-1 lg:order-2 mb-6 lg:mb-0">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl lg:rounded-3xl shadow-lg lg:shadow-xl p-4 lg:p-6 sticky top-20 lg:top-28 border border-white/50">
            <h2 className="text-lg lg:text-xl font-bold text-gray-800 mb-4 lg:mb-6 flex items-center space-x-2 lg:space-x-3">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-1.5 lg:p-2 rounded-lg lg:rounded-xl">
                <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
              </div>
              <span>ตะกร้าของคุณ</span>
              {totalItems > 0 && (
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 lg:px-3 lg:py-1 rounded-full text-xs lg:text-sm font-bold">
                  {totalItems}
                </span>
              )}
            </h2>

            {cart.length === 0 ? (
              <div className="text-center py-6 lg:py-8">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-purple-100">
                  <div className="relative mb-3 lg:mb-4">
                    <ShoppingCart className="h-10 w-10 lg:h-12 lg:w-12 text-gray-300 mx-auto" />
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 rounded-full blur-md"></div>
                  </div>
                  <p className="text-gray-500 text-sm lg:text-base mb-1 lg:mb-2">
                    ตะกร้าว่างเปล่า
                  </p>
                  <p className="text-gray-400 text-xs lg:text-sm">
                    เลือกเมนูที่ชอบเพื่อเริ่มสั่งอาหาร
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-6 max-h-60 lg:max-h-80 overflow-y-auto custom-scrollbar">
                  {cart.map((c) => (
                    <div
                      key={c.item.id}
                      className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-purple-100 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-2 lg:mb-3">
                        <h4 className="font-semibold text-gray-800 flex-1 text-sm lg:text-base">
                          {c.item.name}
                        </h4>
                        <span className="text-base lg:text-lg font-bold text-purple-600 ml-2">
                          ฿{c.item.price * c.qty}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs lg:text-sm text-gray-600">
                          ฿{c.item.price} × {c.qty}
                        </span>
                        <div className="flex items-center space-x-2 lg:space-x-3 bg-white rounded-lg lg:rounded-xl p-1 shadow-sm">
                          <button
                            onClick={() => changeQty(c.item.id, -1)}
                            className="bg-red-50 hover:bg-red-100 p-1 lg:p-1.5 rounded-md border border-red-200 transition-all duration-300"
                            aria-label="ลดจำนวน"
                          >
                            <Minus className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-red-500" />
                          </button>
                          <span className="font-bold text-base lg:text-lg w-6 lg:w-8 text-center text-gray-800">
                            {c.qty}
                          </span>
                          <button
                            onClick={() => changeQty(c.item.id, 1)}
                            className="bg-purple-50 hover:bg-purple-100 p-1 lg:p-1.5 rounded-md border border-purple-200 transition-all duration-300"
                            aria-label="เพิ่มจำนวน"
                          >
                            <Plus className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-purple-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 lg:pt-6 mb-4 lg:mb-6">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-purple-100">
                    <div className="flex justify-between items-center">
                      <span className="text-base lg:text-lg font-bold text-gray-800">
                        รวมทั้งหมด
                      </span>
                      <span className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        ฿{totalPrice}
                      </span>
                    </div>
                    <div className="mt-1 lg:mt-2 text-xs lg:text-sm text-gray-500">
                      {totalItems} รายการ
                    </div>
                  </div>
                </div>

                <button
                  onClick={submitOrder}
                  disabled={sending || !isOnline || wsStatus !== "connected"}
                  className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 lg:py-4 px-4 lg:px-6 rounded-xl lg:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none group text-sm lg:text-base"
                  aria-label="ยืนยันสั่งอาหาร"
                >
                  {sending ? (
                    <span className="flex items-center justify-center space-x-2 lg:space-x-3">
                      <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" />
                      <span>กำลังส่งออร์เดอร์...</span>
                    </span>
                  ) : !isOnline ? (
                    <span className="flex items-center justify-center space-x-2 lg:space-x-3">
                      <WifiOff className="h-4 w-4 lg:h-5 lg:w-5" />
                      <span>ไม่มีอินเทอร์เน็ต</span>
                    </span>
                  ) : wsStatus !== "connected" ? (
                    <span className="flex items-center justify-center space-x-2 lg:space-x-3">
                      <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" />
                      <span>กำลังเชื่อมต่อ...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2 lg:space-x-3">
                      <Utensils className="h-4 w-4 lg:h-5 lg:w-5 group-hover:animate-bounce" />
                      <span>ยืนยันสั่งอาหาร</span>
                      <div className="bg-white/20 px-2 py-0.5 lg:px-3 lg:py-1 rounded-full">
                        <span className="text-xs lg:text-sm font-bold">
                          ฿{totalPrice}
                        </span>
                      </div>
                    </span>
                  )}
                </button>

                <div className="mt-3 lg:mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    {wsStatus === "connected"
                      ? "คำสั่งซื้อจะถูกส่งไปยังครัวทันที"
                      : "กรุณารอระบบเชื่อมต่อ"}
                  </p>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Buttons */}
      <div className="fixed bottom-4 right-4 flex flex-col space-y-2 z-40">
        {favorites.size > 0 && (
          <button
            className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-3 lg:p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group relative"
            aria-label="รายการโปรด"
          >
            <Heart className="h-5 w-5 lg:h-6 lg:w-6 fill-current" />
            <span className="absolute -top-1 -right-1 bg-white text-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {favorites.size}
            </span>
          </button>
        )}
        <button
          className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-3 lg:p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          aria-label="แชร์"
        >
          <Share2 className="h-5 w-5 lg:h-6 lg:w-6" />
        </button>
      </div>

      {/* Spacer for mobile */}
      <div className="lg:hidden h-16"></div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #a855f7, #ec4899);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #9333ea, #db2777);
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}