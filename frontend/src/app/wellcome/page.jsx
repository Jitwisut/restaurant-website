// app/page.tsx
import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      {/* Hero */}
      <section className="bg-cover bg-center h-[90vh] relative" style={{ backgroundImage: `url('/hero-dining.jpg')` }}>
        <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center text-center text-white">
          <h1 className="text-5xl font-bold mb-4">ยินดีต้อนรับสู่ร้านอาหารของเรา</h1>
          <p className="text-lg mb-6">ประสบการณ์การรับประทานอาหารที่ดีที่สุด เริ่มต้นที่นี่</p>
          <Link href="/reservation" className="bg-white text-black px-6 py-3 rounded font-semibold">
            จองโต๊ะตอนนี้
          </Link>
        </div>
      </section>

      {/* เมนูเด่น */}
      <section className="py-16 px-6 text-center">
        <h2 className="text-3xl font-semibold mb-10">เมนูแนะนำ</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded shadow p-4">
              <Image src={`/dish${i}.jpg`} alt={`dish ${i}`} width={300} height={200} className="mx-auto rounded" />
              <h3 className="mt-4 text-xl font-bold">ชื่อเมนู {i}</h3>
              <p className="text-gray-500">คำอธิบายสั้นของเมนู</p>
            </div>
          ))}
        </div>
      </section>

      {/* จุดเด่น */}
      <section className="bg-gray-100 py-16 px-6">
        <h2 className="text-3xl font-semibold mb-8 text-center">ทำไมถึงต้องเลือกร้านเรา?</h2>
        <ul className="max-w-3xl mx-auto space-y-4 text-lg">
          <li>✓ วัตถุดิบสดใหม่ทุกวัน</li>
          <li>✓ เชฟระดับมืออาชีพ</li>
          <li>✓ บรรยากาศโรแมนติกและอบอุ่น</li>
          <li>✓ รองรับการจองโต๊ะล่วงหน้า</li>
        </ul>
      </section>

      {/* แผนที่ + Footer */}
      <section className="py-16 px-6 text-center">
        <h2 className="text-2xl font-semibold mb-4">แวะมาหาเราวันนี้</h2>
        <p className="mb-4">123 ถนนสุขสันต์ เขตเมืองอร่อย กรุงเทพฯ</p>
        <iframe
          className="mx-auto border rounded"
          width="100%"
          height="300"
          loading="lazy"
          src="https://www.google.com/maps/embed?pb=!1m18!..."
        />
      </section>

      <footer className="text-center py-6 bg-black text-white">
        © 2025 ร้านอาหารของคุณ - โทร 02-XXX-XXXX
      </footer>
    </main>
  );
}