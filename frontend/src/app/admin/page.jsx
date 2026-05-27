"use client";

import Link from "next/link";
import Swal from "sweetalert2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MenuUpload from "../components/menupload";
import AdminAiAssistant from "./AdminAiAssistant";
import { buildRestaurantPath } from "@/lib/auth";
import { buildWsUrl, createApiClient } from "@/lib/api";
import { useAuth } from "../components/AuthProvider";
import { useRestaurantAccess } from "../components/useRestaurantAccess";

function formatTHB(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDayLabel(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${dateString}T00:00:00+07:00`));
}

function formatDateTime(iso) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function formatLastActive(user) {
  if (user.online_status === "active") return "ตอนนี้";
  if (!user.last_active_at) return "-";
  return formatDateTime(user.last_active_at);
}

function SalesTrendChart({ data = [] }) {
  const width = 640;
  const height = 220;
  const padding = 24;
  const maxRevenue = Math.max(...data.map((item) => item.revenue || 0), 0);
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x =
      data.length <= 1
        ? width / 2
        : padding + (index * chartWidth) / (data.length - 1);
    const y =
      maxRevenue <= 0
        ? height - padding
        : padding + chartHeight - (item.revenue / maxRevenue) * chartHeight;
    return { ...item, x, y };
  });

  const areaPath = points.length
    ? `M ${points[0].x} ${height - padding} ` +
      points.map((point) => `L ${point.x} ${point.y}`).join(" ") +
      ` L ${points[points.length - 1].x} ${height - padding} Z`
    : "";
  const linePath = points.length
    ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`
    : "";
  const breakdown = data.length > 14 ? data.slice(-7) : data;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-md shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label-md font-bold uppercase tracking-wider text-slate-500">
            Sales Trend
          </p>
          <h3 className="mt-1 font-h3 text-h3 text-primary">
            Revenue in the last {data.length || 0} days
          </h3>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Completed orders only
        </div>
      </div>

      {points.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          No sales data available yet.
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="min-w-[640px]"
              role="img"
              aria-label="Sales trend chart"
            >
              <defs>
                <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.04" />
                </linearGradient>
              </defs>

              {[0, 1, 2, 3].map((step) => {
                const y = padding + (chartHeight / 3) * step;
                return (
                  <line
                    key={step}
                    x1={padding}
                    x2={width - padding}
                    y1={y}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="4 6"
                  />
                );
              })}

              {areaPath ? <path d={areaPath} fill="url(#sales-area)" /> : null}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {points.map((point) => (
                <g key={point.date}>
                  <circle cx={point.x} cy={point.y} r="5" fill="#2563eb" />
                  <title>{`${formatDayLabel(point.date)}: ${formatTHB(
                    point.revenue,
                  )} (${point.orderCount} orders)`}</title>
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {data.length > 14 ? "Latest 7 days" : "Daily breakdown"}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {breakdown.map((item) => (
              <div
                key={item.date}
                className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {formatDayLabel(item.date)}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatTHB(item.revenue)}
                </p>
                <p className="text-xs text-slate-500">{item.orderCount} orders</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function RestaurantDashboard() {
  const { signOut } = useAuth();
  const { auth, ready, allowed } = useRestaurantAccess([
    "owner",
    "admin",
    "superadmin",
  ]);
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);

  const wsRef = useRef(null);
  const menuImageInputRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [tables, setTables] = useState([]);
  const [users, setUsers] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingRestaurants, setPendingRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [restaurantActionId, setRestaurantActionId] = useState(null);
  const [restaurantSettings, setRestaurantSettings] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingMenu, setEditingMenu] = useState(null);
  const [menuData, setMenuData] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    ingredients: "",
    isAvailable: true,
  });
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "staff",
  });
  const [activeTab, setActiveTab] = useState("staff");
  const [staffSearch, setStaffSearch] = useState("");
  const [menus, setMenus] = useState([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("all");
  const [menuStatus, setMenuStatus] = useState("all");
  const [analytics, setAnalytics] = useState({
    summary: {
      totalRevenue: 0,
      orderCount: 0,
      avgOrderValue: 0,
      bestOrderValue: 0,
      openTables: 0,
    },
    salesSeries: [],
    topItems: [],
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState(null);
  const [dailyClosing, setDailyClosing] = useState(null);
  const [dailyClosingDate, setDailyClosingDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [dailyClosingLoading, setDailyClosingLoading] = useState(false);

  const reservedTables =
    analytics.summary.openTables ||
    tables.filter((item) => item.status === "open").length;
  const restaurantProfile = restaurantSettings?.profile || {};
  const menuPlaceholderImage =
    restaurantSettings?.menu_settings?.placeholderImageUrl || "";
  const callStaffSoundEnabled =
    restaurantSettings?.notification_settings?.callStaffSound !== false;

  // Keep the page behind dialogs from scrolling.
  useEffect(() => {
    const isAnyModalOpen = showUserModal || showMenu;
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showUserModal, showMenu]);

  const loadMenus = useCallback(async () => {
    setMenusLoading(true);
    try {
      const response = await api.get("/menu/get");
      setMenus(response.data.menu || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load menus failed",
        text: error.normalizedMessage || "Unable to fetch menus",
      });
    } finally {
      setMenusLoading(false);
    }
  }, [api]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const response = await api.get("/admin/analytics", {
        params: { days: analyticsDays },
      });
      setAnalytics({
        summary: response.data.summary || {
          totalRevenue: 0,
          orderCount: 0,
          avgOrderValue: 0,
          bestOrderValue: 0,
          openTables: 0,
        },
        salesSeries: response.data.salesSeries || [],
        topItems: response.data.topItems || [],
      });
      setAnalyticsUpdatedAt(new Date().toISOString());
    } catch (error) {
      setAnalyticsError(
        error.normalizedMessage || "Unable to fetch restaurant analytics",
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDays, api]);

  const loadDailyClosing = useCallback(async () => {
    setDailyClosingLoading(true);
    try {
      const response = await api.get("/reports/daily-closing", {
        params: { date: dailyClosingDate },
      });
      setDailyClosing(response.data.report || null);
    } catch {
      setDailyClosing(null);
    } finally {
      setDailyClosingLoading(false);
    }
  }, [api, dailyClosingDate]);

  const exportDailyClosingCsv = async () => {
    try {
      const response = await api.get("/reports/daily-closing.csv", {
        params: { date: dailyClosingDate },
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `daily-closing-${dailyClosingDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Export failed",
        text: error.normalizedMessage || "Unable to export daily closing CSV",
      });
    }
  };

  useEffect(() => {
    if (!ready || !allowed || !auth?.token) return;
    if (activeTab === "menu" || activeTab === "ai") {
      loadMenus();
    }
  }, [activeTab, allowed, auth?.token, loadMenus, ready]);

  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({
      username: "",
      email: "",
      password: "",
      role: "staff",
    });
    setShowUserModal(false);
  };

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await api.get("/admin/getuser");
      setUsers(response.data.user || []);
      setUserCount(response.data.count || 0);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load users failed",
        text: error.normalizedMessage || "Unable to fetch users",
      });
    } finally {
      setUsersLoading(false);
    }
  }, [api]);

  const loadPendingRestaurants = useCallback(async () => {
    if (auth?.role !== "superadmin") return;

    setRestaurantsLoading(true);
    try {
      const response = await api.get("/restaurant/pending");
      setPendingRestaurants(response.data.restaurants || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load restaurants failed",
        text: error.normalizedMessage || "Unable to fetch pending restaurants",
      });
    } finally {
      setRestaurantsLoading(false);
    }
  }, [api, auth?.role]);

  const loadRestaurantSettings = useCallback(async () => {
    try {
      const response = await api.get("/restaurant/settings");
      setRestaurantSettings(response.data.settings || null);
    } catch {
      setRestaurantSettings(null);
    }
  }, [api]);

  const updateRestaurantStatus = async (restaurantId, action) => {
    setRestaurantActionId(`${action}:${restaurantId}`);
    try {
      await api.post(`/restaurant/${restaurantId}/${action}`);
      Swal.fire({
        icon: "success",
        title:
          action === "approve" ? "Restaurant approved" : "Restaurant updated",
        timer: 1300,
        showConfirmButton: false,
      });
      await loadPendingRestaurants();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Update failed",
        text: error.normalizedMessage || "Unable to update restaurant status",
      });
    } finally {
      setRestaurantActionId(null);
    }
  };

  useEffect(() => {
    if (!ready || !allowed || !auth?.username || !auth?.token) return;

    const socket = new WebSocket(
      buildWsUrl(
        `/ws/${encodeURIComponent(auth.username)}?role=admin`,
        auth.token,
      ),
    );
    wsRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "call_staff") {
          if (callStaffSoundEnabled) {
            try {
              const audio = new Audio(
                "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
              );
              audio.play().catch(() => undefined);
            } catch {
              // ignore browsers that block notification sounds
            }
          }
          Swal.fire({
            title: `โต๊ะ ${data.table_number} เรียกพนักงาน`,
            text: `เวลา ${new Date(data.timestamp).toLocaleTimeString("th-TH")}`,
            icon: "info",
            confirmButtonText: "รับทราบ",
          });
        }
      } catch {
        // ignore malformed notifications
      }
    };

    return () => socket.close();
  }, [allowed, auth?.token, auth?.username, callStaffSoundEnabled, ready]);

  useEffect(() => {
    if (!ready || !allowed || !auth?.token) return;

    const loadTables = async () => {
      try {
        const response = await api.get("/tables/gettable");
        setTables(response.data.tables || []);
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "โหลดข้อมูลไม่สำเร็จ",
          text: error.normalizedMessage || "ไม่สามารถดึงข้อมูลโต๊ะได้",
        });
      }
    };

    loadTables();
  }, [allowed, api, auth?.token, ready]);

  useEffect(() => {
    if (!ready || !allowed || !auth?.token) return;
    loadUsers();
    loadRestaurantSettings();
  }, [allowed, auth?.token, loadRestaurantSettings, loadUsers, ready]);

  useEffect(() => {
    if (!ready || !allowed || !auth?.token) return;
    if (activeTab === "staff" || activeTab === "ai") {
      loadAnalytics();
      loadDailyClosing();
    }
  }, [activeTab, allowed, auth?.token, loadAnalytics, loadDailyClosing, ready]);

  const refreshAiContext = useCallback(async () => {
    await Promise.all([loadAnalytics(), loadDailyClosing(), loadMenus()]);
  }, [loadAnalytics, loadDailyClosing, loadMenus]);

  useEffect(() => {
    if (!ready || !allowed || auth?.role !== "superadmin" || !auth?.token) {
      return;
    }
    loadPendingRestaurants();
  }, [allowed, auth?.role, auth?.token, loadPendingRestaurants, ready]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const resetMenuForm = () => {
    setShowMenu(false);
    setEditingMenu(null);
    setMenuData({
      name: "",
      price: "",
      description: "",
      category: "",
      ingredients: "",
      isAvailable: true,
    });
    setImagePreview(null);
    if (menuImageInputRef.current) {
      menuImageInputRef.current.value = "";
    }
  };

  const closeOpenModals = () => {
    setShowUserModal(false);
    setShowMenu(false);
  };

  const showAlertReplacingModal = async (options) => {
    closeOpenModals();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    return Swal.fire(options);
  };

  const handleMenuSubmit = async (event) => {
    event.preventDefault();
    setSubmitLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", menuData.name);
      formData.append("description", menuData.description);
      formData.append("price", menuData.price);
      formData.append("category", menuData.category);
      formData.append("ingredients", menuData.ingredients || "");
      formData.append("isAvailable", String(menuData.isAvailable));

      const imageFile = menuImageInputRef.current?.files?.[0];
      if (imageFile) {
        formData.append("image", imageFile);
      }

      if (editingMenu) {
        await api.patch(`/admin/menu/${editingMenu.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/admin/upload-menu", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      Swal.fire({
        icon: "success",
        title: "อัปโหลดเมนูสำเร็จ",
        timer: 1800,
        showConfirmButton: false,
      });
      resetMenuForm();
      await loadMenus();
    } catch (error) {
      await showAlertReplacingModal({
        icon: "error",
        title: "อัปโหลดเมนูไม่สำเร็จ",
        text: error.normalizedMessage || "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const startEditMenu = (item) => {
    setEditingMenu(item);
    setMenuData({
      name: item.name || "",
      price: item.price || "",
      description: item.description || "",
      category: item.category || "",
      ingredients: item.ingredients || "",
      isAvailable: item.isAvailable !== false,
    });
    setImagePreview(item.image || null);
    if (menuImageInputRef.current) {
      menuImageInputRef.current.value = "";
    }
    setShowMenu(true);
  };

  const toggleMenuAvailability = async (item) => {
    const nextAvailable = item.isAvailable === false;

    try {
      const response = await api.patch(`/admin/menu/${item.id}/availability`, {
        isAvailable: nextAvailable,
      });
      const updatedMenu = response.data.menu || {
        ...item,
        isAvailable: nextAvailable,
      };
      setMenus((current) =>
        current.map((menu) =>
          menu.id === item.id ? { ...menu, ...updatedMenu } : menu,
        ),
      );
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Update menu status failed",
        text: error.normalizedMessage || "Please try again",
      });
    }
  };

  const handleDeleteMenu = async (item) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${item.name}?`,
      text: "This menu item will be permanently deleted",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/admin/menu/${item.id}`);
      setMenus((current) => current.filter((menu) => menu.id !== item.id));
      Swal.fire({
        icon: "success",
        title: "Menu deleted",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Delete menu failed",
        text: error.normalizedMessage || "Please try again",
      });
    }
  };

  const handleUserSubmit = async (event) => {
    event.preventDefault();
    setUserSubmitting(true);

    try {
      if (editingUser) {
        await api.post("/admin/updateuser", {
          originuser: editingUser.username,
          username: userForm.username,
          email: userForm.email,
          role: userForm.role,
        });
      } else {
        await api.post("/admin/createuser", userForm);
      }

      Swal.fire({
        icon: "success",
        title: editingUser ? "User updated" : "User created",
        timer: 1500,
        showConfirmButton: false,
      });
      resetUserForm();
      await loadUsers();
    } catch (error) {
      await showAlertReplacingModal({
        icon: "error",
        title: editingUser ? "Update failed" : "Create failed",
        text: error.normalizedMessage || "Please try again",
      });
    } finally {
      setUserSubmitting(false);
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      username: user.username || "",
      email: user.email || "",
      password: "",
      role: user.role || "staff",
    });
    setShowUserModal(true);
  };

  const handleDeleteUser = async (username) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${username}?`,
      text: "This action cannot be undone",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    try {
      await api.post("/admin/deleteuser", { username });
      Swal.fire({
        icon: "success",
        title: "User deleted",
        timer: 1200,
        showConfirmButton: false,
      });
      if (editingUser?.username === username) {
        resetUserForm();
      }
      await loadUsers();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: error.normalizedMessage || "Please try again",
      });
    }
  };

  if (!ready || (auth?.token && !allowed)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-secondary">กำลังโหลดข้อมูลระบบ...</p>
      </div>
    );
  }

  // Derived values for the UI
  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "manager":
      case "admin":
      case "superadmin":
      case "owner":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "chef":
      case "kitchen":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "server":
      case "staff":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const normalizedStaffSearch = staffSearch.trim().toLowerCase();
  const filteredUsers = normalizedStaffSearch
    ? users.filter((user) =>
        [user.username, user.email, user.role]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedStaffSearch),
          ),
      )
    : users;

  const menuCategories = [
    "all",
    ...Array.from(
      new Set(
        menus
          .map((item) => item.category)
          .filter(Boolean)
          .map((category) => String(category)),
      ),
    ).sort((a, b) => a.localeCompare(b)),
  ];
  const normalizedMenuSearch = menuSearch.trim().toLowerCase();
  const filteredMenus = menus.filter((item) => {
    const matchesSearch =
      !normalizedMenuSearch ||
      [item.name, item.category, item.description]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedMenuSearch),
        );
    const matchesCategory =
      menuCategory === "all" || String(item.category) === menuCategory;
    const matchesStatus =
      menuStatus === "all" ||
      (menuStatus === "active" && item.isAvailable !== false) ||
      (menuStatus === "hidden" && item.isAvailable === false);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="bg-background text-on-surface min-h-screen font-sans">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 md:flex flex-col py-6 px-4 gap-2 z-50 transition-all duration-200 ease-in-out">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center overflow-hidden font-bold text-on-primary text-xl">
              {restaurantProfile.logoDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={restaurantProfile.logoDataUrl}
                    alt="Restaurant logo"
                    className="h-full w-full object-cover"
                  />
                </>
              ) : (
                auth?.restaurantSlug?.charAt(0).toUpperCase() || "R"
              )}
            </div>
            <div>
              <h1 className="text-lg font-black text-indigo-900 dark:text-white leading-tight">
                {restaurantProfile.name || auth?.restaurantName || "RestoAdmin"}
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                {restaurantProfile.slug || auth?.restaurantSlug || "Management Suite"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab("staff")}
            className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              activeTab === "staff"
                ? "bg-slate-100 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300 border-r-4 border-indigo-900 dark:border-indigo-400"
                : "text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900"
            }`}
          >
            <span className="material-symbols-outlined">badge</span>
            <span className="font-sans text-sm">Staff Management</span>
          </button>
          
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              activeTab === "menu"
                ? "bg-slate-100 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300 border-r-4 border-indigo-900 dark:border-indigo-400"
                : "text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>restaurant_menu</span>
            <span className="font-sans text-sm">Menu Management</span>
          </button>

          <button
            onClick={() => setActiveTab("ai")}
            className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              activeTab === "ai"
                ? "bg-slate-100 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300 border-r-4 border-indigo-900 dark:border-indigo-400"
                : "text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900"
            }`}
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            <span className="font-sans text-sm">AI Assistant</span>
          </button>
          
          <Link
            href={buildRestaurantPath(auth, "orders")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="font-sans text-sm">Live Orders</span>
          </Link>
          <Link
            href={buildRestaurantPath(auth, "tables")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            <span className="material-symbols-outlined">map</span>
            <span className="font-sans text-sm">Floor Plan</span>
          </Link>
          <Link
            href={buildRestaurantPath(auth, "kitchen")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            <span className="material-symbols-outlined">kitchen</span>
            <span className="font-sans text-sm">Kitchen</span>
          </Link>
          <Link
            href={buildRestaurantPath(auth, "settings")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="font-sans text-sm">Settings</span>
          </Link>
        </nav>

        <button
          onClick={() => setShowMenu(true)}
          className="mt-auto bg-primary text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 duration-150 transition-all shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>Add Menu Item</span>
        </button>
      </aside>

      {/* TopAppBar */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 z-40 shadow-sm transition-colors duration-150">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              className="w-full bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary-container text-on-surface"
              placeholder="Search operations..."
              type="text"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <span
            className={`hidden sm:inline-flex px-2 py-0.5 rounded-full items-center text-xs font-semibold border ${
              connected
                ? "bg-emerald-100/50 text-emerald-700 border-emerald-200"
                : "bg-error-container text-on-error-container border-error"
            }`}
          >
            {connected && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
            )}
            {connected ? "Live" : "Offline"}
          </span>

          <button className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95">
            <span className="material-symbols-outlined">help_outline</span>
          </button>
          <div className="hidden md:block h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-indigo-950 dark:text-white leading-none capitalize">
                {auth?.username}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 capitalize">
                {auth?.role} Access
              </p>
            </div>
            <button
              onClick={() => {
                signOut();
                window.location.href = "/signin";
              }}
              title="Sign out"
              className="w-10 h-10 rounded-full border-2 border-primary-fixed overflow-hidden bg-primary text-white flex items-center justify-center"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 px-4 md:px-margin pb-xl min-h-screen md:ml-64">
        {activeTab === "staff" && (
          <>
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 md:gap-gutter mb-lg">
          <div>
            <h2 className="font-h1 text-h1 text-primary tracking-tight">
              Staff Management
            </h2>
            <p className="font-body-md text-body-md text-secondary mt-1">
              Manage employee rosters, roles, and shift availability.
            </p>
          </div>
          <div className="flex w-full xl:w-auto flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative w-full sm:w-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                className="w-full sm:w-64 bg-surface-container-lowest border-outline-variant rounded-lg py-base pl-10 pr-md text-body-sm focus:border-primary focus:ring-0 transition-all"
                placeholder="Search employees..."
                type="text"
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
              />
            </div>
            <button
              onClick={() => setShowUserModal(true)}
              className="bg-primary text-on-primary h-[48px] w-full sm:w-auto px-md rounded-lg font-label-md flex items-center justify-center gap-base active:scale-95 transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">
                person_add
              </span>
              <span>Add New Member</span>
            </button>
          </div>
        </div>

        {auth?.role === "superadmin" && (
          <section className="mb-lg rounded-xl border border-amber-100 bg-amber-50/70 p-md shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-label-md font-bold uppercase tracking-wider text-amber-700">
                  Platform approval queue
                </p>
                <h3 className="mt-1 font-h2 text-h2 text-slate-950">
                  Restaurant approvals
                </h3>
                <p className="mt-1 text-body-sm text-slate-600">
                  Review restaurants created by new owners before they can
                  operate in the system.
                </p>
              </div>
              <button
                type="button"
                onClick={loadPendingRestaurants}
                disabled={restaurantsLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    restaurantsLoading ? "animate-spin" : ""
                  }`}
                >
                  refresh
                </span>
                Refresh queue
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-amber-100 bg-white">
              {restaurantsLoading && pendingRestaurants.length === 0 ? (
                <div className="px-md py-lg text-center text-body-sm text-slate-500">
                  Loading pending restaurants...
                </div>
              ) : pendingRestaurants.length === 0 ? (
                <div className="px-md py-lg text-center">
                  <p className="font-label-md text-slate-700">
                    No pending restaurants
                  </p>
                  <p className="mt-1 text-body-sm text-slate-500">
                    New owner registrations will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingRestaurants.map((restaurant) => {
                    const approving =
                      restaurantActionId === `approve:${restaurant.id}`;
                    const rejecting =
                      restaurantActionId === `reject:${restaurant.id}`;

                    return (
                      <div
                        key={restaurant.id}
                        className="grid gap-4 px-md py-base md:grid-cols-[1fr_auto] md:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-body-md font-bold text-slate-950">
                              {restaurant.name}
                            </p>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-label-sm font-bold uppercase text-amber-800">
                              {restaurant.status}
                            </span>
                          </div>
                          <p className="mt-1 break-all text-body-sm text-slate-500">
                            /{restaurant.slug}
                          </p>
                          <p className="mt-1 text-label-sm text-slate-400">
                            Created{" "}
                            {restaurant.created_at
                              ? new Date(
                                  restaurant.created_at,
                                ).toLocaleString()
                              : "recently"}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() =>
                              updateRestaurantStatus(restaurant.id, "approve")
                            }
                            disabled={!!restaurantActionId}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {approving ? "Approving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateRestaurantStatus(restaurant.id, "reject")
                            }
                            disabled={!!restaurantActionId}
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            {rejecting ? "Rejecting..." : "Reject"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="mb-lg flex flex-col gap-3 rounded-lg border border-slate-100 bg-white px-md py-base shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-label-md font-bold uppercase tracking-wider text-slate-500">
              Sales Analytics
            </p>
            <p className="mt-1 text-body-sm text-secondary">
              Based on paid completed orders. Last updated{" "}
              {formatDateTime(analyticsUpdatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setAnalyticsDays(days)}
                className={`h-9 rounded-md px-3 text-sm font-semibold transition ${
                  analyticsDays === days
                    ? "bg-primary text-on-primary"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {days}D
              </button>
            ))}
            <button
              type="button"
              onClick={loadAnalytics}
              disabled={analyticsLoading}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  analyticsLoading ? "animate-spin" : ""
                }`}
              >
                refresh
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Analytics Bento Overview */}
        <div className="grid grid-cols-1 gap-gutter mb-lg md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-surface-container-lowest border border-slate-100 p-md rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-base">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <span className="material-symbols-outlined">payments</span>
              </div>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-label-sm font-bold">
                Real sales
              </span>
            </div>
            <p className="text-label-md text-secondary uppercase tracking-wider">
              Total Revenue
            </p>
            <p className="text-h2 font-display text-primary mt-xs">
              {analyticsLoading ? "Loading..." : formatTHB(analytics.summary.totalRevenue)}
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-slate-100 p-md rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-base">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
              <span className="text-slate-400 text-label-sm">
                Completed
              </span>
            </div>
            <p className="text-label-md text-secondary uppercase tracking-wider">
              Orders Closed
            </p>
            <p className="text-h1 font-display text-primary mt-xs">
              {analyticsLoading ? "..." : analytics.summary.orderCount}
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-slate-100 p-md rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-base">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                <span className="material-symbols-outlined">stacked_line_chart</span>
              </div>
              <span className="text-slate-400 text-label-sm">
                Per bill
              </span>
            </div>
            <p className="text-label-md text-secondary uppercase tracking-wider">
              Avg Order Value
            </p>
            <p className="text-h2 font-display text-primary mt-xs">
              {analyticsLoading ? "Loading..." : formatTHB(analytics.summary.avgOrderValue)}
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-slate-100 p-md rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-base">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <span className="material-symbols-outlined">table_restaurant</span>
              </div>
              <span className="text-amber-700 font-bold text-label-sm">Live floor</span>
            </div>
            <p className="text-label-md text-secondary uppercase tracking-wider">
              Open Tables
            </p>
            <p className="text-h1 font-display text-primary mt-xs">
              {analyticsLoading ? "..." : reservedTables}
            </p>
          </div>
        </div>

        {analyticsError ? (
          <div className="mb-lg rounded-xl border border-rose-200 bg-rose-50 px-md py-base text-sm text-rose-700">
            {analyticsError}
          </div>
        ) : null}

        <div className="mb-lg rounded-xl border border-slate-100 bg-white p-md shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-label-md font-bold uppercase tracking-wider text-slate-500">
                Daily Closing
              </p>
              <h3 className="mt-1 font-h3 text-h3 text-primary">
                Close of day snapshot
              </h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={dailyClosingDate}
                onChange={(event) => setDailyClosingDate(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={loadDailyClosing}
                disabled={dailyClosingLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    dailyClosingLoading ? "animate-spin" : ""
                  }`}
                >
                  refresh
                </span>
                Load
              </button>
              <button
                type="button"
                onClick={exportDailyClosingCsv}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-[18px]">
                  download
                </span>
                CSV
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Paid sales", dailyClosing?.summary?.paidSales],
              ["Gross sales", dailyClosing?.summary?.grossSales],
              ["Unpaid/pending", dailyClosing?.summary?.unpaidPending],
              ["Average bill", dailyClosing?.summary?.averageBill],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-950">
                  {dailyClosingLoading ? "Loading..." : formatTHB(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-900">Top menu items</p>
              <div className="mt-3 space-y-2">
                {(dailyClosing?.topMenuItems || []).slice(0, 5).map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-slate-700">{item.name}</span>
                    <span className="font-semibold text-slate-950">
                      {item.quantity} · {formatTHB(item.revenue)}
                    </span>
                  </div>
                ))}
                {(dailyClosing?.topMenuItems || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No paid sales yet.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-900">Open tables</p>
              <div className="mt-3 space-y-2">
                {(dailyClosing?.openTables || []).slice(0, 5).map((table) => (
                  <div
                    key={`${table.table_number}-${table.customer_session}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-700">
                      Table {table.table_number}
                    </span>
                    <span className="max-w-[180px] truncate font-mono text-xs text-slate-500">
                      {table.customer_session}
                    </span>
                  </div>
                ))}
                {(dailyClosing?.openTables || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No open tables.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* User Management Table */}
        <div className="bg-surface-container-lowest border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-md py-base border-b border-slate-100 flex items-center justify-between bg-surface-container-low/30">
            <h3 className="font-h3 text-h3 text-primary">Staff Directory</h3>
            <div className="flex items-center gap-xs">
              <button
                onClick={loadUsers}
                className="p-2 text-outline hover:bg-surface-container-high rounded-lg transition-colors"
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    usersLoading ? "animate-spin" : ""
                  }`}
                >
                  refresh
                </span>
              </button>
              <button className="p-2 text-outline hover:bg-surface-container-high rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[20px]">
                  filter_list
                </span>
              </button>
              <button className="p-2 text-outline hover:bg-surface-container-high rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[20px]">
                  download
                </span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-md py-base font-label-md text-secondary uppercase tracking-wider border-b border-slate-100">
                    Name
                  </th>
                  <th className="px-md py-base font-label-md text-secondary uppercase tracking-wider border-b border-slate-100">
                    Role
                  </th>
                  <th className="px-md py-base font-label-md text-secondary uppercase tracking-wider border-b border-slate-100">
                    Status
                  </th>
                  <th className="px-md py-base font-label-md text-secondary uppercase tracking-wider border-b border-slate-100">
                    Last Active
                  </th>
                  <th className="px-md py-base font-label-md text-secondary uppercase tracking-wider border-b border-slate-100 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user, idx) => (
                  <tr
                    key={user.username}
                    className="hover:bg-surface-container-low/20 transition-colors group"
                  >
                    <td className="px-md py-md">
                      <div className="flex items-center gap-md">
                        <div className="w-10 h-10 rounded-full object-cover bg-primary-container text-on-primary font-bold flex justify-center items-center">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-body-md font-semibold text-primary">
                            {user.username}
                          </p>
                          <p className="text-label-sm text-outline">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-md py-md">
                      <span
                        className={`px-3 py-1 rounded-full text-label-md font-medium border capitalize ${getRoleBadgeClass(
                          user.role,
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-md py-md">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            user.online_status === "active"
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-slate-400"
                          }`}
                        ></div>
                        <span
                          className={`font-medium text-body-sm px-2 py-0.5 rounded ${
                            user.online_status === "active"
                              ? "text-emerald-700 bg-emerald-50"
                              : "text-slate-600 bg-slate-50"
                          }`}
                        >
                          {user.online_status === "active" ? "Active" : "Offline"}
                        </span>
                      </div>
                    </td>
                    <td className="px-md py-md font-body-sm text-secondary">
                      {formatLastActive(user)}
                    </td>
                    <td className="px-md py-md text-right">
                      <div className="flex items-center justify-end gap-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditUser(user)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-secondary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            edit
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.username)}
                          className="p-2 hover:bg-error/10 rounded-lg text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && !usersLoading && (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-md py-md text-center text-secondary"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-md py-base border-t border-slate-100 bg-surface-container-low/10 flex items-center justify-between">
            <p className="text-label-sm text-outline">
              Showing {filteredUsers.length} of {userCount} members
            </p>
            <div className="flex items-center gap-base">
              <button
                className="p-1 border border-outline-variant rounded hover:bg-surface-container-high transition-colors disabled:opacity-50"
                disabled={true}
              >
                <span className="material-symbols-outlined text-[20px]">
                  chevron_left
                </span>
              </button>
              <button className="p-1 border border-outline-variant rounded hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[20px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Sales Analytics */}
        <div className="mt-lg grid grid-cols-1 md:grid-cols-12 gap-gutter">
          <div className="md:col-span-8">
            <SalesTrendChart data={analytics.salesSeries} />
          </div>
          <div className="md:col-span-4 bg-white border border-slate-100 p-md rounded-xl flex flex-col">
            <div className="flex items-center gap-base mb-sm">
              <span
                className="material-symbols-outlined text-amber-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                local_fire_department
              </span>
              <p className="font-label-md text-primary uppercase">
                Top Items
              </p>
            </div>
            <div className="space-y-3">
              {analytics.topItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No completed sales yet.
                </div>
              ) : (
                analytics.topItems.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.quantity} items sold
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatTHB(item.revenue)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              Best order value: {formatTHB(analytics.summary.bestOrderValue)}
            </div>
          </div>
        </div>
          </>
        )}

        {activeTab === "ai" && (
          <AdminAiAssistant
            analytics={analytics}
            auth={auth}
            dailyClosing={dailyClosing}
            loadMenus={loadMenus}
            menus={menus}
            menusLoading={menusLoading || analyticsLoading || dailyClosingLoading}
            onRefreshContext={refreshAiContext}
            tables={tables}
          />
        )}

        {activeTab === "menu" && (
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-margin gap-4">
              <div>
                <h1 className="font-h1 text-h1 text-on-background">Menu Management</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage your restaurant menu items and availability.</p>
              </div>
              <button 
                onClick={() => setShowMenu(true)}
                className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95 w-full md:w-auto"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add New Item
              </button>
            </div>

            {/* Filters & Controls */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-gutter shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Category Tabs */}
                <div className="flex gap-2 border-b border-outline-variant pb-1 flex-1 min-w-[200px] overflow-x-auto hide-scrollbar">
                  {menuCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setMenuCategory(category)}
                      className={`font-label-md text-label-md px-4 py-2 border-b-2 whitespace-nowrap transition-colors ${
                        menuCategory === category
                          ? "border-primary text-primary"
                          : "border-transparent text-on-surface-variant hover:text-on-background"
                      }`}
                    >
                      {category === "all" ? "All" : category}
                    </button>
                  ))}
                </div>

                {/* Search and Status Filter */}
                <div className="flex gap-4 items-center w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                    <input
                      className="pl-9 pr-4 py-2 border border-outline-variant rounded-md font-body-sm text-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-surface-container-lowest w-full text-on-background"
                      placeholder="Search menu..."
                      type="text"
                      value={menuSearch}
                      onChange={(event) => setMenuSearch(event.target.value)}
                    />
                  </div>
                  <select
                    value={menuStatus}
                    onChange={(event) => setMenuStatus(event.target.value)}
                    className="border border-outline-variant rounded-md px-3 py-2 font-body-sm text-body-sm bg-surface-container-lowest text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none pr-8 relative shrink-0"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Menu Grid */}
            {menusLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
              </div>
            ) : filteredMenus.length === 0 ? (
              <div className="text-center py-12 text-secondary bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl">
                <span className="material-symbols-outlined text-4xl mb-4 opacity-50">restaurant_menu</span>
                <p>No menu items found. Use Add New Item to create one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter pb-8">
                {filteredMenus.map((item) => (
                  <div key={item.id} className={`bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col ${item.isAvailable === false ? 'opacity-75' : ''}`}>
                    <div className="h-48 bg-surface-variant relative overflow-hidden shrink-0">
                      {item.image || menuPlaceholderImage ? (
                        <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={item.name} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${item.isAvailable === false ? 'grayscale-[50%]' : ''}`} src={item.image || menuPlaceholderImage} />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 group-hover:scale-105 transition-transform duration-300">
                          <span className="material-symbols-outlined text-4xl">image</span>
                        </div>
                      )}
                      {item.category && (
                        <div className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-sm px-2 py-1 rounded font-label-sm text-label-sm text-on-background border border-outline-variant/50 capitalize shadow-sm">
                          {item.category}
                        </div>
                      )}
                      {item.isAvailable === false && (
                        <div className="absolute inset-0 bg-surface/20"></div>
                      )}
                    </div>
                    <div className="p-sm flex flex-col gap-3 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className={`font-h3 text-h3 leading-tight line-clamp-2 ${item.isAvailable === false ? 'text-outline' : 'text-on-background'}`}>{item.name}</h3>
                        <span className={`font-h3 text-h3 shrink-0 ${item.isAvailable === false ? 'text-outline' : 'text-primary'}`}>฿{item.price}</span>
                      </div>
                      {item.description && (
                        <p className="text-body-sm text-on-surface-variant line-clamp-2 mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-variant">
                        <button
                          type="button"
                          onClick={() => toggleMenuAvailability(item)}
                          className={`inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-1 rounded-full transition hover:scale-105 ${item.isAvailable !== false ? 'text-primary bg-primary-fixed' : 'text-outline bg-surface-variant'}`}
                          title={item.isAvailable !== false ? "Hide menu item" : "Show menu item"}
                        >
                          <span className={`w-2 h-2 rounded-full ${item.isAvailable !== false ? 'bg-primary' : 'bg-outline'}`}></span>
                          {item.isAvailable !== false ? 'Active' : 'Hidden'}
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditMenu(item)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMenu(item)}
                            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container rounded transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showUserModal && typeof document !== "undefined"
        ? createPortal(
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
                backgroundColor: "rgba(15, 23, 42, 0.5)",
                backdropFilter: "blur(4px)",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) resetUserForm();
              }}
            >
              <div
                className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-[0_8px_32px_rgba(45,62,97,0.12)] border border-outline-variant flex flex-col"
                style={{ maxHeight: "calc(100dvh - 2rem)", width: "100%", maxWidth: "32rem" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest shrink-0">
                  <h2 className="font-h3 text-h3 text-on-surface">
                    {editingUser ? "Edit Team Member" : "Add Team Member"}
                  </h2>
                  <button
                    onClick={resetUserForm}
                    className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-md hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Body — scrollable */}
                <div className="p-6 overflow-y-auto flex-1">
                  <form id="userForm" className="flex flex-col gap-6" onSubmit={handleUserSubmit}>
                    <div className="flex flex-col gap-2">
                      <label className="font-label-md text-label-md text-on-surface" htmlFor="username">Username</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">person</span>
                        <input
                          id="username"
                          type="text"
                          required
                          value={userForm.username}
                          onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                          disabled={!!editingUser && auth?.role !== "superadmin"}
                          className="w-full pl-10 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline/70 disabled:opacity-50 disabled:bg-surface-container-low"
                          placeholder="e.g. johndoe"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-label-md text-label-md text-on-surface" htmlFor="email">Email Address</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                        <input
                          id="email"
                          type="email"
                          required
                          value={userForm.email}
                          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          className="w-full pl-10 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline/70"
                          placeholder="john.doe@restaurant.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="font-label-md text-label-md text-on-surface" htmlFor="role">Role</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">work</span>
                          <select
                            id="role"
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                            className="w-full pl-10 pr-10 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors appearance-none cursor-pointer"
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                            <option value="kitchen">Kitchen</option>
                            <option value="user">Customer/User</option>
                            {auth?.role === "superadmin" && <option value="owner">Owner</option>}
                          </select>
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">expand_more</span>
                        </div>
                      </div>
                      {!editingUser && (
                        <div className="flex flex-col gap-2">
                          <label className="font-label-md text-label-md text-on-surface" htmlFor="password">Password</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                            <input
                              id="password"
                              type="password"
                              required
                              value={userForm.password}
                              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                              className="w-full pl-10 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-outline/70"
                              placeholder="Enter initial password"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={resetUserForm}
                    className="h-10 px-4 rounded-lg font-label-md text-label-md text-on-surface border border-outline-variant hover:bg-surface-container-low transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="userForm"
                    disabled={userSubmitting}
                    className="h-10 px-6 rounded-lg font-label-md text-label-md text-on-primary bg-primary hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center gap-2 disabled:opacity-60"
                  >
                    {userSubmitting ? (
                      <span>Saving...</span>
                    ) : editingUser ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        Save Changes
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        Add Member
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <MenuUpload
        isOpen={showMenu}
        onClose={resetMenuForm}
        menuData={menuData}
        setMenuData={setMenuData}
        handleSubmit={handleMenuSubmit}
        handleImageChange={handleImageChange}
        imagePreview={imagePreview}
        imageInputRef={menuImageInputRef}
        submitLoading={submitLoading}
        mode={editingMenu ? "edit" : "create"}
      />
    </div>
  );
}
