"use client";
import axios from "axios";
import { use, useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
const api=process.env.NEXT_PUBLIC_BACKEND_URL
export default function RestaurantDashboard() {
  const [activeOrders] = useState(12);
  const [availableTables,setAvailable] = useState();
  const [reserved,setReserved]=useState()
  const [tables,setTables]=useState([])
  const router = useRouter()
  useEffect(() => {
    // ⭐ เรียกใน useEffect เท่านั้น
    const checkAdmin = async () => {
      try {
        const token=sessionStorage.getItem('auth')
        const result = await axios.get(`${api}/middleware/admin`,{
          headers:{
            'Authorization': `Bearer ${token}`
          }
        });
        console.log("You are admin");
      } catch (error) {
        console.log("You not admin");
        router.push('/signin'); // ✅ ตอนนี้ router พร้อมแล้ว
      }
    };
    const fetchtable=async ()=>{
      try{
        const result=await axios.get(`${api}/tables/gettable`)
        const availablecount=result.data.tables.filter(index=>index.status='available').length
        const reservecount=result.data.tables.filter(index=>index.status='reserved').length
        setTables(result.data.tables)
        setAvailable(availablecount)
        setReserved(reservecount)
      }catch(error){
        console.log("Error:",error.message)
      }
    }
    fetchtable()
    checkAdmin();
  }, [router]); // ⭐ ใส่ dependency

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-amber-600">🍽️ RestaurantOS</h1>
            <div className="hidden md:flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button className="px-4 py-2 bg-white dark:bg-gray-600 rounded-md shadow-sm font-medium text-sm">
                Dashboard
              </button>
              <button className="px-4 py-2 hover:bg-white/50 dark:hover:bg-gray-600/50 rounded-md font-medium text-sm text-gray-600 dark:text-gray-300">
                Orders
              </button>
              <button className="px-4 py-2 hover:bg-white/50 dark:hover:bg-gray-600/50 rounded-md font-medium text-sm text-gray-600 dark:text-gray-300">
                Tables
              </button>
              <button className="px-4 py-2 hover:bg-white/50 dark:hover:bg-gray-600/50 rounded-md font-medium text-sm text-gray-600 dark:text-gray-300">
                Menu
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                🔔
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold">
                A
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-semibold">Admin</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">ผู้จัดการ</div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-73px)]">
          <div className="p-4 space-y-2">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              เมนูหลัก
            </div>
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg font-medium">
              <span className="text-xl">📊</span>
              <span>Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              <span className="text-xl">📋</span>
              <span>ออร์เดอร์</span>
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {activeOrders}
              </span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              <span className="text-xl">🪑</span>
              <span>จัดการโต๊ะ</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              <span className="text-xl">🍜</span>
              <span>เมนูอาหาร</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              <span className="text-xl">👥</span>
              <span>พนักงาน</span>
            </a>
            
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-6">
              รายงาน
            </div>
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              <span className="text-xl">💰</span>
              <span>ยอดขาย</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              <span className="text-xl">📈</span>
              <span>สถิติ</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              <span className="text-xl">📦</span>
              <span>คลังสินค้า</span>
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Header Section */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              Dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              ภาพรวมร้านอาหารวันนี้ - {new Date().toLocaleDateString('th-TH', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[
              { 
                title: "ยอดขายวันนี้", 
                value: "฿45,230", 
                change: "+12.5%", 
                icon: "💰",
                color: "bg-green-500",
                trend: "up"
              },
              { 
                title: "ออร์เดอร์ทั้งหมด", 
                value: activeOrders.toString(), 
                change: "8 รอดำเนินการ", 
                icon: "📋",
                color: "bg-blue-500",
                trend: "neutral"
              },
              { 
                title: "โต๊ะว่าง", 
                value: `${availableTables}/15`, 
                change: "7 โต๊ะใช้งาน", 
                icon: "🪑",
                color: "bg-purple-500",
                trend: "neutral"
              },
              { 
                title: "ลูกค้าวันนี้", 
                value: "142", 
                change: "+8.3%", 
                icon: "👥",
                color: "bg-orange-500",
                trend: "up"
              }
            ].map((stat, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl shadow-lg`}>
                    {stat.icon}
                  </div>
                  {stat.trend === "up" && (
                    <span className="text-green-600 dark:text-green-400 text-sm font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                      {stat.change}
                    </span>
                  )}
                </div>
                <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">
                  {stat.title}
                </h3>
                <p className="text-3xl font-bold text-gray-800 dark:text-white">
                  {stat.value}
                </p>
                {stat.trend === "neutral" && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                    {stat.change}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Active Orders */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                  ออร์เดอร์ล่าสุด
                </h3>
                <button className="text-amber-600 hover:text-amber-700 font-medium text-sm">
                  ดูทั้งหมด →
                </button>
              </div>
              
              <div className="space-y-3">
                {[
                  { table: "A-05", items: "ต้มยำกุ้ง, ผัดไทย", status: "กำลังทำ", time: "10:25", color: "bg-yellow-500" },
                  { table: "B-12", items: "แกงเขียวหวาน, ข้าวผัด", status: "พร้อมเสิร์ฟ", time: "10:30", color: "bg-green-500" },
                  { table: "C-08", items: "ส้มตำ, ไก่ย่าง", status: "กำลังทำ", time: "10:32", color: "bg-yellow-500" },
                  { table: "D-03", items: "พะแนงหมู", status: "รอดำเนินการ", time: "10:35", color: "bg-red-500" }
                ].map((order, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className={`${order.color} w-3 h-3 rounded-full`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800 dark:text-white">
                          โต๊ะ {order.table}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {order.time}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {order.items}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full
                      ${order.status === "พร้อมเสิร์ฟ" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : 
                        order.status === "กำลังทำ" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" : 
                        "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
                เมนูด่วน
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors group">
                  <span className="text-3xl group-hover:scale-110 transition-transform">➕</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">ออร์เดอร์ใหม่</span>
                </button>
                
                <Link href="/tables"
                className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors group"
                >
                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors group">
                  <span className="text-3xl group-hover:scale-110 transition-transform">🪑</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">จองโต๊ะ</span>
                </button>
                </Link>
                
                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors group">
                  <span className="text-3xl group-hover:scale-110 transition-transform">🍜</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">เพิ่มเมนู</span>
                </button>
                
                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors group">
                  <span className="text-3xl group-hover:scale-110 transition-transform">📊</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">รายงาน</span>
                </button>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">โปรโมชั่นวันนี้</span>
                  <span className="text-2xl">🎉</span>
                </div>
                <p className="text-sm font-semibold mb-1">ลด 20% เมนูพิเศษ</p>
                <p className="text-xs opacity-90">11:00 - 14:00 น.</p>
              </div>
            </div>
          </div>

          {/* Table Status & Popular Menu */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
                สถานะโต๊ะ
              </h3>
              
              <div className="grid grid-cols-5 gap-3">
                {tables.sort((a,b)=>a.table_number-b.table_number).map((table)=>{
                  console.log(table)
                  const tableNumber=table.table_number
                  const isOccupied=table.status==='available'
                  
                   return (
                    <button
                      key={table.table_number}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 font-semibold transition-all hover:scale-105
                   `}
                    >
                    <span className="text-xl">{isOccupied ? "🔴" : "🟢"}</span>
                      <span className="text-xs">{tableNumber}</span>
                    </button>
                  );
                })}
              </div>
              
              <div className="flex gap-4 mt-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">ว่าง ({availableTables})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">ไม่ว่าง ({reserved}) </span>
                </div>
              </div>
            </div>

            {/* Popular Menu */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
                เมนูขายดีวันนี้
              </h3>
              
              <div className="space-y-4">
                {[
                  { name: "ต้มยำกุ้ง", sold: 24, revenue: "฿6,000", icon: "🍜", trend: "+15%" },
                  { name: "ผัดไทย", sold: 18, revenue: "฿3,240", icon: "🍝", trend: "+8%" },
                  { name: "แกงเขียวหวาน", sold: 15, revenue: "฿3,000", icon: "🥘", trend: "+12%" },
                  { name: "ส้มตำ", sold: 12, revenue: "฿1,800", icon: "🥗", trend: "+5%" }
                ].map((menu, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-2xl shadow-md">
                      {menu.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-800 dark:text-white">
                          {menu.name}
                        </h4>
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                          {menu.trend}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {menu.sold} รายการ • {menu.revenue}
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-amber-600">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
