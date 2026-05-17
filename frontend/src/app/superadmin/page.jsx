"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { createApiClient } from "@/lib/api";
import { resolveRoleHome } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";

const statusStyles = {
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-rose-100 text-rose-700",
  inactive: "bg-slate-200 text-slate-700",
  archived: "bg-indigo-100 text-indigo-700",
  deleted: "bg-zinc-200 text-zinc-700",
};

function formatDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name, slug) {
  const source = String(name || slug || "RT").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { auth, ready, signOut, saveAuth } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [restaurants, setRestaurants] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    active: 0,
    suspended: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionId, setActionId] = useState(null);

  const loadRestaurants = useCallback(async (page = pagination.page) => {
    if (!auth?.token || auth?.role !== "superadmin") return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize),
      });
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await api.get(`/superadmin/restaurants?${params.toString()}`);
      setRestaurants(response.data.items || []);
      setCounts((current) => ({ ...current, ...(response.data.counts || {}) }));
      setPagination((current) => response.data.pagination || current);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load restaurants failed",
        text: error.normalizedMessage || "Unable to fetch restaurants",
      });
    } finally {
      setLoading(false);
    }
  }, [
    api,
    auth?.role,
    auth?.token,
    pagination.page,
    pagination.pageSize,
    query,
    statusFilter,
  ]);

  useEffect(() => {
    if (!ready) return;

    if (!auth?.token) {
      router.replace("/signin");
      return;
    }

    if (auth.role !== "superadmin") {
      router.replace(resolveRoleHome(auth));
      return;
    }

    loadRestaurants(1);
  }, [auth, loadRestaurants, ready, router]);

  const pendingRestaurants = useMemo(
    () =>
      restaurants.filter(
        (restaurant) => String(restaurant.status || "") === "pending",
      ),
    [restaurants],
  );

  const updateRestaurantStatus = async (restaurant, action) => {
    const needsReason = ["reject", "suspend", "archive", "delete"].includes(action);
    let reason = null;

    if (needsReason) {
      const reasonResult = await Swal.fire({
        icon: "question",
        title: `${action[0].toUpperCase()}${action.slice(1)} reason`,
        input: "textarea",
        inputPlaceholder: "Add the internal reason for this action",
        showCancelButton: true,
        confirmButtonText: "Continue",
        inputValidator: (value) => {
          if (!value || !value.trim()) return "Reason is required";
          return null;
        },
      });
      if (!reasonResult.isConfirmed) return;
      reason = reasonResult.value.trim();
    }

    setActionId(`${action}:${restaurant.id}`);
    try {
      await api.post(`/superadmin/restaurants/${restaurant.id}/${action}`, {
        reason,
      });

      Swal.fire({
        icon: "success",
        title: "Restaurant updated",
        timer: 1100,
        showConfirmButton: false,
      });
      await loadRestaurants(pagination.page);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Update failed",
        text: error.normalizedMessage || "Unable to update restaurant",
      });
    } finally {
      setActionId(null);
    }
  };

  const openRestaurantDashboard = async (restaurant) => {
    const reasonResult = await Swal.fire({
      icon: "question",
      title: "Open restaurant dashboard",
      input: "textarea",
      inputPlaceholder: "Example: investigating owner support ticket",
      showCancelButton: true,
      confirmButtonText: "Open dashboard",
      inputValidator: (value) => {
        if (!value || !value.trim()) return "Reason is required";
        return null;
      },
    });

    if (!reasonResult.isConfirmed) return;

    setActionId(`open:${restaurant.id}`);
    try {
      const response = await api.post(
        `/superadmin/restaurants/${restaurant.id}/impersonate`,
        { reason: reasonResult.value.trim() },
      );
      const session = await saveAuth(
        {
          ...auth,
          token: response.data.token,
          refreshToken: response.data.refreshToken,
          role: response.data.role || "superadmin",
          impersonating: true,
          impersonationReason: reasonResult.value.trim(),
          restaurant: response.data.restaurant,
          restaurantId: response.data.restaurant?.id,
          restaurantSlug: response.data.restaurant?.slug,
          restaurantName: response.data.restaurant?.name,
          restaurantStatus: response.data.restaurant?.status,
          redirectPath: response.data.redirectpath,
        },
        { hydrate: true },
      );

      router.push(
        response.data.redirectpath ||
          `/app/${session?.restaurantSlug || restaurant.slug}/admin`,
      );
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Open dashboard failed",
        text: error.normalizedMessage || "Unable to open restaurant dashboard",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.push("/signin");
  };

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-on-surface">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          Loading superadmin dashboard...
        </div>
      </main>
    );
  }

  if (auth?.role !== "superadmin") return null;

  return (
    <div className="min-h-screen bg-background text-on-background">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col gap-4 border-r border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-6 px-4">
          <h1 className="text-lg font-black tracking-tight text-[#2D3E61]">
            Admin Central
          </h1>
          <p className="text-xs font-medium text-slate-500">
            SaaS Superadmin
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <button
            type="button"
            className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 font-semibold text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">verified</span>
            <span className="text-sm">Restaurants</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/superadmin/new")}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">add_business</span>
            <span className="text-sm">Add Restaurant</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/superadmin/subscriptions")}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">credit_card</span>
            <span className="text-sm">Subscriptions</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/superadmin/audit")}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">fact_check</span>
            <span className="text-sm">Audit Log</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/superadmin/health")}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">monitor_heart</span>
            <span className="text-sm">System Health</span>
          </button>
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
            {String(auth?.username || "SA").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-bold text-primary">
              {auth?.username || "Admin User"}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-semibold text-slate-400 hover:text-primary"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 w-full flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white/85 px-8 py-3 backdrop-blur-md">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1 sm:max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                search
              </span>
              <input
                className="h-10 w-full rounded-lg border border-transparent bg-surface-container-low py-2 pl-10 pr-4 text-sm text-slate-700 focus:border-primary focus:outline-none"
                placeholder="Search name, slug, or owner email"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadRestaurants(1);
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
              <option value="deleted">Deleted</option>
            </select>
            <button
              type="button"
              onClick={() => loadRestaurants(1)}
              className="h-10 rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary-container"
            >
              Apply
            </button>
          </div>
          <button
            type="button"
            onClick={() => loadRestaurants(pagination.page)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary"
            title="Refresh"
            aria-label="Refresh restaurants"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </header>

        <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-h1 text-h1 text-primary">Restaurants</h2>
              <p className="font-body-md text-slate-500">
                Manage tenant approvals, lifecycle, subscriptions, and support access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/superadmin/new")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-container"
            >
              Add Restaurant
            </button>
          </div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-4">
            {[
              ["Pending", counts.pending, "priority_high", "bg-amber-50 text-amber-700"],
              ["Active", counts.active, "storefront", "bg-emerald-50 text-emerald-700"],
              ["Suspended", counts.suspended, "gpp_bad", "bg-rose-50 text-rose-700"],
              ["Total", counts.total, "database", "bg-slate-50 text-slate-700"],
            ].map(([label, value, icon, tone]) => (
              <div
                key={label}
                className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                  <h3 className="mt-2 text-3xl font-black text-primary">
                    {value}
                  </h3>
                </div>
                <div className={`rounded-lg p-2 ${tone}`}>
                  <span className="material-symbols-outlined">{icon}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="font-h3 text-primary">Pending Requests</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {pendingRestaurants.length} visible pending requests
                </p>
              </div>
            </div>
            <RestaurantTable
              restaurants={pendingRestaurants}
              actionId={actionId}
              onDetails={(restaurant) =>
                router.push(`/superadmin/restaurants/${restaurant.id}`)
              }
              onOpen={openRestaurantDashboard}
              onStatus={updateRestaurantStatus}
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="font-h3 text-primary">All Restaurants</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}, {pagination.total} total
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => loadRestaurants(pagination.page - 1)}
                  className="rounded-lg border border-slate-200 p-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_left
                  </span>
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadRestaurants(pagination.page + 1)}
                  className="rounded-lg border border-slate-200 p-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>
            <RestaurantTable
              restaurants={restaurants}
              actionId={actionId}
              onDetails={(restaurant) =>
                router.push(`/superadmin/restaurants/${restaurant.id}`)
              }
              onOpen={openRestaurantDashboard}
              onStatus={updateRestaurantStatus}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function RestaurantTable({ restaurants, actionId, onDetails, onOpen, onStatus }) {
  if (!restaurants.length) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500">
        No restaurants found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-50/80">
            <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
              Restaurant
            </th>
            <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
              Owner
            </th>
            <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
              Subscription
            </th>
            <th className="border-b border-slate-100 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered
            </th>
            <th className="border-b border-slate-100 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {restaurants.map((restaurant) => {
            const status = String(restaurant.status || "inactive");
            const badgeClass = statusStyles[status] || statusStyles.inactive;
            const busy = !!actionId;

            return (
              <tr key={restaurant.id} className="hover:bg-slate-50/60">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-primary">
                      {getInitials(restaurant.name, restaurant.slug)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-primary">
                        {restaurant.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs text-slate-500">
                          /{restaurant.slug}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${badgeClass}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <p>{restaurant.owner_username || "-"}</p>
                  <p className="text-xs text-slate-400">
                    {restaurant.owner_email || "No owner email"}
                  </p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <p className="font-semibold">
                    {restaurant.subscription_plan_code || "starter"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {restaurant.subscription_status || "active"}
                  </p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {formatDate(restaurant.created_at)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDetails(restaurant)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Details
                    </button>
                    {status !== "active" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onStatus(restaurant, "approve")}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-60"
                      >
                        Activate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onStatus(restaurant, "suspend")}
                        className="rounded-lg bg-error px-3 py-2 text-xs font-bold text-white hover:bg-error/90 disabled:opacity-60"
                      >
                        Suspend
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onOpen(restaurant)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {actionId === `open:${restaurant.id}` ? "Opening..." : "Open"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
