// src/app/kitchen/layout.jsx    (Server Component)
import KitchenWSProvider from "../components/kitchenProvider";

export const metadata = { title: "Kitchen" };

export default function KitchenLayout({ children }) {
  return (
    <KitchenWSProvider>
      {children} {/* ✅ ส่ง children ตรง ๆ ไม่มี <html>/<body> ซ้ำ */}
    </KitchenWSProvider>
  );
}
