"use client";

import { useEffect, useMemo, useState } from "react";

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

const orderStatusOptions = [
  "all",
  "pending",
  "accepted",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
  "rejected",
];

const paymentStatusOptions = [
  "all",
  "unpaid",
  "pending_review",
  "paid",
  "rejected",
  "refunded",
  "voided",
];

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
    case "accepted":
      return {
        label: "Accepted",
        badge: "bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20",
        dot: "bg-sky-500",
      };
    case "preparing":
      return {
        label: "Preparing",
        badge: "bg-orange-500/10 text-orange-700 ring-1 ring-orange-500/20",
        dot: "bg-orange-500",
      };
    case "ready":
    case "done":
      return {
        label: "Ready",
        badge: "bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/20",
        dot: "bg-indigo-500",
      };
    case "served":
      return {
        label: "Served",
        badge: "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20",
        dot: "bg-emerald-500",
      };
    case "rejected":
      return {
        label: "Rejected",
        badge: "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20",
        dot: "bg-rose-500",
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

function liveMeta(liveStatus) {
  switch (liveStatus) {
    case "connected":
      return {
        label: "Live",
        className: "bg-emerald-500",
        textClassName: "text-emerald-700",
      };
    case "connecting":
      return {
        label: "Connecting",
        className: "bg-amber-500",
        textClassName: "text-amber-700",
      };
    default:
      return {
        label: "Offline",
        className: "bg-rose-500",
        textClassName: "text-rose-700",
      };
  }
}

export default function OrdersView({
  orders = [],
  liveStatus = "disconnected",
  lastLiveAt = null,
  actionError = "",
  onRefresh,
  onUpdateStatus,
  onSubmitPaymentProof,
  onReviewPayment,
}) {
  const [openId, setOpenId] = useState(orders?.[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("");
  const [notificationState, setNotificationState] = useState("idle");
  const [busyAction, setBusyAction] = useState("");
  const live = liveMeta(liveStatus);

  useEffect(() => {
    if (!openId && orders?.[0]?.id) {
      setOpenId(orders[0].id);
    }
  }, [openId, orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      const matchesPayment =
        paymentFilter === "all" || order.payment_status === paymentFilter;
      const matchesTable =
        !tableFilter ||
        String(order.table_number || "").includes(tableFilter.trim());
      return matchesStatus && matchesPayment && matchesTable;
    });
  }, [orders, paymentFilter, statusFilter, tableFilter]);

  const stats = useMemo(() => {
    const revenue = filteredOrders.reduce(
      (sum, o) => sum + Number.parseFloat(o.total || "0"),
      0
    );
    const tables = new Set(filteredOrders.map((o) => o.table_number));
    const items = filteredOrders.reduce((sum, o) => sum + calcItemsCount(o.items), 0);
    return {
      revenue,
      orderCount: filteredOrders.length,
      tableCount: tables.size,
      items,
    };
  }, [filteredOrders]);

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }
    if (window.Notification.permission === "granted") {
      setNotificationState("enabled");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationState(permission === "granted" ? "enabled" : "denied");
  };

  const runStatusUpdate = async (order, status) => {
    if (!onUpdateStatus) return;
    let reason = "";
    if (status === "cancelled" || status === "rejected") {
      reason = window.prompt("Reason is required") || "";
      if (!reason.trim()) return;
    }
    setBusyAction(`${order.id}:status`);
    await onUpdateStatus(order.id, status, reason);
    setBusyAction("");
  };

  const runSubmitProof = async (order) => {
    if (!onSubmitPaymentProof) return;
    const reference = window.prompt("Slip/reference number") || "";
    if (!reference.trim()) return;
    const note = window.prompt("Payment note (optional)") || "";
    setBusyAction(`${order.id}:proof`);
    await onSubmitPaymentProof(order.id, reference, note);
    setBusyAction("");
  };

  const runPaymentAction = async (order, action) => {
    if (!onReviewPayment) return;
    const needsReason = ["reject", "refund", "void"].includes(action);
    const note = window.prompt(needsReason ? "Reason" : "Review note (optional)") || "";
    if (needsReason && !note.trim()) return;
    setBusyAction(`${order.id}:${action}`);
    await onReviewPayment(order.id, action, note);
    setBusyAction("");
  };

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
            <button
              type="button"
              onClick={enableNotifications}
              className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-orange-100 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-orange-50"
            >
              Notifications: {notificationState === "idle" ? "Enable" : notificationState}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-orange-100 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-orange-50"
            >
              Refresh
            </button>
            <div className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-orange-100 px-3 py-2 text-xs shadow-sm">
              <span className={cx("inline-flex items-center gap-2 font-semibold", live.textClassName)}>
                <span
                  className={cx(
                    "h-1.5 w-1.5 rounded-full",
                    live.className,
                    liveStatus === "connected" && "animate-pulse",
                  )}
                />
                {live.label}
              </span>
            </div>
            <div className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-orange-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
              อัปเดตล่าสุด: {formatDateTime(lastLiveAt || new Date().toISOString())}
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
          <div className="mb-4 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-orange-100">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs font-semibold text-slate-600">
                Order status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {orderStatusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Payment status
                <select
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {paymentStatusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Table
                <input
                  value={tableFilter}
                  onChange={(event) => setTableFilter(event.target.value)}
                  placeholder="Table number"
                  className="mt-1 w-full rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setPaymentFilter("all");
                    setTableFilter("");
                  }}
                  className="h-10 w-full rounded-lg border border-orange-100 bg-white text-sm font-semibold text-slate-700 transition hover:bg-orange-50"
                >
                  Clear filters
                </button>
              </div>
            </div>
            {actionError ? (
              <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {actionError}
              </div>
            ) : null}
          </div>
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
              {filteredOrders.map((o) => {
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
                          <div>Payment: {o.payment_status || "unpaid"}</div>
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
                        <select
                          value={o.status || "pending"}
                          onChange={(event) => runStatusUpdate(o, event.target.value)}
                          disabled={busyAction === `${o.id}:status`}
                          className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
                        >
                          {orderStatusOptions
                            .filter((status) => status !== "all")
                            .map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
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
                            <Row k="Payment" v={o.payment_status || "unpaid"} />
                            <Row k="Reference" v={o.payment_reference || "-"} />
                            <Row k="Session ID" v={o.session_id || "-"} />
                            <Row k="Created at" v={formatDateTime(o.created_at)} />
                            <Row k="Opened at" v={formatDateTime(o.opened_at)} />
                            <Row k="Closed at" v={formatDateTime(o.closed_at)} />
                          </div>

                          <div className="mt-4 grid gap-2">
                            <button
                              type="button"
                              onClick={() => runSubmitProof(o)}
                              disabled={busyAction === `${o.id}:proof`}
                              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                            >
                              Submit slip/reference
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => runPaymentAction(o, "approve")}
                                disabled={busyAction === `${o.id}:approve`}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => runPaymentAction(o, "reject")}
                                disabled={busyAction === `${o.id}:reject`}
                                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => runPaymentAction(o, "refund")}
                                disabled={busyAction === `${o.id}:refund`}
                                className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 disabled:opacity-60"
                              >
                                Refund
                              </button>
                              <button
                                type="button"
                                onClick={() => runPaymentAction(o, "void")}
                                disabled={busyAction === `${o.id}:void`}
                                className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 disabled:opacity-60"
                              >
                                Void
                              </button>
                            </div>
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
