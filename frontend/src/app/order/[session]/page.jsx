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
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
/* ------------ ตั้งค่าฐาน URL ของ API (จาก .env หรือ fallback) ------------ */
const API = process.env.NEXT_PUBLIC_API_URL;
const WS_BASE = process.env.NEXT_PUBLIC_API_WS;
export default function OrderPage() {
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

  // โหลดข้อมูลโต๊ะ+เมนู
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 border-t-purple-600 mx-auto mb-6" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 animate-pulse" />
          </div>
          <p className="text-gray-700 text-xl font-medium">กำลังโหลดเมนู...</p>
          <div className="mt-4 flex justify-center space-x-1">
            <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce"></div>
            <div
              className="h-2 w-2 bg-pink-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* สถานะ websocket */}
      <div className="fixed bottom-4 left-4 z-50 bg-white/90 px-4 py-2 rounded-xl shadow border">
        <span className="font-medium text-purple-700">{wsStatus}</span>
        {wsError && <div className="text-red-500">{wsError}</div>}
        {wsMessages.length > 0 && (
          <ul className="text-xs text-gray-500 mt-1">
            {wsMessages.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        )}
      </div>
      {/* ------------------ Header ------------------ */}
      <header className="bg-white/80 backdrop-blur-xl shadow-xl sticky top-0 z-50 border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-2xl shadow-lg">
                  <ChefHat className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
                  <Sparkles className="h-3 w-3 text-yellow-800" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                  โต๊ะ {table?.table_number}
                </h1>
                <div className="flex items-center space-x-4 mt-1">
                  <p className="text-gray-600 font-medium flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>เลือกเมนูที่ต้องการสั่ง</span>
                  </p>
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <Users className="h-4 w-4" />
                    <span>4 ที่นั่ง</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
                <ShoppingCart className="h-7 w-7 text-white group-hover:animate-bounce" />
                {getTotalItems() > 0 && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-400 to-red-400 text-white text-sm rounded-full h-8 w-8 flex items-center justify-center font-bold shadow-lg animate-pulse">
                    {getTotalItems()}
                  </div>
                )}
              </div>
              {getTotalItems() > 0 && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded-full shadow-md">
                  <span className="text-xs font-bold text-gray-700">
                    ฿{getTotalPrice()}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาเมนู..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none transition-all bg-white/70 backdrop-blur-sm"
              />
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 rounded-2xl border border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none bg-white/70 backdrop-blur-sm"
              >
                <option value="default">เรียงตาม</option>
                <option value="price-low">ราคา: ต่ำ-สูง</option>
                <option value="price-high">ราคา: สูง-ต่ำ</option>
                <option value="rating">คะแนนสูงสุด</option>
                <option value="popular">ยอดนิยม</option>
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-2xl border transition-all ${
                  showFilters
                    ? "bg-purple-500 text-white border-purple-500"
                    : "bg-white/70 text-gray-700 border-gray-200 hover:border-purple-400"
                }`}
              >
                <Filter className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ------------------ Menu Section ------------------ */}
        <section className="lg:col-span-2">
          {categories.length > 1 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                  <span>หมวดหมู่เมนู</span>
                </h2>
                <div className="text-sm text-gray-500">
                  {filteredMenu.length} รายการ
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-1 ${
                      selectedCategory === cat
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white scale-105 shadow-purple-200"
                        : "bg-white/80 text-gray-700 hover:bg-purple-50 border border-gray-200 backdrop-blur-sm"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredMenu.map((item) => {
              const cartItem = cart.find((c) => c.item.id === item.id);
              const isFavorite = favorites.has(item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden group hover:-translate-y-2 border border-white/50"
                >
                  {item.image && (
                    <div className="relative overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-56 object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <div className="absolute top-4 left-4 flex flex-col space-y-2">
                        {item.category && (
                          <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-800 border border-white/50">
                            {item.category}
                          </span>
                        )}
                        {item.rating && item.rating >= 4.5 && (
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                            <Award className="h-3 w-3" />
                            <span>Best</span>
                          </span>
                        )}
                      </div>
                      <div className="absolute top-4 right-4 flex flex-col space-y-2">
                        {item.rating && (
                          <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-bold text-gray-800">
                              {item.rating}
                            </span>
                          </div>
                        )}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleFavorite(item.id)}
                            className={`p-2 rounded-full backdrop-blur-sm transition-all duration-300 ${
                              isFavorite
                                ? "bg-red-500 text-white shadow-lg"
                                : "bg-white/80 text-gray-600 hover:bg-red-50"
                            }`}
                          >
                            <Heart
                              className={`h-4 w-4 ${
                                isFavorite ? "fill-current" : ""
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => shareMenu(item)}
                            className="p-2 rounded-full bg-white/80 text-gray-600 hover:bg-blue-50 backdrop-blur-sm transition-all duration-300"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-xl text-gray-800 group-hover:text-purple-600 transition-colors">
                        {item.name}
                      </h3>
                      <div className="text-right">
                        <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          ฿{item.price}
                        </span>
                        {item.originalPrice &&
                          item.originalPrice > item.price && (
                            <div className="text-sm text-gray-400 line-through">
                              ฿{item.originalPrice}
                            </div>
                          )}
                      </div>
                    </div>
                    {item.time && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                        <Clock className="h-4 w-4" />
                        <span>{item.time}</span>
                      </div>
                    )}
                    {item.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    {cartItem ? (
                      <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-2xl border border-purple-100">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => changeQty(item.id, -1)}
                            className="bg-white hover:bg-red-50 p-3 rounded-full border-2 border-red-200 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-110"
                          >
                            <Minus className="h-4 w-4 text-red-500" />
                          </button>
                          <span className="font-bold text-2xl w-10 text-center text-gray-800 bg-white px-3 py-2 rounded-xl shadow-md">
                            {cartItem.qty}
                          </span>
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 p-3 rounded-full shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-110"
                          >
                            <Plus className="h-4 w-4 text-white" />
                          </button>
                        </div>
                        <span className="font-bold text-xl text-purple-600 bg-white px-4 py-2 rounded-xl shadow-md">
                          ฿{item.price * cartItem.qty}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 hover:from-purple-600 hover:via-pink-600 hover:to-indigo-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 transform hover:scale-105 transition-all duration-300 group"
                      >
                        <Plus className="h-5 w-5 group-hover:rotate-180 transition-transform duration-300" />
                        <span>เพิ่มลงตะกร้า</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filteredMenu.length === 0 && (
            <div className="text-center py-16">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 shadow-xl border border-white/50">
                <div className="relative mb-6">
                  <Utensils className="h-20 w-20 text-gray-300 mx-auto" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 rounded-full blur-xl"></div>
                </div>
                <p className="text-gray-500 text-xl mb-4">ไม่พบเมนูที่ค้นหา</p>
                <p className="text-gray-400 text-sm">
                  ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น
                </p>
              </div>
            </div>
          )}
        </section>
        {/* ------------------ Cart Section ------------------ */}
        <aside className="lg:col-span-1">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sticky top-32 border border-white/50">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-xl">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <span>ตะกร้าของคุณ</span>
              {getTotalItems() > 0 && (
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {getTotalItems()}
                </span>
              )}
            </h2>
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100">
                  <div className="relative mb-4">
                    <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto" />
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 rounded-full blur-lg"></div>
                  </div>
                  <p className="text-gray-500 text-lg mb-2">ตะกร้าว่างเปล่า</p>
                  <p className="text-gray-400 text-sm">
                    เลือกเมนูที่ชอบเพื่อเริ่มสั่งอาหาร
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto custom-scrollbar">
                  {cart.map((c) => (
                    <div
                      key={c.item.id}
                      className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-800 flex-1">
                          {c.item.name}
                        </h4>
                        <span className="text-lg font-bold text-purple-600 ml-2">
                          ฿{c.item.price * c.qty}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          ฿{c.item.price} × {c.qty}
                        </span>
                        <div className="flex items-center space-x-3 bg-white rounded-xl p-1 shadow-sm">
                          <button
                            onClick={() => changeQty(c.item.id, -1)}
                            className="bg-red-50 hover:bg-red-100 p-2 rounded-lg border border-red-200 transition-all duration-300"
                          >
                            <Minus className="h-3 w-3 text-red-500" />
                          </button>
                          <span className="font-bold text-lg w-8 text-center text-gray-800">
                            {c.qty}
                          </span>
                          <button
                            onClick={() => changeQty(c.item.id, 1)}
                            className="bg-purple-50 hover:bg-purple-100 p-2 rounded-lg border border-purple-200 transition-all duration-300"
                          >
                            <Plus className="h-3 w-3 text-purple-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-gray-800">
                        รวมทั้งหมด
                      </span>
                      <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        ฿{getTotalPrice()}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {getTotalItems()} รายการ
                    </div>
                  </div>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-5 px-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none group"
                >
                  {sending ? (
                    <span className="flex items-center justify-center space-x-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent" />
                      <span className="text-lg">กำลังส่งออร์เดอร์...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-3">
                      <Utensils className="h-6 w-6 group-hover:animate-bounce" />
                      <span className="text-lg">ยืนยันสั่งอาหาร</span>
                      <div className="bg-white/20 px-3 py-1 rounded-full">
                        <span className="text-sm font-bold">
                          ฿{getTotalPrice()}
                        </span>
                      </div>
                    </span>
                  )}
                </button>
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    คำสั่งซื้อจะถูกส่งไปยังครัวทันที
                  </p>
                </div>
              </>
            )}
          </div>
          {cart.length > 0 && (
            <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-4 border border-white/50">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <span>การดำเนินการเร็ว</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCart([])}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-medium py-3 px-4 rounded-xl border border-red-200 transition-all duration-300 text-sm"
                >
                  ล้างตะกร้า
                </button>
                <button className="bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium py-3 px-4 rounded-xl border border-blue-200 transition-all duration-300 text-sm">
                  บันทึก
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
      <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-40">
        {favorites.size > 0 && (
          <button className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 group">
            <Heart className="h-6 w-6 fill-current group-hover:animate-pulse" />
            <span className="absolute -top-2 -right-2 bg-white text-red-500 text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
              {favorites.size}
            </span>
          </button>
        )}
        <button className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110">
          <Share2 className="h-6 w-6" />
        </button>
      </div>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
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
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
