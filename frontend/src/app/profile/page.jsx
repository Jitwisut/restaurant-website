"use client";

import axios from "axios";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [showName, setShowName] = useState(false);
  const [username, setUsername] = useState(""); // ← เปลี่ยนเป็นวิธีดึงชื่อจริงตามที่คุณต้องการ
  useEffect(() => {
    const fetchdata = async () => {
      const url =
        "https://influential-denice-jitwisutthobut-4bb0d3cf.koyeb.app";
      const res = await axios.get(`${url}/profile`, { withCredentials: true });
      if (res.status === 200) {
        setUsername(res.data.user);
      }
    };
    fetchdata();
  });
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-800">
      <button
        onClick={() => setShowName(true)}
        className="bg-black text-white px-6 py-3 rounded"
      >
        แสดงชื่อผู้ใช้
      </button>

      {showName && <p className="mt-4 text-lg font-semibold">{username}</p>}
    </main>
  );
}
