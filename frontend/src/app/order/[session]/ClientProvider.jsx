// app/order/ClientProviders.jsx              ⬅️  (Client Component)
"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import UserWSProvider from "@/app/components/UserProvider"; // ชื่อเดียวกับที่คุณใช้
//  ^-- ในตัวอย่างเก่าเราสร้างไว้แล้ว ถ้า path ต่างให้แก้ตามจริง

export default function ClientProviders({ children }) {
  const [username, setUsername] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:4000/profile/", { withCredentials: true }) // ถ้ามีระบบล็อกอิน
      .then((r) => setUsername(r.data.user))
      .catch(() =>
        setUsername(localStorage.getItem("guest-id") ?? createGuestId())
      );
  }, []);

  if (!username) return null; // ยังไม่รู้ชื่อ → render ว่าง

  return (
    <UserWSProvider username={username /* <-- สำคัญ */}>
      {children}
    </UserWSProvider>
  );
}

function createGuestId() {
  const id = `guest-${crypto.randomUUID()}`;
  localStorage.setItem("guest-id", id);
  return id;
}
