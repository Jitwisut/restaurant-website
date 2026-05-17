"use client";

import { DoorClosed, Home, MessageCircle } from "lucide-react";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  });
}

function TableClosedContent() {
  const searchParams = useSearchParams();
  const session = searchParams.get("session");
  const [bill, setBill] = useState(null);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    axios
      .get(`${API_BASE}/sessions/${encodeURIComponent(session)}/bill`)
      .then((response) => {
        if (!cancelled) setBill(response.data.bill || null);
      })
      .catch(() => {
        if (!cancelled) setBill(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#fff7f7] p-6 text-slate-900">
      <section
        className="w-full max-w-[520px] overflow-hidden border border-rose-100 bg-white p-8 text-center shadow-xl"
        style={{ borderRadius: 8 }}
      >
        <div
          className="mx-auto mb-6 flex items-center justify-center bg-rose-600 text-white"
          style={{ width: 72, height: 72, borderRadius: 8 }}
        >
          <DoorClosed aria-hidden="true" className="h-9 w-9" />
        </div>

        <h1 className="mb-4 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
          โต๊ะถูกปิดแล้ว
        </h1>

        <p className="mx-auto max-w-[360px] text-base leading-7 text-slate-600">
          ขอบคุณที่ใช้บริการ สามารถตรวจรายการอาหารและสแกน QR เพื่อชำระยอดตามบิลนี้ได้
        </p>

        {bill ? (
          <div className="my-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">
                สรุปยอดโต๊ะ {bill.session?.table_number || "-"}
              </span>
              <span className="text-sm font-bold text-slate-950">
                {formatCurrency(bill.totals?.grand_total)}
              </span>
            </div>

            <div className="max-h-44 overflow-y-auto divide-y divide-slate-200">
              {(bill.items || []).map((item, index) => (
                <div
                  key={`${item.order_id}-${index}`}
                  className="flex items-start justify-between gap-3 py-2 text-sm"
                >
                  <span className="text-slate-700">
                    {item.quantity || 0}x {item.menu_item_name || "Menu item"}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {bill.payment?.promptpay?.qr_data_url ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Payment QR
                </p>
                <div className="relative mx-auto mt-3 h-52 w-52 overflow-hidden rounded-lg bg-white">
                  <Image
                    src={bill.payment.promptpay.qr_data_url}
                    alt="Payment QR code"
                    fill
                    sizes="208px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  ชำระ {formatCurrency(bill.payment.amount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {bill.payment.promptpay.account_name || "PromptPay"}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                ยังไม่ได้ตั้งค่า QR รับชำระเงิน กรุณาติดต่อพนักงาน
              </div>
            )}
          </div>
        ) : (
          <p className="mx-auto my-6 max-w-[360px] text-sm leading-6 text-slate-500">
            หากต้องการบิลหรือชำระเงิน กรุณาติดต่อพนักงานประจำร้าน
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            style={{ borderRadius: 8 }}
          >
            <Home aria-hidden="true" className="h-4 w-4" />
            กลับหน้าหลัก
          </Link>
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            style={{ borderRadius: 8 }}
            onClick={() => window.history.back()}
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            กลับไปก่อนหน้า
          </button>
        </div>
      </section>
    </main>
  );
}

export default function TableClosedPage() {
  return (
    <Suspense fallback={null}>
      <TableClosedContent />
    </Suspense>
  );
}
