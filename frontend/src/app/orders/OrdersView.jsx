"use client";

import { useMemo, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatTHB(value) {
  const number = typeof value === "string" ? Number.parseFloat(value) : value;
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(d);
}

function calcItemsCount(items = []) {
  return items.reduce((sum, it) => sum + (it?.quantity ?? 0), 0);
}

function statusMeta(status) {
  switch (status) {
    case "completed":
      return {
        label: "สำเร็จ",
        badge:
          "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20",
        dot: "bg-emerald-500",
      };
    case "pending":
      return {
        label: "รอดำเนินการ",
        badge: "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/20",
        dot: "bg-amber-500",
      };
    case "cancelled":
      return {
        label: "ยกเลิก",
        badge: "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20",
        dot: "bg-rose-500",
      };
    default:
      return {
        label: status || "-",
        badge: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20",
        dot: "bg-slate-500",
      };
  }
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-orange-100 shadow-sm">
      <div className="p-4">
        <div className="text-sm text-slate-600">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">
          {value}
        </div>
        {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-xs text-slate-500">{k}</div>
      <div className="text-xs font-medium text-slate-800 text-right">{v}</div>
    </div>
  );
}

export default function OrdersView({ orders = [] }) {
  const [openId, setOpenId] = useState(orders?.[0]?.id ?? null);

  const stats = useMemo(() => {
    const revenue = orders.reduce(
      (sum, o) => sum + Number.parseFloat(o.total || "0"),
      0
    );
    const tables = new Set(orders.map((o) => o.table_number));
    const items = orders.reduce((sum, o) => sum + calcItemsCount(o.items), 0);
    return {
      revenue,
      orderCount: orders.length,
      tableCount: tables.size,
      items,
    };
  }, [orders]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-50 via-amber-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              รายการออเดอร์
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              Orders Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              ดูภาพรวมและรายละเอียดออเดอร์แบบอ่านง่าย โทนส้มพร้อมใช้งาน production
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-orange-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
              อัปเดตล่าสุด: {formatDateTime(new Date().toISOString())}
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="ยอดขายรวม"
            value={formatTHB(stats.revenue)}
            sub={`รวม ${stats.orderCount} ออเดอร์`}
          />
          <StatCard label="จำนวนออเดอร์" value={stats.orderCount} sub="ทั้งหมด" />
          <StatCard label="จำนวนโต๊ะ" value={stats.tableCount} sub="ที่มีการสั่ง" />
          <StatCard
            label="จำนวนรายการอาหาร"
            value={stats.items}
            sub="รวมจำนวนชิ้น"
          />
        </section>

        <section className="mt-6">
          <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-orange-100 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-orange-100 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">
                รายการทั้งหมด
              </div>
              <div className="text-xs text-slate-500">
                คลิก “ดูรายละเอียด” เพื่อขยายรายการ
              </div>
            </div>

            <div className="divide-y divide-orange-100">
              {orders.map((o) => {
                const meta = statusMeta(o.status);
                const isOpen = openId === o.id;
                const itemCount = calcItemsCount(o.items);
                const computedTotal = o.items?.reduce(
                  (sum, it) => sum + (it.price ?? 0) * (it.quantity ?? 0),
                  0
                );

                return (
                  <article key={o.id} className="px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {o.id}
                          </div>
                          <span
                            className={cx(
                              "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium",
                              meta.badge
                            )}
                          >
                            <span
                              className={cx("h-1.5 w-1.5 rounded-full", meta.dot)}
                            />
                            {meta.label}
                          </span>
                          <span className="text-xs text-slate-500">
                            โต๊ะ {o.table_number}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                          <div>สร้าง: {formatDateTime(o.created_at)}</div>
                          <div>เปิดโต๊ะ: {formatDateTime(o.opened_at)}</div>
                          <div>ปิดโต๊ะ: {formatDateTime(o.closed_at)}</div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="rounded-xl bg-orange-50 ring-1 ring-orange-100 px-3 py-2">
                          <div className="text-[11px] text-orange-800">
                            รวม {itemCount} รายการ
                          </div>
                          <div className="text-base font-semibold text-slate-900">
                            {formatTHB(o.total)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            คำนวณจากรายการ: {formatTHB(computedTotal)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setOpenId((prev) => (prev === o.id ? null : o.id))}
                          className={cx(
                            "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium shadow-sm ring-1 transition",
                            isOpen
                              ? "bg-orange-600 text-white ring-orange-600 hover:bg-orange-700"
                              : "bg-white text-slate-900 ring-orange-200 hover:bg-orange-50"
                          )}
                        >
                          {isOpen ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                        </button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl bg-white ring-1 ring-orange-100 p-4 lg:col-span-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">
                              รายการอาหาร
                            </div>
                            <div className="text-xs text-slate-500">
                              รวม {itemCount} ชิ้น
                            </div>
                          </div>

                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-slate-500">
                                  <th className="py-2 pr-3 font-medium">
                                    เมนู
                                  </th>
                                  <th className="py-2 pr-3 font-medium w-24">
                                    จำนวน
                                  </th>
                                  <th className="py-2 pr-3 font-medium w-28">
                                    ราคา
                                  </th>
                                  <th className="py-2 font-medium w-32 text-right">
                                    รวมย่อย
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-orange-100">
                                {o.items?.map((it, idx) => {
                                  const line = (it.price ?? 0) * (it.quantity ?? 0);
                                  return (
                                    <tr key={`${o.id}-${idx}`} className="align-top">
                                      <td className="py-3 pr-3">
                                        <div className="font-medium text-slate-900">
                                          {it.menu_item_name}
                                        </div>
                                      </td>
                                      <td className="py-3 pr-3 text-slate-700">
                                        {it.quantity}
                                      </td>
                                      <td className="py-3 pr-3 text-slate-700">
                                        {formatTHB(it.price)}
                                      </td>
                                      <td className="py-3 text-right font-semibold text-slate-900">
                                        {formatTHB(line)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-4 flex items-center justify-end gap-3">
                            <div className="text-xs text-slate-500">
                              ยอดรวมออเดอร์
                            </div>
                            <div className="text-lg font-semibold text-orange-700">
                              {formatTHB(o.total)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white ring-1 ring-orange-100 p-4">
                          <div className="text-sm font-semibold text-slate-900">
                            ข้อมูลออเดอร์
                          </div>

                          <div className="mt-3">
                            <Row k="โต๊ะ" v={`โต๊ะ ${o.table_number}`} />
                            <Row k="สถานะ" v={meta.label} />
                            <Row k="Session ID" v={o.session_id || "-"} />
                            <Row k="Created at" v={formatDateTime(o.created_at)} />
                            <Row k="Opened at" v={formatDateTime(o.opened_at)} />
                            <Row k="Closed at" v={formatDateTime(o.closed_at)} />
                          </div>

                          <div className="mt-4 rounded-xl bg-orange-50 ring-1 ring-orange-100 p-3">
                            <div className="text-xs text-slate-600">
                              หมายเหตุ
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                              ถ้าอยากต่อยอด production แนะนำเพิ่ม filter ตามวัน/โต๊ะ,
                              export ใบเสร็จ และเชื่อม API จริงแทน mock data
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
