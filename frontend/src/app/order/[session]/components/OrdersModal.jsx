"use client";

// ถ้า AnimatePresence หาไม่เจอ ให้ใช้บรรทัดนี้แทน:
// import { motion, AnimatePresence } from "framer-motion";
import { motion, AnimatePresence } from "motion/react";

import { useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChefHat } from "lucide-react";

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.8, y: -50 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", damping: 25, stiffness: 300 },
  },
  exit: { opacity: 0, scale: 0.8, y: 50, transition: { duration: 0.3 } },
};

export default function OrdersModal({
  isOpen,
  onClose,
  orders = [],
  onCallstaff = () => {},
}) {
  const [status, setStatus] = useState("idle"); // idle | calling | success
  const wsRef = useRef(null);

  const handalCallStaff = () => {
    setStatus("calling");
    onCallstaff();
  };

  // แตก items ของ order ที่ pending ออกมาเป็น list รายการอาหาร
  const pendingItems = useMemo(() => {
    const pendingOrders = (orders || []).filter(
      (o) => o && o.status === "pending",
    );
    return pendingOrders.flatMap((o) =>
      (o.items || []).map((it, idx) => ({
        ...it,
        __key: `${o.id}-${idx}-${it.menu_item_name}`, // key กันซ้ำ
      })),
    );
  }, [orders]);

  const totalAmount = useMemo(() => {
    return pendingItems.reduce((sum, it) => {
      const price = Number(it.price) || 0;
      const qty = Number(it.quantity) || 0;
      return sum + price * qty;
    }, 0);
  }, [pendingItems]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            className="app-modal-overlay bg-black/60 backdrop-blur-sm"
            style={{ margin: 0 }}
          >
            {/* Modal Content */}
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="app-modal-card bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              style={{
                "--app-modal-width": "896px",
                width: "min(896px, calc(100vw - 48px))",
                maxWidth: "calc(100vw - 48px)",
                minWidth: "min(360px, calc(100vw - 48px))",
                maxHeight: "calc(100vh - 48px)",
              }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold mb-1 flex items-center gap-2">
                      <ChefHat className="w-7 h-7 lg:w-8 lg:h-8" />
                      รายการอาหารที่สั่ง
                    </h2>
                    <p className="text-white/90">
                      ทั้งหมด {pendingItems.length} รายการ
                    </p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="text-white bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>

              {/* Orders List */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                {pendingItems.length > 0 ? (
                  <div className="space-y-3">
                    {pendingItems.map((item, index) => (
                      <motion.div
                        key={item.__key}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl shadow-md p-4 border border-orange-100"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg lg:text-xl font-semibold text-gray-800 mb-1">
                              {item.menu_item_name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span>จำนวน: {item.quantity}</span>
                              <span className="text-orange-600 font-semibold">
                                ฿{(Number(item.price) || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="text-xl font-bold text-orange-600">
                            ฿
                            {(
                              (Number(item.price) || 0) *
                              (Number(item.quantity) || 0)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    <button
                      onClick={handalCallStaff}
                      className="flex items-center justify-center w-full py-2 mt-4 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
                    >
                      เรียกพนักงาน
                    </button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-16"
                  >
                    <div className="text-9xl mb-6">🍽️</div>
                    <p className="text-2xl text-gray-400 font-medium mb-2">
                      ยังไม่มีรายการอาหาร
                    </p>
                    <p className="text-gray-400">เริ่มต้นสั่งอาหารของคุณเลย!</p>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              {pendingItems.length > 0 && (
                <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-semibold">ยอดรวมทั้งหมด</span>
                    <span className="text-3xl font-bold">
                      ฿{totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof window !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
