"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart, Plus, Minus, Utensils, Clock, Star } from "lucide-react";

/* ------------ ตั้งค่าฐาน URL ของ API (จาก .env หรือ fallback) ------------ */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/* ======================================================================= */
export default function OrderPage() {
  /* ---------- ดึงค่าพารามิเตอร์จาก URL ---------- */
  const { session: sessionHash } = useParams(); // /order/[session]
  const router = useRouter();

  /* ---------- state หลัก ---------- */
  const [loading, setLoading] = useState(true); // หน้าโหลดโต๊ะ
  const [table, setTable] = useState(null); // ข้อมูลโต๊ะ
  const [menu, setMenu] = useState([]); // รายการเมนู
  const [cart, setCart] = useState([]); // ตะกร้า
  const [sending, setSending] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");

  /* ---------- โหลดข้อมูลโต๊ะ + เมนู ครั้งแรก ---------- */
  useEffect(() => {
    // ตรวจ hash ว่ามีโต๊ะจริงไหม
    const loadTable = async () => {
      try {
        const res = await axios.get(`${API}/tables/checktable/${sessionHash}`, {
          withCredentials: true,
        });
        if (res.status === 200) setTable(res.data.table);
      } catch {
        alert("QR ไม่ถูกต้องหรือหมดอายุ");
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };

    // โหลดเมนู
    const loadMenu = async () => {
      try {
        const { data } = await axios.get(`${API}/menu/get`, {
          withCredentials: true,
        });

        /* --- ดักทุกกรณีให้ menu กลายเป็น Array --- */
        const list = Array.isArray(data)
          ? data // server ส่งอาร์เรย์ตรง ๆ
          : Array.isArray(data.menu)
          ? data.menu // server ส่ง { menu: [...] }
          : []; // กรณีอื่น → อาร์เรย์ว่าง
        setMenu(list);
      } catch (err) {
        console.error("โหลดเมนูไม่สำเร็จ:", err);
        setMenu([]); // กัน map() ล้ม
      }
    };

    loadTable();
    loadMenu();
  }, [sessionHash, router]);

  /* ---------- หมวดหมู่ & ตัวกรอง ---------- */
  const categories = [
    "ทั้งหมด",
    ...new Set(
      (Array.isArray(menu) ? menu : []).map((i) => i.category).filter(Boolean)
    ),
  ];

  const filteredMenu =
    selectedCategory === "ทั้งหมด"
      ? menu
      : menu.filter((i) => i.category === selectedCategory);

  /* ---------- ฟังก์ชันจัดการตะกร้า ---------- */
  const addToCart = (item) =>
    setCart((prev) => {
      const found = prev.find((i) => i.item.id === item.id);
      return found
        ? prev.map((i) =>
            i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i
          )
        : [...prev, { item, qty: 1 }];
    });

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

  /* ---------- ส่งออร์เดอร์ ---------- */
  const submitOrder = async () => {
    if (cart.length === 0) {
      alert("ยังไม่ได้เลือกเมนู");
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/orders`, {
        session: sessionHash,
        items: cart.map((c) => ({ id: c.item.id, qty: c.qty })),
      });
      alert("สั่งอาหารเรียบร้อย!");
      setCart([]);
    } catch (err) {
      alert(err?.response?.data?.message || "สั่งอาหารไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  /* ---------- หน้า Loading ---------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">กำลังโหลดเมนู...</p>
        </div>
      </div>
    );
  }

  /* =========================== JSX หลัก =========================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      {/* ------------------ Header ------------------ */}
      <header className="bg-white/90 backdrop-blur-sm shadow-lg sticky top-0 z-50 border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-orange-400 to-red-400 p-3 rounded-xl shadow-md">
              <Utensils className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                โต๊ะ {table?.table_number}
              </h1>
              <p className="text-gray-500 font-medium">
                เลือกเมนูที่ต้องการสั่ง
              </p>
            </div>
          </div>
          {/* Cart Icon */}
          <div className="relative">
            <div className="bg-gradient-to-r from-orange-400 to-red-400 p-4 rounded-xl shadow-lg hover:shadow-xl transition-transform hover:scale-105 cursor-pointer">
              <ShoppingCart className="h-6 w-6 text-white" />
              {getTotalItems() > 0 && (
                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full h-7 w-7 flex items-center justify-center font-bold shadow-lg animate-pulse">
                  {getTotalItems()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ------------------ Menu Section ------------------ */}
        <section className="lg:col-span-2">
          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                หมวดหมู่เมนู
              </h2>
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-6 py-3 rounded-full font-medium transition-all shadow-md ${
                      selectedCategory === cat
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white scale-105"
                        : "bg-white text-gray-700 hover:bg-orange-50 border border-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Menu Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMenu.map((item) => {
              const cartItem = cart.find((c) => c.item.id === item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition overflow-hidden group hover:-translate-y-1"
                >
                  {item.image && (
                    <div className="relative">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      {item.rating && (
                        <div className="absolute top-4 right-4 bg-white/95 px-3 py-1 rounded-full shadow-md flex items-center space-x-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-bold text-gray-800">
                            {item.rating}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-xl text-gray-800 group-hover:text-orange-600">
                        {item.name}
                      </h3>
                      <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                        ฿{item.price}
                      </span>
                    </div>

                    {(item.category || item.time) && (
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                        {item.category && (
                          <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-medium">
                            {item.category}
                          </span>
                        )}
                        {item.time && (
                          <span className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{item.time}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {item.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    {/* Add / Qty Buttons */}
                    {cartItem ? (
                      <div className="flex items-center justify-between bg-orange-50 p-3 rounded-xl">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => changeQty(item.id, -1)}
                            className="bg-white hover:bg-red-50 p-2 rounded-full border border-red-200 shadow-md"
                          >
                            <Minus className="h-4 w-4 text-red-500" />
                          </button>
                          <span className="font-bold text-xl w-8 text-center text-gray-800">
                            {cartItem.qty}
                          </span>
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 p-2 rounded-full shadow-md"
                          >
                            <Plus className="h-4 w-4 text-white" />
                          </button>
                        </div>
                        <span className="font-bold text-lg text-orange-600">
                          ฿{item.price * cartItem.qty}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 transform hover:scale-105 transition"
                      >
                        <Plus className="h-5 w-5" />
                        <span>เพิ่มลงตะกร้า</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMenu.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <Utensils className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">ไม่พบเมนูในหมวดหมู่นี้</p>
              </div>
            </div>
          )}
        </section>

        {/* ------------------ Cart Section ------------------ */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-24">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
              <ShoppingCart className="h-6 w-6 text-orange-500" />
              <span>ตะกร้าของคุณ</span>
            </h2>

            {cart.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-gray-50 rounded-xl p-6">
                  <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">ยังไม่ได้เลือกเมนู</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {cart.map((c) => (
                    <div
                      key={c.item.id}
                      className="bg-orange-50 rounded-xl p-4 border border-orange-100"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-800">
                          {c.item.name}
                        </h4>
                        <span className="text-sm font-bold text-orange-600">
                          ฿{c.item.price * c.qty}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          ฿{c.item.price} × {c.qty}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => changeQty(c.item.id, -1)}
                            className="bg-white hover:bg-red-50 p-1 rounded-full border border-red-200 transition"
                          >
                            <Minus className="h-3 w-3 text-red-500" />
                          </button>
                          <span className="font-bold text-sm w-6 text-center">
                            {c.qty}
                          </span>
                          <button
                            onClick={() => changeQty(c.item.id, 1)}
                            className="bg-orange-200 hover:bg-orange-300 p-1 rounded-full transition"
                          >
                            <Plus className="h-3 w-3 text-orange-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span className="text-gray-800">รวมทั้งหมด</span>
                    <span className="text-2xl bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                      ฿{getTotalPrice()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={submitOrder}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {sending ? (
                    <span className="flex items-center justify-center space-x-2">
                      <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>กำลังส่ง...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <Utensils className="h-5 w-5" />
                      <span>ยืนยันสั่งอาหาร</span>
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
