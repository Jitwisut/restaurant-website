"use client";

import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createApiClient } from "@/lib/api";
import { buildRestaurantPath } from "@/lib/auth";
import { useAuth } from "../components/AuthProvider";
import { useRestaurantAccess } from "../components/useRestaurantAccess";

const qrStorageKey = (slug) => `restaurantos.tables.last-open:${slug}`;

const floorZones = ["Main Dining", "Patio", "Bar Lounge", "Private Room"];
const zoneTabs = ["All Areas", ...floorZones];

const canvasLayouts = [
  { top: 100, left: 100, width: 88, height: 88, shape: "round", seats: 4 },
  { top: 120, left: 300, width: 108, height: 108, shape: "square", seats: 4 },
  { top: 100, left: 550, width: 140, height: 76, shape: "wide", seats: 6 },
  { top: 350, left: 150, width: 196, height: 76, shape: "banquet", seats: 8 },
  { top: 280, left: 560, width: 96, height: 96, shape: "round", seats: 4 },
  { top: 500, left: 420, width: 128, height: 76, shape: "wide", seats: 6 },
];

function getStatusMeta(status) {
  if (status === "open") {
    return {
      label: "Occupied",
      chip: "bg-status-occupied/10 text-status-occupied",
      border: "border-status-occupied",
      dot: "bg-status-occupied",
      panel: "bg-status-occupied/10 text-status-occupied",
    };
  }

  if (status === "reserved") {
    return {
      label: "Reserved",
      chip: "bg-status-reserved/10 text-status-reserved",
      border: "border-status-reserved",
      dot: "bg-status-reserved",
      panel: "bg-status-reserved/10 text-status-reserved",
    };
  }

  return {
    label: "Available",
    chip: "bg-status-available/10 text-status-available",
    border: "border-status-available",
    dot: "bg-status-available",
    panel: "bg-status-available/10 text-status-available",
  };
}

function getCanvasLayout(index) {
  return canvasLayouts[index % canvasLayouts.length];
}

