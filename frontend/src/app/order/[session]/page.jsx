"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
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
  Users,
  ChefHat,
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react";

export default function OrderPage() {
  // โหลดข้อมูลโต๊ะ+เมนู
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
  /* ------------ ตั้งค่าฐาน URL ของ API (จาก .env หรือ fallback) ------------ */
  const WS_BASE = process.env.NEXT_PUBLIC_API_WS;
  const wsRef = useRef(null);
  const [wsStatus, setWsStatus] = useState("กำลังเชื่อมต่อ...");
  const [wsError, setWsError] = useState(null);
  const [wsMessages, setWsMessages] = useState([]);

  const { session: sessionHash } = useParams(); // /order/[session]
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [sending, setSending] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState(new Set());
  const [sortBy, setSortBy] = useState("default");
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    const loadTable = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/tables/checktable/${sessionHash}`,
          {
            withCredentials: true,
          }
        );
        if (res.status === 200) setTable(res.data.table);
      } catch {
        alert("QR ไม่ถูกต้องหรือหมดอายุ");
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };
    const loadMenu = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/menu/get`, {
          withCredentials: true,
        });
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.menu)
          ? data.menu
          : [];
        setMenu(list);
      } catch (err) {
        setMenu([]);
      }
    };
    loadTable();
    loadMenu();
  }, [sessionHash, router]);

  // ---------- WebSocket ----------
  useEffect(() => {
    const username = sessionHash || "user";
    const role = "user";
    const wsURL = `${WS_BASE}/ws/${username}?role=${role}`;
    const ws = new WebSocket(wsURL);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsStatus("เชื่อมต่อสำเร็จ");
      setWsError(null);
    };
    ws.onclose = () => {
      setWsStatus("ตัดการเชื่อมต่อ");
    };
    ws.onerror = () => {
      setWsStatus("เกิดข้อผิดพลาด");
      setWsError("เกิดข้อผิดพลาดในการเชื่อมต่อ WebSocket");
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "system" || msg.type === "error") {
          setWsMessages((prev) => [...prev, msg.message]);
        }
      } catch {
        setWsMessages((prev) => [...prev, "รับข้อมูลผิดพลาด"]);
      }
    };
    return () => {
      ws.close();
    };
  }, [sessionHash]);

  const categories = [
    "ทั้งหมด",
    ...new Set(
      (Array.isArray(menu) ? menu : []).map((i) => i.category).filter(Boolean)
    ),
  ];

  const getFilteredAndSortedMenu = () => {
    let filtered = menu;
    if (selectedCategory !== "ทั้งหมด") {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.description &&
            item.description.toLowerCase().includes(searchTerm.toLowerCase()))
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
  };

  const filteredMenu = getFilteredAndSortedMenu();

  /* const addToCart = (item) =>
    setCart((prev) => {
      const found = prev.find((i) => i.item.id === item.id);
      return found
        ? prev.map((i) =>
            i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i
          )
        : [...prev, { item, qty: 1 }];
    });*/

  const addToCart = (item) => {
    setCart((prevCart) => {
      // หา index ของ item ใน cart
      const index = prevCart.findIndex((i) => i.item.id === item.id);

      // ถ้ามีอยู่ใน cart แล้ว เพิ่ม qty
      if (index !== -1) {
        return prevCart.map((cartItem, idx) =>
          idx === index ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem
        );
      }

      // ถ้ายังไม่มีใน cart เพิ่มใหม่
      return [
        ...prevCart,
        {
          table_number: table?.table_number,
          name: item.name,
          item,
          qty: 1,
          image: item.image,
        },
      ];
    });
  };

  const changeQty = (id, delta) =>
    setCart((prev) =>
      prev.flatMap((i) =>
        i.item.id === id && i.qty + delta <= 0
          ? []
          : i.item.id === id
          ? [{ ...i, qty: i.qty + delta }]
          : [i]
      )
    );

  const getTotalPrice = () =>
    cart.reduce((sum, i) => sum + i.item.price * i.qty, 0);

  const getTotalItems = () => cart.reduce((sum, i) => sum + i.qty, 0);

  const toggleFavorite = (itemId) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(itemId)) {
        newFavorites.delete(itemId);
      } else {
        newFavorites.add(itemId);
      }
      return newFavorites;
    });
  };

  const shareMenu = async (item) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: `ลองเมนู ${item.name} ที่ราคา ฿${item.price}`,
          url: window.location.href,
        });
      } catch {}
    }
  };

  const submitOrder = () => {
    if (cart.length === 0) return alert("ยังไม่ได้เลือกเมนู");
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "order",
          menu: {
            items: cart.map((c) => ({
              id: c.item.id,
              qty: c.qty,
              name: c.item.name,
              table_number: c.table_number,
            })),
          },
        })
      );
      setCart([]);
      alert("ส่งคำสั่งไปครัวแล้ว!");
    } else {
      alert(
        "ยังไม่ได้เชื่อมต่อกับระบบครัว หรือเชื่อมต่อขัดข้อง กรุณาลองใหม่อีกครั้ง"
      );
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pb-20 lg:pb-0">
      {/* สถานะ websocket - ย้ายไปด้านบนขวาและทำให้กะทัดรัดขึ้น */}
      <div className="fixed top-2 right-2 z-50 bg-white/90 px-3 py-1 rounded-xl shadow border text-sm">
        <span
          className={`font-medium ${
            wsStatus === "เชื่อมต่อสำเร็จ"
              ? "text-green-600"
              : "text-yellow-600"
          }`}
        >
          {wsStatus}
        </span>
      </div>

      {/* ------------------ Header ------------------ */}
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
                {getTotalItems() > 0 && (
                  <div className="absolute -top-1 -right-1 bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs rounded-full h-5 w-5 lg:h-6 lg:w-6 flex items-center justify-center font-bold shadow-lg animate-pulse">
                    {getTotalItems()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search and Filter - ปรับ layout สำหรับมือถือ */}
          <div className="flex flex-col gap-2 lg:flex-row lg:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาเมนู..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 lg:pl-12 lg:py-3 rounded-2xl border border-gray-200 focus:border-purple-400 focus:ring-2 lg:focus:ring-4 focus:ring-purple-100 outline-none transition-all bg-white/70 backdrop-blur-sm text-sm lg:text-base"
              />
            </div>
            <div className="flex items-center space-x-2 lg:space-x-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 lg:px-4 lg:py-3 rounded-2xl border border-gray-200 focus:border-purple-400 focus:ring-2 lg:focus:ring-4 focus:ring-purple-100 outline-none bg-white/70 backdrop-blur-sm text-sm lg:text-base"
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
              >
                <Filter className="h-4 w-4 lg:h-5 lg:w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 lg:py-8 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
        {/* ------------------ Menu Section ------------------ */}
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
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
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
                          >
                            <Minus className="h-3 w-3 lg:h-4 lg:w-4 text-red-500" />
                          </button>
                          <span className="font-bold text-lg lg:text-xl w-8 text-center text-gray-800 bg-white px-2 py-1 lg:px-3 lg:py-2 rounded-lg lg:rounded-xl shadow-sm">
                            {cartItem.qty}
                          </span>
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 p-2 lg:p-2 rounded-full shadow-md transition-all duration-300"
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

        {/* ------------------ Cart Section - ย้ายไปด้านล่างบนมือถือ ------------------ */}
        <aside className="lg:col-span-1 order-1 lg:order-2 mb-6 lg:mb-0">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl lg:rounded-3xl shadow-lg lg:shadow-xl p-4 lg:p-6 sticky top-20 lg:top-28 border border-white/50">
            <h2 className="text-lg lg:text-xl font-bold text-gray-800 mb-4 lg:mb-6 flex items-center space-x-2 lg:space-x-3">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-1.5 lg:p-2 rounded-lg lg:rounded-xl">
                <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
              </div>
              <span>ตะกร้าของคุณ</span>
              {getTotalItems() > 0 && (
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 lg:px-3 lg:py-1 rounded-full text-xs lg:text-sm font-bold">
                  {getTotalItems()}
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
                          >
                            <Minus className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-red-500" />
                          </button>
                          <span className="font-bold text-base lg:text-lg w-6 lg:w-8 text-center text-gray-800">
                            {c.qty}
                          </span>
                          <button
                            onClick={() => changeQty(c.item.id, 1)}
                            className="bg-purple-50 hover:bg-purple-100 p-1 lg:p-1.5 rounded-md border border-purple-200 transition-all duration-300"
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
                        ฿{getTotalPrice()}
                      </span>
                    </div>
                    <div className="mt-1 lg:mt-2 text-xs lg:text-sm text-gray-500">
                      {getTotalItems()} รายการ
                    </div>
                  </div>
                </div>

                <button
                  onClick={submitOrder}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 lg:py-4 px-4 lg:px-6 rounded-xl lg:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none group text-sm lg:text-base"
                >
                  {sending ? (
                    <span className="flex items-center justify-center space-x-2 lg:space-x-3">
                      <div className="animate-spin rounded-full h-4 w-4 lg:h-5 lg:w-5 border-2 lg:border-[3px] border-white border-t-transparent" />
                      <span>กำลังส่งออร์เดอร์...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2 lg:space-x-3">
                      <Utensils className="h-4 w-4 lg:h-5 lg:w-5 group-hover:animate-bounce" />
                      <span>ยืนยันสั่งอาหาร</span>
                      <div className="bg-white/20 px-2 py-0.5 lg:px-3 lg:py-1 rounded-full">
                        <span className="text-xs lg:text-sm font-bold">
                          ฿{getTotalPrice()}
                        </span>
                      </div>
                    </span>
                  )}
                </button>

                <div className="mt-3 lg:mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    คำสั่งซื้อจะถูกส่งไปยังครัวทันที
                  </p>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Buttons - ปรับขนาดและตำแหน่งสำหรับมือถือ */}
      <div className="fixed bottom-4 right-4 flex flex-col space-y-2 z-40">
        {favorites.size > 0 && (
          <button className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-3 lg:p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group">
            <Heart className="h-5 w-5 lg:h-6 lg:w-6 fill-current" />
            <span className="absolute -top-1 -right-1 bg-white text-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {favorites.size}
            </span>
          </button>
        )}
        <button className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-3 lg:p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
          <Share2 className="h-5 w-5 lg:h-6 lg:w-6" />
        </button>
      </div>

      {/* เพิ่ม padding-bottom เพื่อป้องกันเนื้อหาถูกปุ่มลอยทับบนมือถือ */}
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
