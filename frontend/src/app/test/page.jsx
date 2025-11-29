// app/recent-orders/page.jsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function RecentOrdersPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 flex items-center justify-center p-8">
      {/* ปุ่มเปิด Modal */}
      <motion.button
        whileHover={{
          scale: 1.05,
          boxShadow: "0 10px 30px rgba(249, 115, 22, 0.3)",
        }}
        whileTap={{ scale: 0.95 }}
        onClick={openModal}
        className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xl font-bold rounded-2xl shadow-xl"
      >
        ดูรายการอาหารที่สั่งล่าสุด 🍽️
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && <OrdersModal closeModal={closeModal} />}
      </AnimatePresence>
    </div>
  );
}

function OrdersModal({ closeModal }) {
  const [orders, setOrders] = useState([
    {
      id: "1",
      name: "ผัดไทย",
      price: 60,
      quantity: 2,
      image: "🍜",
      time: "5 นาทีที่แล้ว",
    },
    {
      id: "2",
      name: "ส้มตำ",
      price: 45,
      quantity: 1,
      image: "🥗",
      time: "10 นาทีที่แล้ว",
    },
    {
      id: "3",
      name: "ต้มยำกุ้ง",
      price: 120,
      quantity: 1,
      image: "🍲",
      time: "15 นาทีที่แล้ว",
    },
    {
      id: "4",
      name: "ข้าวผัด",
      price: 50,
      quantity: 3,
      image: "🍚",
      time: "20 นาทีที่แล้ว",
    },
  ]);

  // Backdrop variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  // Modal variants
  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: -50,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 50,
      transition: {
        duration: 0.3,
      },
    },
  };

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  // Item animation variants
  const itemVariants = {
    hidden: {
      opacity: 0,
      x: -30,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
    hover: {
      scale: 1.02,
      y: -3,
      boxShadow: "0 15px 30px rgba(0,0,0,0.12)",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10,
      },
    },
  };

  const handleRemoveOrder = (id) => {
    setOrders(orders.filter((order) => order.id !== id));
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={closeModal}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      >
        {/* Modal Content */}
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold mb-1">
                  รายการอาหารที่สั่งล่าสุด
                </h2>
                <p className="text-white/90">ทั้งหมด {orders.length} รายการ</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={closeModal}
                className="text-white text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                ×
              </motion.button>
            </div>
          </div>

          {/* Orders List */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
            <AnimatePresence mode="popLayout">
              <motion.ul
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                {orders.map((order) => (
                  <motion.li
                    key={order.id}
                    variants={itemVariants}
                    layout
                    whileHover="hover"
                    exit={{
                      opacity: 0,
                      x: 100,
                      scale: 0.8,
                      transition: { duration: 0.3 },
                    }}
                    className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl shadow-md overflow-hidden"
                  >
                    <div className="flex items-center p-4 gap-4">
                      {/* Image/Icon */}
                      <motion.div
                        whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                        transition={{ duration: 0.5 }}
                        className="text-5xl"
                      >
                        {order.image}
                      </motion.div>

                      {/* Order Details */}
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-800">
                          {order.name}
                        </h3>
                        <p className="text-gray-500 text-sm">{order.time}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-orange-600 font-semibold">
                            ฿{order.price}
                          </span>
                          <span className="text-gray-600 text-sm">
                            จำนวน: {order.quantity}
                          </span>
                        </div>
                      </div>

                      {/* Price and Actions */}
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xl font-bold text-orange-600">
                          ฿{order.price * order.quantity}
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleRemoveOrder(order.id)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                        >
                          ลบ
                        </motion.button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </AnimatePresence>

            {/* Empty State */}
            {orders.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <p className="text-2xl text-gray-400">ไม่มีรายการอาหาร</p>
              </motion.div>
            )}
          </div>

          {/* Footer - Total */}
          {orders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 text-white"
            >
              <div className="flex justify-between items-center">
                <span className="text-xl font-semibold">ยอดรวมทั้งหมด</span>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                  className="text-3xl font-bold"
                >
                  ฿
                  {orders.reduce(
                    (sum, order) => sum + order.price * order.quantity,
                    0
                  )}
                </motion.span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