function getTableNumberValue(tableOrNumber) {
  const raw =
    typeof tableOrNumber === "object" && tableOrNumber !== null
      ? tableOrNumber.table_number
      : tableOrNumber;
  const value = Number.parseInt(String(raw ?? 0), 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getCanvasLayoutForTable(table) {
  return getCanvasLayout(getTableNumberValue(table) - 1);
}

function getZoneForTable(table) {
  return floorZones[(getTableNumberValue(table) - 1) % floorZones.length];
}

function getTableDisplayNumber(tableNumber) {
  return String(tableNumber).padStart(2, "0");
}

function formatRestaurantTitle(slug) {
  if (!slug) return "Restaurant";
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatElapsedTime(value) {
  if (!value) return "-";

  const openedAt = new Date(value);
  if (Number.isNaN(openedAt.getTime())) return "-";

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - openedAt.getTime()) / 60000),
  );

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatCurrency(amount) {
  const value = Number(amount || 0);
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function formatBillDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildBillPrintHtml(bill) {
  const items = Array.isArray(bill?.items) ? bill.items : [];
  const payment = bill?.payment || {};
  const promptpay = payment.promptpay || {};
  const bank = payment.bank_transfer || {};
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.menu_item_name || "Menu item")}</td>
          <td class="num">${Number(item.quantity || 0)}</td>
          <td class="num">${formatCurrency(item.price)}</td>
          <td class="num">${formatCurrency(item.subtotal)}</td>
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Bill ${escapeHtml(bill?.session?.session_id || "")}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
          .receipt { max-width: 420px; margin: 0 auto; }
          h1 { font-size: 22px; margin: 0 0 4px; }
          .muted { color: #64748b; font-size: 12px; line-height: 1.5; }
          .meta { border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin: 16px 0; padding: 12px 0; display: grid; gap: 6px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px 0; }
          td { border-bottom: 1px solid #f1f5f9; padding: 8px 0; vertical-align: top; }
          .num { text-align: right; }
          .totals { margin-top: 14px; display: grid; gap: 8px; font-size: 13px; }
          .line { display: flex; justify-content: space-between; gap: 16px; }
          .grand { border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 18px; font-weight: 700; }
          .qr { margin: 18px auto 8px; width: 210px; text-align: center; }
          .qr img { width: 210px; height: 210px; object-fit: contain; }
          @media print { body { padding: 0; } .receipt { max-width: none; } }
        </style>
      </head>
      <body>
        <main class="receipt">
          <h1>Bill Summary</h1>
          <div class="muted">Table ${escapeHtml(getTableDisplayNumber(bill?.session?.table_number))}</div>
          <div class="muted">Session ${escapeHtml(bill?.session?.session_id || "-")}</div>
          <section class="meta">
            <div>Opened: ${escapeHtml(formatBillDate(bill?.session?.opened_at))}</div>
            <div>Closed: ${escapeHtml(formatBillDate(bill?.session?.closed_at))}</div>
            <div>Payment: ${escapeHtml(bill?.payment_status || "unpaid")}</div>
          </section>
          <table>
            <thead>
              <tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Subtotal</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4">No order items.</td></tr>'}</tbody>
          </table>
          <section class="totals">
            <div class="line"><span>Subtotal</span><strong>${formatCurrency(bill?.totals?.subtotal)}</strong></div>
            <div class="line"><span>Service charge</span><strong>${formatCurrency(bill?.totals?.service_charge_amount)}</strong></div>
            <div class="line"><span>Tax/VAT</span><strong>${formatCurrency(bill?.totals?.tax_amount)}</strong></div>
            <div class="line"><span>Discount</span><strong>${formatCurrency(bill?.totals?.discount_amount)}</strong></div>
            <div class="line grand"><span>Total</span><strong>${formatCurrency(bill?.totals?.grand_total)}</strong></div>
          </section>
          ${
            promptpay.qr_data_url
              ? `<section class="qr"><img src="${promptpay.qr_data_url}" alt="Payment QR" /><div class="muted">Scan to pay ${formatCurrency(payment.amount)} THB</div><div class="muted">${escapeHtml(promptpay.account_name || "")}</div></section>`
              : `<section class="meta"><div>Payment QR is not configured.</div><div>${escapeHtml(bank.bank_name || "")} ${escapeHtml(bank.account_number || "")}</div><div>${escapeHtml(bank.account_name || "")}</div></section>`
          }
        </main>
      </body>
    </html>`;
}

export default function TablesPage() {
  const { signOut } = useAuth();
  const { auth, ready, allowed } = useRestaurantAccess([
    "owner",
    "admin",
    "staff",
    "superadmin",
  ]);
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);

  const slugKey = auth?.restaurantSlug || "global";
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTable, setBusyTable] = useState(null);
  const [qrModal, setQrModal] = useState(null);
  const [selectedZone, setSelectedZone] = useState(zoneTabs[0]);
  const [selectedTableNumber, setSelectedTableNumber] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [billModal, setBillModal] = useState(null);

  const loadTables = useCallback(async () => {
    if (!auth?.token) return;

    try {
      setLoading(true);
      setError("");
      const response = await api.get("/tables/gettable");
      const nextTables = (response.data.tables || []).sort(
        (a, b) => a.table_number - b.table_number,
      );
      setTables(nextTables);
      setSelectedTableNumber((current) => {
        if (
          current &&
          nextTables.some((table) => table.table_number === current)
        ) {
          return current;
        }
        return nextTables[0]?.table_number || null;
      });
    } catch (requestError) {
      setError(
        requestError.normalizedMessage || "Unable to load table information.",
      );
    } finally {
      setLoading(false);
    }
  }, [api, auth?.token]);

  useEffect(() => {
    if (ready && allowed) {
      loadTables();
    }
  }, [allowed, loadTables, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Clear legacy cached QR modal state so the page never auto-opens
    // an old table session when the user revisits the screen.
    window.localStorage.removeItem(qrStorageKey(slugKey));
  }, [slugKey]);

  const updateQrCache = (value) => {
    if (typeof window === "undefined") return;
    if (!value) {
      window.localStorage.removeItem(qrStorageKey(slugKey));
    }
  };

  const openTable = async (tableNumber) => {
    setBusyTable(tableNumber);
    try {
      const response = await api.post("/tables/opentable", { number: tableNumber });
      const modal = {
        tableNumber,
        qrCodeUrl: response.data.qr_code_url,
        fullUrl: response.data.fullurl,
        sessionHash: response.data.session_hash,
      };
      setQrModal(modal);
      updateQrCache(modal);
      setSelectedTableNumber(tableNumber);
      await loadTables();
    } catch (requestError) {
      setError(requestError.normalizedMessage || "Could not open this table.");
    } finally {
      setBusyTable(null);
    }
  };

  const closeTable = async (tableNumber) => {
    setBusyTable(tableNumber);
    try {
      const response = await api.post("/tables/closetable", { number: tableNumber });
      if (qrModal?.tableNumber === tableNumber) {
        setQrModal(null);
        updateQrCache(null);
      }
      if (response.data.bill) {
        setBillModal(response.data.bill);
      }
      await loadTables();
    } catch (requestError) {
      setError(requestError.normalizedMessage || "Could not close this table.");
    } finally {
      setBusyTable(null);
    }
  };

  const printBill = (bill) => {
    if (typeof window === "undefined" || !bill) return;
    const popup = window.open("", "_blank", "width=460,height=720");
    if (!popup) {
      window.print();
      return;
    }
    popup.document.open();
    popup.document.write(buildBillPrintHtml(bill));
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  };

  const addTable = async () => {
    setBusyTable("add");
    try {
      await api.post("/tables/addtable", {});
      await loadTables();
    } catch (requestError) {
      setError(requestError.normalizedMessage || "Could not add a new table.");
    } finally {
      setBusyTable(null);
    }
  };

  const copyQrLink = async () => {
    const linkToCopy = qrModal?.fullUrl || selectedQr?.fullUrl;
    if (!linkToCopy) return;
    await navigator.clipboard.writeText(linkToCopy);
    await Swal.fire({
      icon: "success",
      title: "Link copied",
      text: linkToCopy,
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const filteredTables = useMemo(
    () =>
      selectedZone === "All Areas"
        ? tables
        : tables.filter((table) => getZoneForTable(table) === selectedZone),
    [selectedZone, tables],
  );

  useEffect(() => {
    setSelectedTableNumber((current) => {
      if (
        current &&
        filteredTables.some((table) => table.table_number === current)
      ) {
        return current;
      }
      return filteredTables[0]?.table_number || null;
    });
  }, [filteredTables]);

  const selectedTable = useMemo(
    () =>
      filteredTables.find((table) => table.table_number === selectedTableNumber) ||
      filteredTables[0] ||
      null,
    [filteredTables, selectedTableNumber],
  );
  const hasTables = tables.length > 0;
  const hasTablesInSelectedZone = filteredTables.length > 0;
  const restaurantTitle = formatRestaurantTitle(auth?.restaurantSlug);
  const selectedLayout = selectedTable ? getCanvasLayoutForTable(selectedTable) : null;
  const selectedSeatCount = selectedLayout?.seats || 0;
  const selectedZoneName = selectedTable ? getZoneForTable(selectedTable) : selectedZone;

  const selectedStatus = getStatusMeta(selectedTable?.status);
  const selectedQr = useMemo(() => {
    if (!selectedTable) return null;

    if (qrModal?.tableNumber === selectedTable.table_number) {
      return qrModal;
    }

    if (
      selectedTable.qr_code_url &&
      selectedTable.customer_session &&
      typeof window !== "undefined"
    ) {
      return {
        tableNumber: selectedTable.table_number,
        qrCodeUrl: selectedTable.qr_code_url,
        fullUrl: `${window.location.origin}/order/${selectedTable.customer_session}`,
        sessionHash: selectedTable.customer_session,
      };
    }

    return null;
  }, [qrModal, selectedTable]);

  useEffect(() => {
    const loadOrders = async () => {
      if (
        !selectedTable ||
        selectedTable.status !== "open" ||
        !selectedTable.customer_session ||
        !auth?.token
      ) {
        setTableOrders([]);
        setOrdersLoading(false);
        return;
      }

      try {
        setOrdersLoading(true);
        const response = await api.post("/order/orderhistory", {
          table_number: getTableNumberValue(selectedTable),
        });
        const sessionOrders = (response.data.order || []).filter(
          (order) =>
            String(order.session_id || "") ===
            String(selectedTable.customer_session || ""),
        );
        setTableOrders(sessionOrders);
      } catch (requestError) {
        setTableOrders([]);
        setError(requestError.normalizedMessage || "Unable to load table orders.");
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [api, auth?.token, selectedTable]);

  const latestOrder = tableOrders[0] || null;
  const latestOrderItems = Array.isArray(latestOrder?.items) ? latestOrder.items : [];
  const showActiveOrder =
    selectedTable?.status === "open" &&
    Boolean(selectedTable?.customer_session) &&
    (ordersLoading || latestOrderItems.length > 0);
  const openTableCount = tables.filter((table) => table.status === "open").length;
  const availableTableCount = tables.filter((table) => table.status !== "open").length;

  const showShiftReport = async () => {
    await Swal.fire({
      title: "Shift Report",
      html: `
        <div style="text-align:left;display:grid;gap:8px;">
          <div>Total tables: <strong>${tables.length}</strong></div>
          <div>Open tables: <strong>${openTableCount}</strong></div>
          <div>Available tables: <strong>${availableTableCount}</strong></div>
          <div>Current zone: <strong>${selectedZone}</strong></div>
        </div>
      `,
      icon: "info",
      confirmButtonText: "Close",
    });
  };

  const showHelp = async () => {
    await Swal.fire({
      title: "How to use Floor Plan",
      html: `
        <div style="text-align:left;display:grid;gap:8px;">
          <div>1. Add a table when the restaurant needs one.</div>
          <div>2. Select a table card from the floor map.</div>
          <div>3. Open the table to generate a QR session.</div>
          <div>4. Copy the QR link or open the QR modal for guests.</div>
          <div>5. Close the table when service is finished.</div>
        </div>
      `,
      icon: "question",
      confirmButtonText: "Close",
    });
  };

  const showStatusSummary = async () => {
    await Swal.fire({
      title: "Floor Summary",
      html: `
        <div style="text-align:left;display:grid;gap:8px;">
          <div>Restaurant: <strong>${restaurantTitle}</strong></div>
          <div>Visible zone: <strong>${selectedZone}</strong></div>
          <div>Visible tables: <strong>${filteredTables.length}</strong></div>
          <div>Open tables: <strong>${openTableCount}</strong></div>
        </div>
      `,
      icon: "info",
      confirmButtonText: "Close",
    });
  };

  const showInventoryNotice = async () => {
    await Swal.fire({
      title: "Inventory",
      text: "Inventory tools are not wired into this screen yet. Use Admin for staff management and Orders for live service tracking.",
      icon: "info",
      confirmButtonText: "Close",
    });
  };

  const resetFloorView = async () => {
    setSelectedZone("All Areas");
    setQrModal(null);
    updateQrCache(null);
    setError("");
    await Swal.fire({
      icon: "success",
      title: "View reset",
      text: "Zone filter and cached QR session have been cleared.",
      timer: 1500,
      showConfirmButton: false,
    });
  };

  if (!ready || (auth?.token && !allowed)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm">
          Loading floor plan...
        </div>
      </main>
    );
  }

  return (
    <main className="overflow-hidden bg-background font-body-md text-body-md text-on-background">
      <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-64 flex-col border-r border-slate-700/50 bg-primary-container text-white shadow-xl">
        <div className="border-b border-white/10 p-gutter">
          <h1 className="font-h2 text-h2 font-black text-white">
            {restaurantTitle}
          </h1>
          <p className="font-body-sm text-body-sm text-on-primary-container">
            Floor Manager
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-md">
          <ul className="space-y-xs px-base">
            <li>
              <Link
                href={buildRestaurantPath(auth, "admin")}
                className="flex cursor-pointer items-center gap-3 rounded-DEFAULT px-4 py-3 text-slate-300 transition-colors duration-200 hover:bg-white/5"
              >
                <span className="material-symbols-outlined">dashboard</span>
                <span className="font-label-md text-label-md">Dashboard</span>
              </Link>
            </li>
            <li>
              <Link
                href={buildRestaurantPath(auth, "tables")}
                className="flex cursor-pointer items-center gap-3 rounded-r-DEFAULT border-l-4 border-emerald-400 bg-white/10 px-4 py-3 text-white duration-200"
              >
                <span className="material-symbols-outlined">layers</span>
                <span className="font-label-md text-label-md">Floor Plan</span>
              </Link>
            </li>
            <li>
              <Link
                href={buildRestaurantPath(auth, "orders")}
                className="flex cursor-pointer items-center gap-3 rounded-DEFAULT px-4 py-3 text-slate-300 transition-colors duration-200 hover:bg-white/5"
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span className="font-label-md text-label-md">Orders</span>
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={showInventoryNotice}
                className="flex w-full cursor-pointer items-center gap-3 rounded-DEFAULT px-4 py-3 text-left text-slate-300 transition-colors duration-200 hover:bg-white/5"
              >
                <span className="material-symbols-outlined">inventory_2</span>
                <span className="font-label-md text-label-md">Inventory</span>
              </button>
            </li>
            <li>
              <Link
                href={buildRestaurantPath(auth, "admin")}
                className="flex w-full cursor-pointer items-center gap-3 rounded-DEFAULT px-4 py-3 text-left text-slate-300 transition-colors duration-200 hover:bg-white/5"
              >
                <span className="material-symbols-outlined">groups</span>
                <span className="font-label-md text-label-md">Staff</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="border-t border-white/10 p-gutter">
          <button
            type="button"
            onClick={showShiftReport}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-container/20 py-sm font-label-md text-label-md text-white transition-colors hover:bg-surface-container/30"
          >
            Shift Report
          </button>
          <ul className="mt-gutter space-y-xs">
            <li>
              <button
                type="button"
                onClick={showHelp}
                className="flex cursor-pointer items-center gap-3 py-2 text-sm text-slate-400 transition-colors hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">help</span>
                Help Center
              </button>
            </li>
            <li>
              <Link
                href="/signin"
                onClick={signOut}
                className="flex cursor-pointer items-center gap-3 py-2 text-sm text-slate-400 transition-colors hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Logout
              </Link>
            </li>
          </ul>
        </div>
      </aside>

      <header className="fixed left-64 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-surface-container bg-surface-container-lowest px-8 font-label-sm text-sm font-medium text-primary-container shadow-sm">
        <div className="flex h-full items-center gap-8">
          <span className="text-xl font-bold tracking-tight text-primary-container">
            FloorManager
          </span>
          <nav className="flex h-full gap-6">
            {zoneTabs.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setSelectedZone(zone)}
                className={`flex h-full items-center px-1 pt-2 transition-all ${
                  selectedZone === zone
                    ? "border-b-2 border-primary-container text-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary-container"
                }`}
              >
                {zone}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={addTable}
            disabled={busyTable === "add"}
            className="flex items-center gap-2 rounded-DEFAULT bg-primary-container px-4 py-2 font-label-md text-label-md text-white transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {busyTable === "add"
              ? "Adding..."
              : hasTables
                ? "Add Table"
                : "Create First Table"}
          </button>
          <div className="flex items-center gap-2 border-l border-surface-variant pl-4">
            <button
              type="button"
              onClick={showStatusSummary}
              className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button
              type="button"
              onClick={resetFloorView}
              className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </div>
      </header>

      <div className="fixed bottom-0 left-64 right-0 top-16 flex bg-surface-container-low">
        <div className="relative flex-1 overflow-auto p-margin">
          <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0ibm9uZSIvPgo8cGF0aCBkPSJNMCA0MGw0MCAwTTAgMGwwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9IiNlNGUyZTUiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3N2Zz4=')] opacity-50" />

          {error ? (
            <div className="relative z-20 mb-4 rounded-xl border border-error bg-error-container px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="relative z-10 flex min-h-[600px] min-w-[800px] items-center justify-center">
              <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm">
                Loading table map...
              </div>
            </div>
          ) : !hasTables ? (
            <div className="relative z-10 flex min-h-[600px] min-w-[800px] items-center justify-center">
              <section className="w-full max-w-3xl rounded-[32px] border border-slate-200/80 bg-white/90 p-10 shadow-xl shadow-slate-200/40 backdrop-blur">
                <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
                      Floor Plan Setup
                    </p>
                    <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
                      Start with your first table
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                      New restaurants now start with an empty floor plan. Add
                      only the tables you actually need, then open each table to
                      generate its QR session when service begins.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={addTable}
                        disabled={busyTable === "add"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-base">
                          add_circle
                        </span>
                        {busyTable === "add"
                          ? "Creating your first table..."
                          : "Create first table"}
                      </button>
                      <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                        Tables created: 0
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map((item) => (
                        <div
                          key={item}
                          className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-slate-300"
                        >
                          <span className="text-sm font-semibold">
                            Table {item}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-500">
                      This canvas stays empty until your team adds tables.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          ) : !hasTablesInSelectedZone ? (
            <div className="relative z-10 flex min-h-[600px] min-w-[800px] items-center justify-center">
              <section className="w-full max-w-2xl rounded-[32px] border border-slate-200/80 bg-white/90 p-10 text-center shadow-xl shadow-slate-200/40 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
                  {selectedZone}
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                  No tables in this zone
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Switch back to all areas or add a new table and it will be
                  assigned to this floor rotation automatically.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedZone("All Areas")}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Show all areas
                  </button>
                  <button
                    type="button"
                    onClick={addTable}
                    disabled={busyTable === "add"}
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {busyTable === "add" ? "Adding..." : "Add table"}
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="relative z-10 min-h-[600px] min-w-[800px]">
              {filteredTables.map((table) => {
                const layout = getCanvasLayoutForTable(table);
                const status = getStatusMeta(table.status);
                const isSelected = table.table_number === selectedTable?.table_number;
                const isBusy = busyTable === table.table_number;

                return (
                  <button
                    key={table.table_number}
                    type="button"
                    onClick={() => setSelectedTableNumber(table.table_number)}
                    className="group absolute flex flex-col items-center justify-center"
                    style={{ top: layout.top, left: layout.left }}
                  >
                    <div
                      className={`relative flex items-center justify-center bg-surface-container-lowest shadow-sm transition-all group-hover:shadow-md ${
                        layout.shape === "round"
                          ? "rounded-full border-2"
                          : "rounded-lg border-2"
                      } ${status.border} ${
                        isSelected ? "ring-4 ring-primary-container/20 border-primary-container" : ""
                      }`}
                      style={{ width: layout.width, height: layout.height }}
                    >
                      <span className="font-h3 text-h3 text-on-surface">
                        {getTableDisplayNumber(table.table_number)}
                      </span>
                      {table.status === "open" ? (
                        <div className={`absolute -right-2 -top-2 h-4 w-4 rounded-full ${status.dot}`} />
                      ) : null}
                      {layout.shape === "square" ? (
                        <>
                          <div className="absolute -top-3 h-2 w-8 rounded-t-sm bg-surface-variant" />
                          <div className="absolute -bottom-3 h-2 w-8 rounded-b-sm bg-surface-variant" />
                          <div className="absolute -left-3 h-8 w-2 rounded-l-sm bg-surface-variant" />
                          <div className="absolute -right-3 h-8 w-2 rounded-r-sm bg-surface-variant" />
                        </>
                      ) : null}
                    </div>
                    <div className={`mt-2 rounded-full px-2 py-1 font-label-sm text-label-sm ${status.panel}`}>
                      {`${layout.seats} Seats`}
                    </div>
                    <span className="mt-2 text-xs text-slate-400">
                      {isBusy
                        ? table.status === "open"
                          ? "Closing..."
                          : "Opening..."
                        : status.label}
                    </span>
                  </button>
                );
              })}

              <div className="absolute left-[450px] top-[300px] h-64 w-2 rounded-full bg-outline-variant" />
            </div>
          )}
        </div>

        <aside className="z-20 flex w-80 flex-col border-l border-surface-container bg-surface-container-lowest shadow-sm">
          <div className="border-b border-surface-variant bg-surface p-gutter">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h2 className="font-h2 text-h2 text-on-surface">
                  {hasTablesInSelectedZone
                    ? `Table ${
                        selectedTable
                          ? getTableDisplayNumber(selectedTable.table_number)
                          : "--"
                      }`
                    : "Floor Setup"}
                </h2>
                <span className={`mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  hasTablesInSelectedZone
                    ? selectedStatus.panel
                    : "bg-slate-100 text-slate-700"
                }`}>
                  {hasTablesInSelectedZone ? selectedStatus.label : "No tables in this zone"}
                </span>
                {hasTablesInSelectedZone && (
                  <p className="mt-2 text-xs text-slate-500">{selectedZoneName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTableNumber(null)}
                className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-md overflow-y-auto p-gutter">
            {!hasTables ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Setup Guide
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  No tables yet
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Create the first table for this restaurant, then select it on
                  the floor map to open service and generate a QR link.
                </p>
                <div className="mt-5 space-y-3">
                  {[
                    "Add your first table from the top-right action button.",
                    "Open the table only when guests are seated.",
                    "Copy or display the QR code for dine-in ordering.",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                    >
                      <span className="material-symbols-outlined mt-0.5 text-base text-primary-container">
                        check_circle
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addTable}
                  disabled={busyTable === "add"}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-container py-3 text-sm font-semibold text-white transition hover:bg-primary disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  {busyTable === "add" ? "Creating..." : "Create first table"}
                </button>
              </div>
            ) : !hasTablesInSelectedZone ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {selectedZone}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  No tables in this zone
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Switch to all areas or create another table to continue working
                  from this view.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedZone("All Areas")}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-base">grid_view</span>
                    Show all areas
                  </button>
                  <button
                    type="button"
                    onClick={addTable}
                    disabled={busyTable === "add"}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-container py-3 text-sm font-semibold text-white transition hover:bg-primary disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    {busyTable === "add" ? "Creating..." : "Add table"}
                  </button>
                </div>
              </div>
            ) : selectedTable ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-surface-container-low p-sm">
                    <p className="mb-1 font-label-sm text-label-sm text-on-surface-variant">
                      Capacity
                    </p>
                    <p className="flex items-center gap-2 font-body-lg text-body-lg font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-sm">event_seat</span>
                      {selectedSeatCount} Seats
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-sm">
                    <p className="mb-1 font-label-sm text-label-sm text-on-surface-variant">
                      Time Seated
                    </p>
                    <p className="flex items-center gap-2 font-body-lg text-body-lg font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {formatElapsedTime(selectedTable.opened_at)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-surface-container-low p-sm">
                    <p className="mb-1 font-label-sm text-label-sm text-on-surface-variant">
                      Session
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container font-label-md text-label-md text-white">
                        {selectedTable.status === "open" ? "ON" : "OFF"}
                      </div>
                      <p className="font-body-md text-body-md font-medium text-on-surface">
                        {selectedTable.customer_session
                          ? selectedTable.customer_session.slice(0, 8)
                          : "No active session"}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedQr ? (
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-surface-variant bg-surface-container-lowest p-md shadow-sm">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQrModal(selectedQr)}
                        className="group flex h-24 w-24 items-center justify-center rounded-lg border-2 border-surface-variant bg-white shadow-inner transition-colors hover:border-primary-container"
                      >
                        <div className="relative h-20 w-20 overflow-hidden rounded-md">
                          <Image
                            src={selectedQr.qrCodeUrl}
                            alt={`QR code for table ${selectedTable.table_number}`}
                            fill
                            sizes="80px"
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      </button>
                      <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                        Scan to Order
                      </p>
                    </div>

                    <div className="flex w-full flex-col items-center border-t border-surface-variant pt-3">
                      <p className="mb-1 font-label-md text-label-md text-on-surface">
                        Digital Menu
                      </p>
                      <button
                        type="button"
                        onClick={copyQrLink}
                        className="flex items-center gap-1 text-sm font-medium text-primary transition hover:underline"
                      >
                        Copy Link
                        <span className="material-symbols-outlined text-xs">content_copy</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {showActiveOrder ? (
                  <div>
                    <h3 className="mb-sm flex items-center justify-between font-h3 text-h3 text-on-surface">
                      Current Order
                      <span className="font-normal text-body-sm text-on-surface-variant">
                        {latestOrder ? formatCurrency(latestOrder.total) : "0.00"}
                      </span>
                    </h3>
                    {ordersLoading ? (
                      <div className="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
                        Loading order history...
                      </div>
                    ) : (
                      <ul className="space-y-xs text-sm">
                        {latestOrderItems.map((item, index) => (
                          <li
                            key={`${item.menu_item_name || "item"}-${index}`}
                            className="flex items-center justify-between border-b border-surface-variant py-1"
                          >
                            <span className="text-on-surface">
                              {(item.quantity || 1)}x {item.menu_item_name || "Menu item"}
                            </span>
                            <span className="text-on-surface-variant">
                              {formatCurrency(item.price)}
                            </span>
                          </li>
                        ))}
                        <li className="py-1 italic text-on-surface-variant">
                          Latest status: {latestOrder.status || "pending"}
                        </li>
                      </ul>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
                Select a table on the floor map to inspect it here.
              </div>
            )}
          </div>

          <div className="space-y-sm border-t border-surface-variant bg-surface p-gutter">
            {!hasTables ? (
              <button
                type="button"
                onClick={addTable}
                disabled={busyTable === "add"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container py-sm font-label-md text-label-md text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {busyTable === "add" ? "Creating First Table..." : "Create First Table"}
              </button>
            ) : !hasTablesInSelectedZone ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedZone("All Areas")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-variant bg-surface-container-lowest py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-sm">grid_view</span>
                  All Areas
                </button>
                <button
                  type="button"
                  onClick={addTable}
                  disabled={busyTable === "add"}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container py-sm font-label-md text-label-md text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  {busyTable === "add" ? "Adding..." : "Add Table"}
                </button>
              </div>
            ) : selectedTable?.status === "open" ? (
              <button
                type="button"
                onClick={() => closeTable(selectedTable.table_number)}
                disabled={busyTable === selectedTable.table_number}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container py-sm font-label-md text-label-md text-white shadow-sm transition-colors hover:bg-primary"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                {busyTable === selectedTable.table_number ? "Closing Table..." : "Close Table"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openTable(selectedTable?.table_number)}
                disabled={!selectedTable || busyTable === selectedTable.table_number}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container py-sm font-label-md text-label-md text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                {busyTable === selectedTable?.table_number ? "Opening Table..." : "Open Table"}
              </button>
            )}

            {selectedQr ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQrModal(selectedQr)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-variant bg-surface-container-lowest py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-sm">qr_code_2</span>
                  QR
                </button>
                <button
                  type="button"
                  onClick={copyQrLink}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-variant bg-surface-container-lowest py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copy Link
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {billModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="app-modal-overlay bg-black/40"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setBillModal(null);
                }
              }}
            >
              <div
                className="app-modal-card rounded-[28px] bg-white p-6 shadow-2xl"
                style={{ "--app-modal-width": "780px" }}
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      Bill Summary
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      Table {getTableDisplayNumber(billModal.session?.table_number)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Session {billModal.session?.session_id}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-right text-sm text-emerald-700">
                    <div className="font-semibold">Payment</div>
                    <div>{billModal.payment_status || "unpaid"}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div>Opened: {formatBillDate(billModal.session?.opened_at)}</div>
                  <div>Closed: {formatBillDate(billModal.session?.closed_at)}</div>
                </div>

                <div className="mt-5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Item</th>
                        <th className="px-4 py-3 text-right font-semibold">Qty</th>
                        <th className="px-4 py-3 text-right font-semibold">Price</th>
                        <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(billModal.items || []).map((item, index) => (
                        <tr key={`${item.order_id}-${index}`}>
                          <td className="px-4 py-3 text-slate-900">
                            {item.menu_item_name || "Menu item"}
                          </td>
                          <td className="px-4 py-3 text-right">{item.quantity || 0}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                      {(billModal.items || []).length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                            No sent order items in this session.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_260px]">
                  <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <strong>{formatCurrency(billModal.totals?.subtotal)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Service charge</span>
                      <strong>{formatCurrency(billModal.totals?.service_charge_amount)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax/VAT</span>
                      <strong>{formatCurrency(billModal.totals?.tax_amount)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <strong>{formatCurrency(billModal.totals?.discount_amount)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 text-lg text-slate-950">
                      <span>Grand total</span>
                      <strong>{formatCurrency(billModal.totals?.grand_total)}</strong>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Payment QR
                    </p>
                    {billModal.payment?.promptpay?.qr_data_url ? (
                      <>
                        <div className="relative mx-auto mt-3 h-48 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white">
                          <Image
                            src={billModal.payment.promptpay.qr_data_url}
                            alt="Payment QR code"
                            fill
                            sizes="192px"
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-950">
                          Pay {formatCurrency(billModal.payment?.amount)} THB
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {billModal.payment.promptpay.account_name || "PromptPay"}
                        </p>
                      </>
                    ) : (
                      <div className="mt-3 rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-800">
                        <p className="font-semibold">QR payment is not configured.</p>
                        {billModal.payment?.bank_transfer?.enabled ? (
                          <p className="mt-2">
                            {billModal.payment.bank_transfer.bank_name || "Bank transfer"}{" "}
                            {billModal.payment.bank_transfer.account_number || ""}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => printBill(billModal)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Print bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillModal(null)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <Link
                    href={buildRestaurantPath(auth, "orders")}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Go to orders
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {qrModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="app-modal-overlay bg-black/40"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setQrModal(null);
                }
              }}
            >
              <div
                className="app-modal-card rounded-[28px] bg-white p-6 shadow-2xl"
                style={{ "--app-modal-width": "520px" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      QR Session
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      Table {getTableDisplayNumber(qrModal.tableNumber)}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrModal(null)}
                    className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium transition hover:bg-slate-200"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  {qrModal.qrCodeUrl ? (
                    <div
                      className="relative mx-auto overflow-hidden rounded-2xl bg-white"
                      style={{
                        width: 288,
                        height: 288,
                        maxWidth: "100%",
                        aspectRatio: "1 / 1",
                      }}
                    >
                      <Image
                        src={qrModal.qrCodeUrl}
                        alt={`QR code for table ${qrModal.tableNumber}`}
                        fill
                        sizes="288px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : null}
                </div>

                <div className="app-break-anywhere mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  {qrModal.fullUrl}
                </div>

                <button
                  type="button"
                  onClick={copyQrLink}
                  className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Copy Link
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}
