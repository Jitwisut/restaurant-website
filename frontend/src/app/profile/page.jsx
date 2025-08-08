"use client";

import axios from "axios";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [showName, setShowName] = useState(false);
  const [username, setUsername] = useState("");
  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;
  useEffect(() => {
    const fetchdata = async () => {
      const res = await axios.get(`${baseurl}/profile`, {
        withCredentials: true,
      });
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
