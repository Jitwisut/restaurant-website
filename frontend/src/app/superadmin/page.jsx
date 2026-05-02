"use client";

import { useEffect, useMemo, useState } from "react";
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
  deleted: "bg-zinc-200 text-zinc-700",
};

function formatStatus(status) {
  return String(status || "inactive").toUpperCase();
}

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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [actionId, setActionId] = useState(null);

  const loadRestaurants = async () => {
    if (!auth?.token || auth?.role !== "superadmin") return;

    setLoading(true);
    try {
      const response = await api.get("/restaurant/all");
      setRestaurants(response.data.restaurants || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load restaurants failed",
        text: error.normalizedMessage || "Unable to fetch restaurants",
      });
    } finally {
      setLoading(false);
    }
  };

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

    loadRestaurants();
  }, [auth, ready, router]);

  const counts = useMemo(
    () =>
      restaurants.reduce(
        (accumulator, restaurant) => {
          const status = String(restaurant.status || "inactive");
          accumulator.total += 1;
          accumulator.pending += status === "pending" ? 1 : 0;
          accumulator.active += status === "active" ? 1 : 0;
          accumulator.suspended += status === "suspended" ? 1 : 0;
          return accumulator;
        },
        { total: 0, pending: 0, active: 0, suspended: 0 },
      ),
    [restaurants],
  );

  const filteredRestaurants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return restaurants;

    return restaurants.filter((restaurant) =>
      [restaurant.name, restaurant.slug, restaurant.id, restaurant.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query, restaurants]);

  const pendingRestaurants = useMemo(
    () =>
      filteredRestaurants.filter(
        (restaurant) => String(restaurant.status || "") === "pending",
      ),
    [filteredRestaurants],
  );

  const updateRestaurantStatus = async (restaurant, action) => {
    setActionId(`${action}:${restaurant.id}`);
    try {
      await api.post(`/restaurant/${restaurant.id}/${action}`);
      const successTitle =
        action === "approve"
          ? "Restaurant approved"
          : action === "suspend"
            ? "Restaurant suspended"
            : "Restaurant rejected";

      Swal.fire({
        icon: "success",
        title: successTitle,
        timer: 1200,
        showConfirmButton: false,
      });
      await loadRestaurants();
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
    setActionId(`open:${restaurant.id}`);
    try {
      const response = await api.post(`/restaurant/${restaurant.id}/impersonate`);
      const session = await saveAuth(
        {
          ...auth,
          token: response.data.token,
          refreshToken: response.data.refreshToken,
          role: response.data.role || "superadmin",
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
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          Loading superadmin dashboard...
        </div>
      </main>
    );
  }

  if (auth?.role !== "superadmin") {
    return null;
  }

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
            className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 font-semibold text-[#2D3E61] transition-all duration-150"
          >
            <span className="material-symbols-outlined">verified</span>
            <span className="text-sm antialiased">Restaurant Approvals</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/superadmin/new")}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 transition-all duration-150 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">add_business</span>
            <span className="text-sm antialiased">Add Restaurant</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/superadmin/subscriptions")}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 transition-all duration-150 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">credit_card</span>
            <span className="text-sm antialiased">Subscriptions</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 text-slate-500 transition-all duration-150 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">monitor_heart</span>
            <span className="text-sm antialiased">System Health</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 text-slate-500 transition-all duration-150 hover:bg-slate-50 hover:text-[#2D3E61]"
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm antialiased">Settings</span>
          </button>
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold text-slate-700 shadow-sm">
            {String(auth?.username || "SA").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-bold text-primary">
              {auth?.username || "Admin User"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {auth?.email || "superadmin@system.com"}
            </p>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white/80 px-8 backdrop-blur-md">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                search
              </span>
              <input
                className="w-full rounded-lg border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary-container"
                placeholder="Search tenants or requests..."
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={loadRestaurants}
                className="text-slate-500 transition-colors hover:text-primary"
                title="Refresh"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-slate-500 transition-colors hover:text-primary"
                title="Sign out"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">
                Superadmin Dashboard
              </span>
            </div>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-8">
          <div className="flex flex-col gap-1">
            <h2 className="font-h1 text-h1 text-primary">
              Restaurant Approvals
            </h2>
            <p className="font-body-md text-slate-500">
              Manage and verify new tenant registration requests.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
            <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_24px_-10px_rgba(22,40,74,0.04)]">
              <div>
                <p className="mb-1 font-label-md text-slate-500">
                  Pending Approvals
                </p>
                <h3 className="text-3xl font-black text-primary">
                  {counts.pending}
                </h3>
                <div className="mt-4 flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600">
                  <span className="material-symbols-outlined text-sm">
                    priority_high
                  </span>
                  Requires Action
                </div>
              </div>
              <div className="rounded-lg bg-primary-container/10 p-3">
                <span className="material-symbols-outlined text-primary-container">
                  verified
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_24px_-10px_rgba(22,40,74,0.04)]">
              <div>
                <p className="mb-1 font-label-md text-slate-500">
                  Total Tenants
                </p>
                <h3 className="text-3xl font-black text-primary">
                  {counts.total}
                </h3>
                <div className="mt-4 flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                  <span className="material-symbols-outlined text-sm">
                    storefront
                  </span>
                  Platform-wide
                </div>
              </div>
              <div className="rounded-lg bg-secondary-container/20 p-3">
                <span className="material-symbols-outlined text-secondary">
                  storefront
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_24px_-10px_rgba(22,40,74,0.04)]">
              <div>
                <p className="mb-1 font-label-md text-slate-500">
                  Suspended Tenants
                </p>
                <h3 className="text-3xl font-black text-primary">
                  {counts.suspended}
                </h3>
                <div className="mt-4 flex w-fit items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                  <span className="material-symbols-outlined text-sm">
                    gpp_bad
                  </span>
                  Needs review
                </div>
              </div>
              <div className="rounded-lg bg-tertiary-fixed/20 p-3">
                <span className="material-symbols-outlined text-tertiary">
                  policy_alert
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_24px_-10px_rgba(22,40,74,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="font-h3 text-primary">Pending Requests</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {pendingRestaurants.length} of {counts.pending} pending
                  requests
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/superadmin/new")}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-primary-container"
                >
                  <span className="material-symbols-outlined text-sm">
                    add
                  </span>
                  Add Restaurant
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-sm">
                    filter_list
                  </span>
                  Filter
                </button>
                <button
                  type="button"
                  onClick={loadRestaurants}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-sm">
                    refresh
                  </span>
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="border-b border-slate-100 px-6 py-4 font-label-md text-slate-500">
                      Restaurant Name
                    </th>
                    <th className="border-b border-slate-100 px-6 py-4 font-label-md text-slate-500">
                      Slug
                    </th>
                    <th className="border-b border-slate-100 px-6 py-4 font-label-md text-slate-500">
                      Registered Date
                    </th>
                    <th className="border-b border-slate-100 px-6 py-4 font-label-md text-slate-500">
                      Status
                    </th>
                    <th className="border-b border-slate-100 px-6 py-4 text-right font-label-md text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingRestaurants.length > 0 ? (
                    pendingRestaurants.map((restaurant) => {
                      const approveId = `approve:${restaurant.id}`;
                      const rejectId = `reject:${restaurant.id}`;
                      const busy = !!actionId;

                      return (
                        <tr
                          key={restaurant.id}
                          className="transition-colors hover:bg-slate-50/50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-container text-xs font-bold text-white">
                                {getInitials(restaurant.name, restaurant.slug)}
                              </div>
                              <span className="font-semibold text-primary">
                                {restaurant.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            /{restaurant.slug}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {formatDate(restaurant.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                              {formatStatus(restaurant.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  updateRestaurantStatus(restaurant, "approve")
                                }
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
                              >
                                {actionId === approveId ? "Approving..." : "Approve"}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  updateRestaurantStatus(restaurant, "reject")
                                }
                                className="rounded-lg border border-error/20 px-3 py-1.5 text-xs font-bold text-error transition-all hover:bg-error/5 disabled:opacity-60"
                              >
                                {actionId === rejectId ? "Rejecting..." : "Reject"}
                              </button>
                              <button
                                type="button"
                                onClick={() => openRestaurantDashboard(restaurant)}
                                disabled={busy}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60"
                              >
                                {actionId === `open:${restaurant.id}`
                                  ? "Opening..."
                                  : "Open Dashboard"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-10 text-center text-sm text-slate-500"
                      >
                        No pending restaurant requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
              <span>
                Showing {pendingRestaurants.length} of {counts.pending} pending
                requests
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 p-2 opacity-50"
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_left
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 p-2 opacity-50"
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
            <div className="group relative overflow-hidden rounded-xl bg-slate-900 p-8">
              <div className="relative z-10 flex h-full flex-col">
                <h4 className="mb-4 font-h2 text-white">
                  System Growth Analytics
                </h4>
                <p className="mb-6 max-w-sm text-sm text-slate-400">
                  Tenant growth is steady and approval load is concentrated in
                  new restaurant onboarding. Use this view to keep the platform
                  healthy without mixing in user-level administration.
                </p>
                <button
                  type="button"
                  className="w-fit rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-all hover:bg-slate-100"
                >
                  View Platform Summary
                </button>
              </div>
              <div className="absolute -bottom-10 -right-10 opacity-20 transition-transform duration-500 group-hover:scale-110">
                <span className="material-symbols-outlined text-[200px] text-white">
                  analytics
                </span>
              </div>
            </div>

            <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-500">
                  verified_user
                </span>
                <h4 className="font-h3 text-primary">Approval Snapshot</h4>
              </div>
              <p className="text-sm text-slate-500">
                {counts.pending > 0
                  ? `${counts.pending} restaurants are waiting for manual approval right now.`
                  : "There are no restaurants waiting for manual approval right now."}
              </p>
              <div className="mt-auto flex -space-x-2">
                {restaurants.slice(0, 4).map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-300 text-[10px] font-bold"
                    title={restaurant.name}
                  >
                    {getInitials(restaurant.name, restaurant.slug)}
                  </div>
                ))}
                {restaurants.length > 4 ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-white">
                    +{restaurants.length - 4}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_24px_-10px_rgba(22,40,74,0.04)]">
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="font-h3 text-primary">All Restaurants</h3>
              <p className="mt-1 text-sm text-slate-500">
                Full tenant list after search filtering.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredRestaurants.length > 0 ? (
                filteredRestaurants.map((restaurant) => {
                  const status = String(restaurant.status || "inactive");
                  const badgeClass =
                    statusStyles[status] || statusStyles.inactive;

                  return (
                    <article
                      key={`directory-${restaurant.id}`}
                      className="grid gap-4 px-6 py-5 lg:grid-cols-[1.2fr_0.8fr_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-primary">
                            {getInitials(restaurant.name, restaurant.slug)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-primary">
                              {restaurant.name}
                            </p>
                            <p className="truncate text-sm text-slate-500">
                              /{restaurant.slug}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Status
                          </p>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass}`}
                          >
                            {formatStatus(status)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Registered
                          </p>
                          <p className="mt-1">{formatDate(restaurant.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {status !== "active" ? (
                          <button
                            type="button"
                            disabled={!!actionId}
                            onClick={() =>
                              updateRestaurantStatus(restaurant, "approve")
                            }
                            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!!actionId}
                            onClick={() =>
                              updateRestaurantStatus(restaurant, "suspend")
                            }
                            className="rounded-lg bg-error px-3 py-2 text-xs font-bold text-white transition hover:bg-error/90 disabled:opacity-60"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!!actionId}
                          onClick={() => openRestaurantDashboard(restaurant)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          {actionId === `open:${restaurant.id}`
                            ? "Opening..."
                            : "Open Dashboard"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  No restaurants matched your search.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
