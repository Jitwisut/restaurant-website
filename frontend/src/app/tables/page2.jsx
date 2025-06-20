"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

/*— ตั้งฐาน URL ของ API —*/
const API_BASE = process.env.NEXT_PUBLIC_API || "http://localhost:4000";

/*— การ์ดสรุปจำนวนโต๊ะ —*/
function SummaryCard({ icon, title, value, variant = "blue" }) {
  /* ไล่โทนสีด้วย switch จะปลอดภัยกว่า class name แบบ template-string */
  const bgMap = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    red: "from-red-500 to-red-600",
    amber: "from-amber-500 to-amber-600",
  };
  const textMap = {
    blue: "text-gray-900",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition">
      <div className="flex items-center">
        <div
          className={`w-12 h-12 bg-gradient-to-r ${bgMap[variant]} rounded-xl flex items-center justify-center text-white text-xl mr-4`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className={`text-3xl font-bold ${textMap[variant]}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

/*— ปุ่มกดใน modal —*/
function ActionButton({ color, icon, children, onClick }) {
  const grad =
    color === "green"
      ? "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
      : "from-red-500 to-red-600 hover:from-red-600 hover:to-red-700";
  return (
    <button
      onClick={onClick}
      className={`w-full bg-gradient-to-r ${grad} text-white py-3 rounded-xl font-semibold transition transform hover:scale-105 shadow-lg flex items-center justify-center`}
    >
      <span className="mr-2">{icon}</span>
      {children}
    </button>
  );
}

/*--------------------------------------------------------------------*/

export default function TableManagement() {
  const router = useRouter();

  /* ---------- state ---------- */
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedTable, setSelectedTable] = useState(null);

  const [showQR, setShowQR] = useState(false);
  const [qr64, setQr64] = useState("");
  const [fullurl, setFullurl] = useState("");

  /* ---------- fetch tables ---------- */
  const fetchTables = async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get(`${API_BASE}/tables/gettable`, {
        withCredentials: true,
      });
      setTables(data.tables);
    } catch (err) {
      console.error("Error fetching tables:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [router]);

  /* ---------- helpers ---------- */
  const colorBox = (s) =>
    ({
      available: "from-green-50 to-green-100 border-green-200 shadow-green-100",
      open: "from-red-50 to-red-100 border-red-200 shadow-red-100",
      reserved: "from-amber-50 to-amber-100 border-amber-200 shadow-amber-100",
      maintenance: "from-gray-50 to-gray-100 border-gray-200 shadow-gray-100",
    }[s] || "from-gray-50 to-gray-100 border-gray-200 shadow-gray-100");

  const textColor = (s) =>
    ({
      available: "text-green-800",
      open: "text-red-800",
      reserved: "text-amber-800",
      maintenance: "text-gray-800",
    }[s] || "text-gray-800");

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
      console.log(tables);
      setFullurl(data.fullurl);
      setQr64(data.qr_code_url);
      setShowQR(true);
      setSelectedTable(null);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "เกิดข้อผิดพลาดในการเปิดโต๊ะ");
    }
  };

  const closeTable = async (number) => {
    try {
      const { data } = await axios.post(
        `${API_BASE}/tables/closetable`,
        { number },
        { withCredentials: true }
      );
      setTables((prev) =>
        prev.map((t) =>
          t.table_number === number
            ? { ...t, status: "available", fullurl: null, qr_code_url: null }
            : t
        )
      );
      setSelectedTable(null);
      alert(data.message);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการปิดโต๊ะ");
    }
  };

  /* ---------- loading ---------- */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* === QR Modal === */}
      {showQR && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              สแกน QR เพื่อสั่งอาหาร
            </h2>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-2xl mb-6">
              <img
                src={qr64}
                alt="QR"
                className="w-48 h-48 mx-auto rounded-xl shadow-lg"
              />
              <p className="mt-3 text-xs font-mono break-all text-gray-600">
                {fullurl}
              </p>
            </div>
            <button
              onClick={() => setShowQR(false)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-xl font-semibold"
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>
      )}

      {/* === Header & Summary === */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            ระบบจัดการโต๊ะ
          </h1>
          <p className="text-gray-600 text-lg">
            จัดการโต๊ะและการสั่งอาหารอย่างมีประสิทธิภาพ
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <SummaryCard icon="🏪" title="โต๊ะทั้งหมด" value={tables.length} />
          <SummaryCard
            icon="✨"
            title="โต๊ะว่าง"
            value={countBy("available")}
            variant="green"
          />
          <SummaryCard
            icon="🍽️"
            title="มีลูกค้า"
            value={countBy("open")}
            variant="red"
          />
          <SummaryCard
            icon="📋"
            title="จอง"
            value={countBy("reserved")}
            variant="amber"
          />
        </div>

        {/* === Grid ของโต๊ะ === */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {tables.map((t) => (
            <div
              key={t.table_number}
              onClick={() => setSelectedTable(t)}
              className={`bg-gradient-to-br ${colorBox(
                t.status
              )} border-2 rounded-2xl p-6 cursor-pointer hover:shadow-2xl transition`}
            >
              <div className="text-center">
                <div className="text-4xl mb-3">{iconOf(t.status)}</div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">
                  โต๊ะ {t.table_number}
                </h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${textColor(
                    t.status
                  )} bg-white/50`}
                >
                  {thaiStatus(t.status)}
                </span>

                {Boolean(t.guestCount) && (
                  <p className="mt-2 text-sm text-gray-700 font-medium">
                    👥 {t.guestCount} คน
                  </p>
                )}

                <div className="mt-4 p-3 bg-white/70 rounded-xl border border-white/40">
                  <p className="text-xs text-gray-600 font-semibold mb-1">
                    QR Link
                  </p>
                  <p className="text-xs font-mono break-all text-gray-800">
                    {t.fullurl || "ยังไม่มี QR Code"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === Modal รายละเอียดโต๊ะ === */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  โต๊ะ {selectedTable.table_number}
                </h2>
                <p className="text-gray-600">จัดการสถานะโต๊ะ</p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 font-medium">
                  สถานะปัจจุบัน:
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${textColor(
                    selectedTable.status
                  )} bg-white`}
                >
                  {thaiStatus(selectedTable.status)}
                </span>
              </div>
              {Boolean(selectedTable.guestCount) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">
                    จำนวนลูกค้า:
                  </span>
                  <span className="text-sm font-bold text-gray-800">
                    {selectedTable.guestCount} คน
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <ActionButton
                color="green"
                icon="✨"
                onClick={() => closeTable(selectedTable.table_number)}
              >
                ตั้งเป็นโต๊ะว่าง
              </ActionButton>
              <ActionButton
                color="red"
                icon="🍽️"
                onClick={() => openTable(selectedTable.table_number)}
              >
                เปิดโต๊ะให้ลูกค้า
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
