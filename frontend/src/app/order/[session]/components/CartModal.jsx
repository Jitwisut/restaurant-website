"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShoppingCart,
    Plus,
    Minus,
    Utensils,
    Loader2,
    WifiOff,
    X,
} from "lucide-react";

export default function CartModal({
    isOpen,
    onClose,
    cart,
    totalPrice,
    totalItems,
    changeQty,
    submitOrder,
    sending,
    isOnline,
    wsStatus,
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="fixed inset-x-4 top-20 bottom-20 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md md:h-auto md:max-h-[80vh] bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl z-50 overflow-hidden border border-white/50"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-red-400  p-4 md:p-6 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="bg-white/20 p-2 rounded-xl">
                                    <ShoppingCart className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-white">
                                        ตะกร้าของคุณ
                                    </h2>
                                    {totalItems > 0 && (
                                        <p className="text-white/80 text-sm">
                                            {totalItems} รายการ
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-all duration-300"
                                aria-label="ปิด"
                            >
                                <X className="h-6 w-6 text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex flex-col h-[calc(100%-180px)] md:h-auto md:max-h-[50vh]">
                            {cart.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-8">
                                    <div className="text-center">
                                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100">
                                            <div className="relative mb-4">
                                                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto" />
                                                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 rounded-full blur-md"></div>
                                            </div>
                                            <p className="text-gray-500 text-base mb-2">
                                                ตะกร้าว่างเปล่า
                                            </p>
                                            <p className="text-gray-400 text-sm">
                                                เลือกเมนูที่ชอบเพื่อเริ่มสั่งอาหาร
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Cart Items */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-3">
                                        {cart.map((c) => (
                                            <div
                                                key={c.item.id}
                                                className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100 hover:shadow-md transition-all duration-300"
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
                                                            className="bg-red-50 hover:bg-red-100 p-1.5 rounded-md border border-red-200 transition-all duration-300"
                                                            aria-label="ลดจำนวน"
                                                        >
                                                            <Minus className="h-3 w-3 text-red-500" />
                                                        </button>
                                                        <span className="font-bold text-lg w-8 text-center text-gray-800">
                                                            {c.qty}
                                                        </span>
                                                        <button
                                                            onClick={() => changeQty(c.item.id, 1)}
                                                            className="bg-purple-50 hover:bg-purple-100 p-1.5 rounded-md border border-purple-200 transition-all duration-300"
                                                            aria-label="เพิ่มจำนวน"
                                                        >
                                                            <Plus className="h-3 w-3 text-purple-600" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer */}
                                    <div className="p-4 md:p-6 bg-white/80 backdrop-blur-sm border-t border-gray-200">
                                        {/* Total */}
                                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100 mb-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-lg font-bold text-gray-800">
                                                    รวมทั้งหมด
                                                </span>
                                                <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                                    ฿{totalPrice}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-sm text-gray-500">
                                                {totalItems} รายการ
                                            </div>
                                        </div>

                                        {/* Submit Button */}
                                        <button
                                            onClick={() => {
                                                submitOrder();
                                                onClose();
                                            }}
                                            disabled={sending || !isOnline || wsStatus !== "connected"}
                                            className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none group"
                                            aria-label="ยืนยันสั่งอาหาร"
                                        >
                                            {sending ? (
                                                <span className="flex items-center justify-center space-x-3">
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    <span>กำลังส่งออร์เดอร์...</span>
                                                </span>
                                            ) : !isOnline ? (
                                                <span className="flex items-center justify-center space-x-3">
                                                    <WifiOff className="h-5 w-5" />
                                                    <span>ไม่มีอินเทอร์เน็ต</span>
                                                </span>
                                            ) : wsStatus !== "connected" ? (
                                                <span className="flex items-center justify-center space-x-3">
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    <span>กำลังเชื่อมต่อ...</span>
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center space-x-3">
                                                    <Utensils className="h-5 w-5 group-hover:animate-bounce" />
                                                    <span>ยืนยันสั่งอาหาร</span>
                                                    <div className="bg-white/20 px-3 py-1 rounded-full">
                                                        <span className="text-sm font-bold">
                                                            ฿{totalPrice}
                                                        </span>
                                                    </div>
                                                </span>
                                            )}
                                        </button>

                                        <div className="mt-3 text-center">
                                            <p className="text-xs text-gray-500">
                                                {wsStatus === "connected"
                                                    ? "คำสั่งซื้อจะถูกส่งไปยังครัวทันที"
                                                    : "กรุณารอระบบเชื่อมต่อ"}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

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
            `}</style>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
