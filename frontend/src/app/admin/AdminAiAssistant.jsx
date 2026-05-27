"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  Copy,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Table2,
  ThumbsUp,
} from "lucide-react";
import { createApiClient } from "@/lib/api";

function formatTHB(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function buildContext({
  analytics,
  dailyClosing,
  menus,
  pendingPayments,
  readyOrders,
  tables,
}) {
  const openTables = tables.filter((table) => table.status === "open");
  const unavailableMenus = menus.filter((item) => item.isAvailable === false);
  const dailySummary = dailyClosing?.summary || {};
  const analyticsSummary = analytics?.summary || {};
  const topItems =
    dailyClosing?.topMenuItems?.length > 0
      ? dailyClosing.topMenuItems
      : analytics?.topItems || [];

  return {
    analyticsSummary,
    dailySummary,
    openTables,
    pendingPayments,
    readyOrders,
    tables,
    topItems,
    unavailableMenus,
  };
}

function buildReply(prompt, context) {
  const text = prompt.toLowerCase();
  const {
    analyticsSummary,
    dailySummary,
    openTables,
    pendingPayments,
    readyOrders,
    topItems,
    unavailableMenus,
  } = context;

  if (text.includes("ปิดยอด") || text.includes("daily") || text.includes("ยอด")) {
    return [
      "สรุปยอดวันนี้จากข้อมูลล่าสุด:",
      "",
      `- Paid sales: **${formatTHB(dailySummary.paidSales || analyticsSummary.totalRevenue || 0)}**`,
      `- Gross sales: **${formatTHB(dailySummary.grossSales || 0)}**`,
      `- Unpaid / pending: **${formatTHB(dailySummary.unpaidPending || 0)}**`,
      `- Orders: **${dailySummary.orderCount || analyticsSummary.orderCount || 0}**`,
      `- Average bill: **${formatTHB(dailySummary.averageBill || analyticsSummary.avgOrderValue || 0)}**`,
      "",
      readyOrders.length > 0
        ? `ควรเช็กคิวเสิร์ฟอีก ${readyOrders.length} order ก่อนปิดรอบ`
        : "ตอนนี้ไม่มี order ที่รอเสิร์ฟจากข้อมูลที่โหลดมา",
    ].join("\n");
  }

  if (
    text.includes("รีบ") ||
    text.includes("ปัญหา") ||
    text.includes("ต้องดู") ||
    text.includes("เตือน")
  ) {
    const alerts = [];
    if (readyOrders.length > 0) {
      alerts.push(
        `มี **${readyOrders.length} order** ready แล้วแต่ยังไม่ mark served`,
      );
    }
    if (pendingPayments.length > 0) {
      alerts.push(`มี payment รอตรวจ **${pendingPayments.length} รายการ**`);
    }
    if (openTables.length > 0) {
      alerts.push(`ยังมีโต๊ะเปิดอยู่ **${openTables.length} โต๊ะ**`);
    }
    if ((dailySummary.unpaidPending || 0) > 0) {
      alerts.push(`ยอด unpaid/pending วันนี้คือ **${formatTHB(dailySummary.unpaidPending)}**`);
    }
    if (alerts.length === 0) {
      alerts.push("ยังไม่เจอจุดเสี่ยงเด่นจากข้อมูลที่โหลดมา");
    }
    return ["สิ่งที่ควรดูตอนนี้:", "", ...alerts.map((item) => `- ${item}`)].join(
      "\n",
    );
  }

  if (text.includes("เมนู") || text.includes("ขายดี") || text.includes("หมด")) {
    const top = topItems.slice(0, 5);
    return [
      "ภาพรวมเมนูจากข้อมูลล่าสุด:",
      "",
      top.length
        ? top
            .map(
              (item, index) =>
                `- ${index + 1}. **${item.name}** (${item.quantity || 0} รายการ, ${formatTHB(item.revenue || 0)})`,
            )
            .join("\n")
        : "- ยังไม่มีข้อมูลเมนูขายดีในรอบนี้",
      "",
      unavailableMenus.length
        ? `เมนูที่ปิดขายอยู่: ${unavailableMenus
            .slice(0, 4)
            .map((item) => item.name)
            .join(", ")}`
        : "ยังไม่มีเมนูที่ถูกปิดขายชั่วคราว",
    ].join("\n");
  }

  if (text.includes("โต๊ะ") || text.includes("table")) {
    return [
      "สถานะโต๊ะตอนนี้:",
      "",
      `- โต๊ะเปิดอยู่: **${openTables.length}**`,
      `- โต๊ะทั้งหมดที่โหลดมา: **${context.tables.length}**`,
      openTables.length
        ? `- โต๊ะที่เปิด: ${openTables
            .slice(0, 8)
            .map((table) => `โต๊ะ ${table.table_number}`)
            .join(", ")}`
        : "- ยังไม่มีโต๊ะเปิดอยู่",
    ].join("\n");
  }

  return [
    "สรุปร้านตอนนี้:",
    "",
    `- โต๊ะเปิดอยู่ **${openTables.length} โต๊ะ**`,
    `- Order ready รอเสิร์ฟ **${readyOrders.length} ใบ**`,
    `- Payment รอตรวจ **${pendingPayments.length} รายการ**`,
    `- Paid sales วันนี้ **${formatTHB(dailySummary.paidSales || analyticsSummary.totalRevenue || 0)}**`,
    "",
    "ลองถามต่อได้ เช่น “มีอะไรต้องรีบดู”, “ปิดยอดวันนี้”, หรือ “เมนูไหนขายดี”",
  ].join("\n");
}

function renderMarkdownLite(text) {
  const lines = String(text || "").split("\n");
  return lines.map((line, index) => {
    if (!line.trim()) {
      return <div key={index} className="h-2" />;
    }

    const content = line.replace(/\*\*([^*]+)\*\*/g, "$1");
    if (line.startsWith("- ")) {
      return (
        <div key={index} className="flex gap-2">
          <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-45" />
          <span>{content.slice(2)}</span>
        </div>
      );
    }
    return <p key={index}>{content}</p>;
  });
}

function Message({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[86%] flex-col gap-2 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {!isUser ? (
          <div className="flex items-center gap-2 pl-1 text-xs font-semibold text-slate-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#5B7A99] to-[#C9D4E2] text-white">
              <Sparkles size={12} />
            </span>
            Restaurant AI
          </div>
        ) : null}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
            isUser
              ? "rounded-tr-md bg-[#2A3D52] text-white"
              : "rounded-tl-md border border-slate-100 bg-white text-slate-800"
          }`}
        >
          <div className="space-y-1">{renderMarkdownLite(message.content)}</div>
          {message.streaming ? (
            <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-[#5B7A99] align-text-bottom" />
          ) : null}
        </div>
        {!isUser && !message.streaming ? (
          <div className="ml-1 flex gap-1 text-slate-400">
            <button className="rounded-md p-1.5 hover:bg-slate-100" title="Copy">
              <Copy size={14} />
            </button>
            <button
              className="rounded-md p-1.5 hover:bg-slate-100"
              title="Regenerate"
            >
              <RefreshCcw size={14} />
            </button>
            <button
              className="rounded-md p-1.5 hover:bg-slate-100"
              title="Good response"
            >
              <ThumbsUp size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminAiAssistant({
  analytics,
  auth,
  dailyClosing,
  loadMenus,
  menus = [],
  menusLoading,
  onRefreshContext,
  tables = [],
}) {
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [activeChat, setActiveChat] = useState("ops");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "พร้อมช่วยดูภาพรวมร้านครับ ถามได้เลย เช่น “สรุปร้านตอนนี้”, “มีอะไรต้องรีบดู”, “ปิดยอดวันนี้” หรือ “เมนูไหนขายดี”",
    },
  ]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);
  const streamRef = useRef([]);

  const context = useMemo(
    () =>
      buildContext({
        analytics,
        dailyClosing,
        menus,
        pendingPayments,
        readyOrders,
        tables,
      }),
    [analytics, dailyClosing, menus, pendingPayments, readyOrders, tables],
  );

  const refreshOps = useCallback(async () => {
    if (!auth?.token) return;
    setOpsLoading(true);
    try {
      const [readyResponse, paymentsResponse] = await Promise.all([
        api.get("/order/ready-to-serve"),
        api.get("/payments/pending"),
      ]);
      setReadyOrders(readyResponse.data.order || []);
      setPendingPayments(paymentsResponse.data.order || []);
      if (menus.length === 0 && loadMenus) {
        await loadMenus();
      }
    } catch {
      setReadyOrders([]);
      setPendingPayments([]);
    } finally {
      setOpsLoading(false);
    }
  }, [api, auth?.token, loadMenus, menus.length]);

  const refreshAllContext = useCallback(async () => {
    await Promise.all([refreshOps(), onRefreshContext?.()]);
  }, [onRefreshContext, refreshOps]);

  useEffect(() => {
    refreshOps();
  }, [refreshOps]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      streamRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const send = useCallback(
    (input) => {
      const text = String(input || draft).trim();
      if (!text || streaming) return;

      streamRef.current.forEach((timer) => clearTimeout(timer));
      streamRef.current = [];

      const userMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };
      const assistantId = `assistant-${Date.now()}`;
      const fullReply = buildReply(text, context);

      setMessages((current) => [
        ...current,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          streaming: true,
        },
      ]);
      setDraft("");
      setStreaming(true);

      const chunks = fullReply.match(/.{1,18}(\s|$)/g) || [fullReply];
      chunks.forEach((chunk, index) => {
        const timer = window.setTimeout(() => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: `${message.content}${chunk}`,
                    streaming: index < chunks.length - 1,
                  }
                : message,
            ),
          );
          if (index === chunks.length - 1) {
            setStreaming(false);
            streamRef.current = [];
          }
        }, 30 * (index + 1));
        streamRef.current.push(timer);
      });
    },
    [context, draft, streaming],
  );

  const stop = () => {
    streamRef.current.forEach((timer) => clearTimeout(timer));
    streamRef.current = [];
    setMessages((current) =>
      current.map((message) =>
        message.streaming ? { ...message, streaming: false } : message,
      ),
    );
    setStreaming(false);
  };

  const conversations = [
    { id: "ops", title: "Live operations", sub: "โต๊ะ / คิว / payment" },
    { id: "closing", title: "Daily closing", sub: "ปิดยอดวันนี้" },
    { id: "menu", title: "Menu insight", sub: "เมนูขายดี / เมนูหมด" },
  ];

  const quickPrompts = [
    "สรุปร้านตอนนี้",
    "มีอะไรต้องรีบดู",
    "ปิดยอดวันนี้",
    "เมนูไหนขายดี",
  ];

  const statCards = [
    {
      label: "Open tables",
      value: context.openTables.length,
      icon: Table2,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Ready to serve",
      value: readyOrders.length,
      icon: Bot,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Pending payment",
      value: pendingPayments.length,
      icon: BarChart3,
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-slate-200 bg-[#F6F7F9] shadow-sm">
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-200 bg-[#F0F2F5] md:flex">
        <div className="flex items-center gap-3 px-4 pb-3 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B7A99] to-[#C9D4E2] text-white">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">Restaurant AI</p>
            <p className="text-xs text-slate-500">Owner assistant</p>
          </div>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              setActiveChat("ops");
              setMessages([
                {
                  id: `fresh-${Date.now()}`,
                  role: "assistant",
                  content:
                    "เริ่มแชทใหม่แล้วครับ ถามเรื่องร้านจากข้อมูลล่าสุดได้เลย",
                },
              ]);
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <Plus size={15} />
            New chat
          </button>
        </div>

        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-200/60 px-3 py-2 text-sm text-slate-500">
            <Search size={15} />
            Search chats...
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-2">
          <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Today
          </p>
          {conversations.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => setActiveChat(chat.id)}
              className={`w-full rounded-lg px-3 py-2 text-left transition ${
                activeChat === chat.id
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              <p className="truncate text-sm font-semibold">{chat.title}</p>
              <p className="truncate text-xs text-slate-500">{chat.sub}</p>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
              {(auth?.username || "AD").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {auth?.username || "Admin"}
              </p>
              <p className="text-xs text-slate-500">Admin workspace</p>
            </div>
            <MoreHorizontal size={16} className="text-slate-400" />
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-col gap-3 border-b border-slate-200 bg-[#F6F7F9] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              AI Operations Assistant
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Ask about today&apos;s restaurant flow
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.tone}`}
                  >
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {card.label}
                    </p>
                    <p className="text-sm font-bold text-slate-950">
                      {card.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-8"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  disabled={streaming}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {opsLoading || menusLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Refreshing restaurant context...
              </div>
            ) : null}

            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-[#F6F7F9] px-4 py-4 md:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_40px_rgba(20,23,26,0.08)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="ถาม AI เช่น วันนี้มีอะไรต้องรีบดู?"
                className="min-h-12 w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  title="Attach"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  title="Voice"
                >
                  <Mic size={18} />
                </button>
                <button
                  type="button"
                  onClick={refreshAllContext}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Refresh context
                </button>
                <div className="flex-1" />
                {streaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                    title="Stop"
                  >
                    <Square size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={!draft.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5B7A99] text-white transition hover:bg-[#4b6682] disabled:bg-slate-200 disabled:text-slate-400"
                    title="Send"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">
              AI ใช้ข้อมูลที่โหลดในหน้า admin ตอนนี้ โปรดตรวจสอบข้อมูลสำคัญก่อนตัดสินใจ
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
