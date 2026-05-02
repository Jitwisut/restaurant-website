"use client";

import Link from "next/link";
import Swal from "sweetalert2";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MenuUpload from "../components/menupload";
import { buildRestaurantPath } from "@/lib/auth";
import { buildWsUrl, createApiClient } from "@/lib/api";
import { useAuth } from "../components/AuthProvider";
import { useRestaurantAccess } from "../components/useRestaurantAccess";

export default function RestaurantDashboard() {
  const { signOut } = useAuth();
  const { auth, ready, allowed } = useRestaurantAccess([
    "owner",
    "admin",
    "superadmin",
  ]);
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);

  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [tables, setTables] = useState([]);
  const [users, setUsers] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingRestaurants, setPendingRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [restaurantActionId, setRestaurantActionId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
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

  const reservedTables = tables.filter((item) => item.status === "open").length;

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

  const loadUsers = async () => {
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
  };

  const loadPendingRestaurants = async () => {
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
  };

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
  }, [allowed, auth?.token, auth?.username, ready]);

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
  }, [allowed, api, auth?.token, ready]);

  useEffect(() => {
    if (!ready || !allowed || auth?.role !== "superadmin" || !auth?.token) {
      return;
    }
    loadPendingRestaurants();
  }, [allowed, api, auth?.role, auth?.token, ready]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const resetMenuForm = () => {
    setShowMenu(false);
    setMenuData({
      name: "",
      price: "",
      description: "",
      category: "",
      ingredients: "",
      isAvailable: true,
    });
    setImagePreview(null);
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

      const imageInput = document.querySelector('input[type="file"]');
      if (imageInput?.files?.[0]) {
        formData.append("image", imageInput.files[0]);
      }

      await api.post("/admin/upload-menu", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      Swal.fire({
        icon: "success",
        title: "อัปโหลดเมนูสำเร็จ",
        timer: 1800,
        showConfirmButton: false,
      });
      resetMenuForm();
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

  return (
    <div className="bg-background text-on-surface min-h-screen font-sans">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 md:flex flex-col py-6 px-4 gap-2 z-50 transition-all duration-200 ease-in-out">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center overflow-hidden font-bold text-on-primary text-xl">
              {auth?.restaurantSlug?.charAt(0).toUpperCase() || "R"}
            </div>
            <div>
              <h1 className="text-lg font-black text-indigo-900 dark:text-white leading-tight">
                RestoAdmin
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Management Suite
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <Link
            href={buildRestaurantPath(auth, "admin")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300 border-r-4 border-indigo-900 dark:border-indigo-400 font-semibold transition-all"
          >
            <span className="material-symbols-outlined">badge</span>
            <span className="font-sans text-sm">Staff Management</span>
          </Link>
          <Link
            href={buildRestaurantPath(auth, "orders")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            <span className="material-symbols-outlined">restaurant_menu</span>
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
            href={buildRestaurantPath(auth, "profile")}
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

        {/* Analytics Bento Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-lg">
          <div className="bg-surface-container-lowest border border-slate-100 p-md rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-base">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <span className="material-symbols-outlined">group</span>
              </div>
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-label-sm font-bold">
                +2 New
              </span>
            </div>
            <p className="text-label-md text-secondary uppercase tracking-wider">
              Total Staff
            </p>
            <p className="text-h1 font-display text-primary mt-xs">
              {userCount}
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-slate-100 p-md rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-base">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <span className="text-slate-400 text-label-sm">
                Current Roster
              </span>
            </div>
            <p className="text-label-md text-secondary uppercase tracking-wider">
              Active Today
            </p>
            <p className="text-h1 font-display text-primary mt-xs">
              {Math.round(userCount * 0.75)}
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-slate-100 p-md rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-base">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <span className="material-symbols-outlined">
                  pending_actions
                </span>
              </div>
              <span className="text-error font-bold text-label-sm">Urgent</span>
            </div>
            <p className="text-label-md text-secondary uppercase tracking-wider">
              Open Shifts
            </p>
            <p className="text-h1 font-display text-primary mt-xs">
              {reservedTables}
            </p>
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
                {users.map((user, idx) => (
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
                            idx === 0
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-slate-400"
                          }`}
                        ></div>
                        <span
                          className={`font-medium text-body-sm px-2 py-0.5 rounded ${
                            idx === 0
                              ? "text-emerald-700 bg-emerald-50"
                              : "text-slate-600 bg-slate-50"
                          }`}
                        >
                          {idx === 0 ? "Active" : "Offline"}
                        </span>
                      </div>
                    </td>
                    <td className="px-md py-md font-body-sm text-secondary">
                      {idx === 0 ? "Now" : "2h ago"}
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
                {users.length === 0 && !usersLoading && (
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
              Showing {users.length} of {userCount} members
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

        {/* Productivity Insights Card */}
        <div className="mt-lg grid grid-cols-1 md:grid-cols-12 gap-gutter">
          <div className="md:col-span-8 bg-primary-container text-on-primary-container p-lg rounded-xl flex items-center justify-between overflow-hidden relative group">
            <div className="z-10 relative">
              <h3 className="font-h2 text-h2 mb-base">
                Weekly Roster Complete
              </h3>
              <p className="text-body-md opacity-80 max-w-md mb-md">
                All staff shifts have been assigned for the upcoming week.
                Review and publish to notify the team.
              </p>
              <button className="bg-tertiary-fixed text-on-tertiary-fixed px-md py-base rounded-lg font-label-md active:scale-95 transition-all">
                Publish Roster
              </button>
            </div>
            <div className="absolute right-0 top-0 h-full w-1/3 opacity-20 group-hover:opacity-30 transition-opacity">
              <img
                className="object-cover w-full h-full grayscale"
                alt="Abstract background"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdlSfmhY_-ndsdxW6GysEmfb0PF-tmZIRjEdjB5eSSbTwmpHqhUkqYvCBpIwC8xXfk7pBWKk_YrUOvCsulEwSMPSRYaj4eUVWlMN4weHDJj6qKA_tIjBGnUbaM-NnpXjfDamqw1XwvkfpvmxiVmXK6B_1pgsh0jy66a9VLyUKd5QbC9swczelkylFCC-t-CwXzuE0I2R0yYSpJM88a0y4kRYLA5gIUbnRAu-ONtYEy__9JYDGT0Lv4BlegRn-e28IYrJ10EoYkjA_8"
              />
            </div>
          </div>
          <div className="md:col-span-4 bg-white border border-slate-100 p-md rounded-xl flex flex-col justify-center">
            <div className="flex items-center gap-base mb-sm">
              <span
                className="material-symbols-outlined text-amber-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
              <p className="font-label-md text-primary uppercase">
                Top Performer
              </p>
            </div>
            <div className="flex items-center gap-md">
              <div className="w-14 h-14 rounded-full border-2 border-amber-100 bg-primary-fixed flex justify-center items-center text-primary-container font-h2 font-bold">
                {users[0]?.username?.charAt(0).toUpperCase() || "T"}
              </div>
              <div>
                <p className="font-h3 text-h3 text-primary">
                  {users[0]?.username || "System Admin"}
                </p>
                <p className="text-body-sm text-secondary">
                  98% Service Efficiency
                </p>
              </div>
            </div>
          </div>
        </div>
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
        submitLoading={submitLoading}
      />
    </div>
  );
}
