"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

/*— ตั้งฐาน URL ของ API —*/
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

/*— การ์ดสรุปจำนวนโต๊ะ —*/
function SummaryCard({ icon, title, value, variant = "blue", subtitle }) {
  const bgMap = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    red: "from-red-500 to-red-600",
    amber: "from-amber-500 to-amber-600",
    purple: "from-purple-500 to-purple-600",
  };

  const cardBgMap = {
    blue: "from-blue-50 to-blue-100",
    green: "from-green-50 to-green-100",
    red: "from-red-50 to-red-100",
    amber: "from-amber-50 to-amber-100",
    purple: "from-purple-50 to-purple-100",
  };

  return (
    <div
      className={`bg-gradient-to-br ${cardBgMap[variant]} backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/40 hover:shadow-xl transition-all duration-300 transform hover:scale-105`}
    >
      <div className="flex items-center">
        <div
          className={`w-14 h-14 bg-gradient-to-r ${bgMap[variant]} rounded-xl flex items-center justify-center text-white text-2xl mr-4 shadow-lg`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-semibold mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

/*— ปุ่มกดใน modal —*/
function ActionButton({
  color,
  icon,
  children,
  onClick,
  disabled = false,
  loading = false,
}) {
  const gradientMap = {
    green:
      "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    red: "from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
    blue: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
    amber:
      "from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full bg-gradient-to-r ${gradientMap[color]} text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
      ) : (
        <span className="mr-2">{icon}</span>
      )}
      {loading ? "กำลังดำเนินการ..." : children}
    </button>
  );
}

/*— Toast Notification —*/
function Toast({ message, type, onClose }) {
  const bgMap = {
    success: "from-green-500 to-green-600",
    error: "from-red-500 to-red-600",
    info: "from-blue-500 to-blue-600",
  };

  const iconMap = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };

  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div
        className={`bg-gradient-to-r ${bgMap[type]} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center max-w-sm`}
      >
        <span className="text-xl mr-3">{iconMap[type]}</span>
        <p className="font-medium">{message}</p>
        <button
          onClick={onClose}
          className="ml-4 text-white/80 hover:text-white text-xl font-bold"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/*— Filter Buttons —*/
