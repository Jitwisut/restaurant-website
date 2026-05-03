"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuperadminRestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { auth, ready, saveAuth } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(null);

  const restaurantId = params?.id;

  const load = async () => {
    if (!auth?.token || auth?.role !== "superadmin" || !restaurantId) return;
    setLoading(true);
    try {
      const response = await api.get(`/superadmin/restaurants/${restaurantId}`);
      setPayload(response.data);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load restaurant failed",
        text: error.normalizedMessage || "Unable to load restaurant detail",
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
    load();
  }, [auth, ready, router, restaurantId]);

  const runStatusAction = async (action) => {
    const requiresReason = ["reject", "suspend", "archive", "delete"].includes(action);
    let reason = null;
    if (requiresReason) {
      const result = await Swal.fire({
        icon: "question",
        title: `${action[0].toUpperCase()}${action.slice(1)} reason`,
        input: "textarea",
        inputPlaceholder: "Add an internal reason",
        showCancelButton: true,
        confirmButtonText: "Continue",
        inputValidator: (value) => {
          if (!value || !value.trim()) return "Reason is required";
          return null;
        },
      });
      if (!result.isConfirmed) return;
      reason = result.value.trim();
    }

    setBusyAction(action);
    try {
      await api.post(`/superadmin/restaurants/${restaurantId}/${action}`, {
        reason,
      });
      await load();
      Swal.fire({
        icon: "success",
        title: "Restaurant updated",
        timer: 1000,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Action failed",
        text: error.normalizedMessage || "Unable to update restaurant",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const impersonate = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Open restaurant dashboard",
      input: "textarea",
      inputPlaceholder: "Reason is required for audit",
      showCancelButton: true,
      confirmButtonText: "Open dashboard",
      inputValidator: (value) => {
        if (!value || !value.trim()) return "Reason is required";
        return null;
      },
    });
    if (!result.isConfirmed) return;

    setBusyAction("impersonate");
    try {
      const response = await api.post(
        `/superadmin/restaurants/${restaurantId}/impersonate`,
        { reason: result.value.trim() },
      );
      const session = await saveAuth(
        {
          ...auth,
          token: response.data.token,
          refreshToken: response.data.refreshToken,
          role: response.data.role || "superadmin",
          impersonating: true,
          impersonationReason: result.value.trim(),
          restaurant: response.data.restaurant,
          restaurantId: response.data.restaurant?.id,
          restaurantSlug: response.data.restaurant?.slug,
          restaurantName: response.data.restaurant?.name,
          restaurantStatus: response.data.restaurant?.status,
        },
        { hydrate: true },
      );
      router.push(
        response.data.redirectpath ||
          `/app/${session?.restaurantSlug || payload?.restaurant?.slug}/admin`,
      );
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Open dashboard failed",
        text: error.normalizedMessage || "Unable to impersonate restaurant",
      });
    } finally {
      setBusyAction(null);
    }
  };

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        Loading restaurant detail...
      </main>
    );
  }

  if (!payload?.restaurant) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        Restaurant not found.
      </main>
    );
  }

  const restaurant = payload.restaurant;
  const status = String(restaurant.status || "inactive");
  const badgeClass = statusStyles[status] || statusStyles.inactive;
  const stats = [
    ["Users", payload.counts?.users || 0],
    ["Tables", payload.counts?.tables || 0],
    ["Menu Items", payload.counts?.menu_items || 0],
    ["Orders", payload.counts?.orders || 0],
    ["Orders Today", payload.counts?.orders_today || 0],
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/superadmin")}
              className="mb-4 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              Back to restaurants
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black text-slate-950">
                {restaurant.name}
              </h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${badgeClass}`}>
                {status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">/{restaurant.slug}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={impersonate}
              disabled={!!busyAction}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {busyAction === "impersonate" ? "Opening..." : "Open Dashboard"}
            </button>
            {status !== "active" ? (
              <button
                type="button"
                onClick={() => runStatusAction("approve")}
                disabled={!!busyAction}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                Activate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runStatusAction("suspend")}
                disabled={!!busyAction}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                Suspend
              </button>
            )}
            <button
              type="button"
              onClick={() => runStatusAction("archive")}
              disabled={!!busyAction}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
            >
              Archive
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-950">Users</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {payload.users?.length ? (
                payload.users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">{user.username}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">
                      {user.role}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500">
                  No users found for this restaurant.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-950">Subscription</h2>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <Info label="Plan" value={restaurant.subscription_plan_code || "starter"} />
              <Info label="Status" value={restaurant.subscription_status || "active"} />
              <Info label="Period End" value={formatDate(restaurant.current_period_end)} />
              <Info label="Renewal Request" value={formatDate(restaurant.renewal_requested_at)} />
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-950">Recent Audit</h2>
            <button
              type="button"
              onClick={() => router.push(`/superadmin/audit?restaurant_id=${restaurant.id}`)}
              className="text-sm font-bold text-primary"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {payload.recentAudit?.length ? (
              payload.recentAudit.map((entry) => (
                <div key={entry.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[1fr_1fr_auto]">
                  <p className="font-semibold text-slate-900">{entry.action}</p>
                  <p className="text-slate-500">{entry.reason || "No reason"}</p>
                  <p className="text-slate-400">{formatDate(entry.created_at)}</p>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-slate-500">
                No audit entries yet.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="text-right font-bold text-slate-900">{value || "-"}</span>
    </div>
  );
}