function FilterButton({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
        active
          ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
          : "bg-white/70 text-gray-700 hover:bg-white/90 hover:shadow-md"
      }`}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            active ? "bg-white/20" : "bg-gray-200"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/*--------------------------------------------------------------------*/

export default function TableManagement() {
  const router = useRouter();

  /* ---------- state ---------- */
  const [tables, setTables] = useState([]);
  const [filteredTables, setFilteredTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qr64, setQr64] = useState("");
  const [fullurl, setFullurl] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const showToast = useCallback((message, type) => {
    setToast({ message, type });
  }, []);

  /* ---------- fetch tables ---------- */
  const fetchTables = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get(`${API_BASE}/tables/gettable`, {
        withCredentials: true,
      });
      console.log(data);
      //จัดเรียงข้อมูลก่อนบันทึกลงตาราง
      setTables(data.tables.sort((a,b)=>a.table_number-b.table_number));
      setFilteredTables(data.tables);
    } catch (err) {
      console.error("Error fetching tables:", err);
      showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  /* ---------- filter and search ---------- */
  useEffect(() => {
    let filtered = tables;

    // Filter by status
    if (filter !== "all") {
      filtered = filtered.filter((table) => table.status === filter);
    }

    // Search by table number
    if (searchTerm) {
      filtered = filtered.filter((table) =>
        table.table_number.toString().includes(searchTerm)
      );
    }

    setFilteredTables(filtered);
  }, [tables, filter, searchTerm]);

  /* ---------- helpers ---------- */
  const colorBox = (s) =>
    ({
      available: "from-green-50 to-green-100 border-green-200 shadow-green-100",
      open: "from-red-50 to-red-100 border-red-200 shadow-red-100",
      reserved: "from-amber-50 to-amber-100 border-amber-200 shadow-amber-100",
      maintenance: "from-gray-50 to-gray-100 border-gray-200 shadow-gray-100",
    }[s] || "from-gray-50 to-gray-100 border-gray-200 shadow-gray-100");

  const iconOf = (s) =>
    ({
      available: "✨",
      open: "🍽️",
      reserved: "📋",
      maintenance: "🔧",
    }[s] || "❓");

  const thaiStatus = (s) =>
    ({
      available: "ว่าง",
      open: "มีลูกค้า",
      reserved: "จอง",
      maintenance: "ปรับปรุง",
    }[s] || "ไม่ทราบ");

  const countBy = (s) => tables.filter((t) => t.status === s).length;

  /* ---------- actions ---------- */
  const openTable = async (number) => {
    try {
      setActionLoading(true);
      const { data } = await axios.post(
        `${API_BASE}/tables/opentable`,
        { number },
        { withCredentials: true }
      );

      setTables((prev) =>
        prev.map((t) =>
          t.table_number === number
            ? {
                ...t,
                status: "open",
                fullurl: data.fullurl,
                qr_code_url: data.qr_code_url,
              }
            : t
        )
      );

      setFullurl(data.fullurl);
      setQr64(data.qr_code_url);
      setShowQR(true);
      setSelectedTable(null);
      showToast(`เปิดโต๊ะ ${number} เรียบร้อยแล้ว`, "success");
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message || "เกิดข้อผิดพลาดในการเปิดโต๊ะ",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const closeTable = async (number) => {
    try {
      setActionLoading(true);
      const token = sessionStorage.getItem("auth");
      const { data } = await axios.post(
        `${API_BASE}/tables/closetable`,
        { number },
        { 
          withCredentials: true,
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setTables((prev) =>
        prev.map((t) =>
          t.table_number === number
            ? { ...t, status: "available", fullurl: null, qr_code_url: null }
            : t
        )
      );

      setSelectedTable(null);
      showToast(data.message || `ปิดโต๊ะ ${number} เรียบร้อยแล้ว`, "success");
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการปิดโต๊ะ", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const refreshData = async () => {
    await fetchTables();
    showToast("รีเฟรชข้อมูลเรียบร้อย", "info");
  };

  /* ---------- loading ---------- */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg font-medium">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* === QR Modal === */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            minWidth: "100vw",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl text-center animate-scale-in"
            style={{
              width: 520,
              maxWidth: "calc(100vw - 48px)",
              minWidth: "min(360px, calc(100vw - 48px))",
              maxHeight: "92vh",
              overflowY: "auto",
              overflowX: "hidden",
              padding: 32,
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white">📱</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              สแกน QR เพื่อสั่งอาหาร
            </h2>
            <p className="text-gray-600 mb-6">ให้ลูกค้าสแกน QR Code ด้านล่าง</p>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl mb-6">
              <Image
                src={qr64}
                alt="QR Code"
                width={192}
                height={192}
                unoptimized
                className="w-48 h-48 mx-auto rounded-xl shadow-lg bg-white p-2"
              />
              <p
                className="mt-4 text-xs font-mono text-gray-600 bg-white/70 p-2 rounded-lg"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  lineHeight: 1.5,
                }}
              >
                {fullurl}
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-xl font-semibold transition-all duration-200"
              >
                เสร็จสิ้น
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-200"
              >
                🖨️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Header & Controls === */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div className="mb-4 lg:mb-0">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              ระบบจัดการโต๊ะ
            </h1>
            <p className="text-gray-600 text-lg">
              จัดการโต๊ะและการสั่งอาหารอย่างมีประสิทธิภาพ
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={refreshData}
              className="px-4 py-2 bg-white/70 hover:bg-white text-gray-700 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg"
            >
              🔄 รีเฟรช
            </button>
          </div>
        </div>

        {/* === Summary Cards === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <SummaryCard
            icon="🏪"
            title="โต๊ะทั้งหมด"
            value={tables.length}
            variant="blue"
            subtitle="จำนวนโต๊ะทั้งหมด"
          />
          <SummaryCard
            icon="✨"
            title="โต๊ะว่าง"
            value={countBy("available")}
            variant="green"
            subtitle="พร้อมให้บริการ"
          />
          <SummaryCard
            icon="🍽️"
            title="มีลูกค้า"
            value={countBy("open")}
            variant="red"
            subtitle="กำลังให้บริการ"
          />
          <SummaryCard
            icon="📋"
            title="จอง"
            value={countBy("reserved")}
            variant="amber"
            subtitle="มีการจองไว้"
          />
          <SummaryCard
            icon="🔧"
            title="ปรับปรุง"
            value={countBy("maintenance")}
            variant="purple"
            subtitle="ไม่พร้อมใช้งาน"
          />
        </div>

        {/* === Filters & Search === */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-wrap gap-3">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
                count={tables.length}
              >
                ทั้งหมด
              </FilterButton>
              <FilterButton
                active={filter === "available"}
                onClick={() => setFilter("available")}
                count={countBy("available")}
              >
                ✨ ว่าง
              </FilterButton>
              <FilterButton
                active={filter === "open"}
                onClick={() => setFilter("open")}
                count={countBy("open")}
              >
                🍽️ มีลูกค้า
              </FilterButton>
              <FilterButton
                active={filter === "reserved"}
                onClick={() => setFilter("reserved")}
                count={countBy("reserved")}
              >
                📋 จอง
              </FilterButton>
              <FilterButton
                active={filter === "maintenance"}
                onClick={() => setFilter("maintenance")}
                count={countBy("maintenance")}
              >
                🔧 ปรับปรุง
              </FilterButton>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาโต๊ะ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          </div>
        </div>

        {/* === Grid ของโต๊ะ === */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredTables.map((t) => (
            <div
              key={t.table_number}
              onClick={() => setSelectedTable(t)}
              className={`bg-gradient-to-br ${colorBox(
                t.status
              )} border-2 rounded-2xl p-6 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}
            >
              <div className="text-center">
                <div className="text-5xl mb-4">{iconOf(t.status)}</div>
                <h3 className="text-2xl font-bold mb-3 text-gray-800">
                  โต๊ะ {t.table_number}
                </h3>
                <span className="inline-block px-4 py-2 rounded-full text-sm font-bold text-gray-800 bg-white/80 shadow-sm">
                  {thaiStatus(t.status)}
                </span>

                {Boolean(t.guestCount) && (
                  <p className="mt-3 text-sm text-gray-700 font-semibold bg-white/50 rounded-lg p-2">
                    👥 {t.guestCount} คน
                  </p>
                )}

                <div className="mt-4 p-3 bg-white/80 rounded-xl border border-white/60 shadow-sm">
                  <p className="text-xs text-gray-600 font-bold mb-1">
                    QR Link Status
                  </p>
                  <p className="text-xs font-mono break-all text-gray-800">
                    {t.qr_code_url ? "🟢 มี QR Code" : "🔴 ยังไม่มี QR Code"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTables.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">
              ไม่พบโต๊ะที่ค้นหา
            </h3>
            <p className="text-gray-500">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
          </div>
        )}
      </div>

      {/* === Modal รายละเอียดโต๊ะ === */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  โต๊ะ {selectedTable.table_number}
                </h2>
                <p className="text-gray-600">จัดการสถานะโต๊ะ</p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-all duration-200"
              >
                ✕
              </button>
            </div>

            <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600 font-semibold">
                  สถานะปัจจุบัน:
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-bold text-gray-800 bg-white shadow-sm">
                  {iconOf(selectedTable.status)}{" "}
                  {thaiStatus(selectedTable.status)}
                </span>
              </div>

              {Boolean(selectedTable.guestCount) && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600 font-semibold">
                    จำนวนลูกค้า:
                  </span>
                  <span className="text-sm font-bold text-gray-800">
                    👥 {selectedTable.guestCount} คน
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 font-semibold">
                  QR Code:
                </span>
                <span
                  className={`text-xs font-bold ${
                    selectedTable.qr_code_url
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {selectedTable.qr_code_url ? "🟢 มี" : "🔴 ไม่มี"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {selectedTable.status !== "available" && (
                <ActionButton
                  color="green"
                  icon="✨"
                  onClick={() => closeTable(selectedTable.table_number)}
                  loading={actionLoading}
                >
                  ตั้งเป็นโต๊ะว่าง
                </ActionButton>
              )}

              {selectedTable.status === "available" && (
                <ActionButton
                  color="red"
                  icon="🍽️"
                  onClick={() => openTable(selectedTable.table_number)}
                  loading={actionLoading}
                >
                  เปิดโต๊ะให้ลูกค้า
                </ActionButton>
              )}

              {selectedTable.qr_code_url && (
                <ActionButton
                  color="blue"
                  icon="📱"
                  onClick={() => {
                    setQr64(selectedTable.qr_code_url);
                    setFullurl(selectedTable.fullurl);
                    setShowQR(true);
                    setSelectedTable(null);
                  }}
                >
                  แสดง QR Code
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
