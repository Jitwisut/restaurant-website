"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { createApiClient } from "@/lib/api";
import { resolveRoleHome } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusClass = {
  trial: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  past_due: "bg-amber-100 text-amber-700",
  grace: "bg-orange-100 text-orange-700",
  suspended: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-700",
};

export default function SuperadminSubscriptionsPage() {
  const router = useRouter();
  const { auth, ready } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (!auth?.token || auth?.role !== "superadmin") return;
    setLoading(true);
    try {
      const response = await api.get("/restaurant/all");
      setRestaurants(response.data.restaurants || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load failed",
        text: error.normalizedMessage || "Unable to load subscriptions",
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
  }, [auth, ready, router]);

  const runAction = async (restaurantId, action, body = {}) => {
    setBusyId(`${action}:${restaurantId}`);
    try {
      await api.post(`/restaurant/${restaurantId}${action}`, body);
      await load();
      Swal.fire({
        icon: "success",
        title: "Subscription updated",
        timer: 1000,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Update failed",
        text: error.normalizedMessage || "Unable to update subscription",
      });
    } finally {
      setBusyId(null);
    }
  };

  const runCycle = async () => {
    setBusyId("cycle");
    try {
      await api.post("/restaurant/subscription/run-cycle");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        Loading subscriptions...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Superadmin
            </p>
            <h1 className="mt-2 text-3xl font-bold">Subscription management</h1>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/superadmin")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              type="button"
              onClick={runCycle}
              disabled={busyId === "cycle"}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busyId === "cycle" ? "Running..." : "Run expiry cycle"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Restaurant
                </th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Subscription
                </th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Period End
                </th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Renewal Request
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {restaurants.map((restaurant) => {
                const status = String(restaurant.subscription_status || "active");
                const renewBusy = busyId === `renew:${restaurant.id}`;
                return (
                  <tr key={restaurant.id}>
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-slate-900">{restaurant.name}</p>
                      <p className="text-sm text-slate-500">/{restaurant.slug}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass[status] || statusClass.suspended}`}>
                          {status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <p className="text-sm text-slate-500">
                          Plan: {restaurant.subscription_plan_code || "starter"}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-600">
                      <p>{formatDate(restaurant.current_period_end)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Grace: {formatDate(restaurant.grace_ends_at)}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-600">
                      {restaurant.renewal_requested_at ? (
                        <>
                          <p>{formatDate(restaurant.renewal_requested_at)}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {restaurant.renewal_request_note || "No note"}
                          </p>
                        </>
                      ) : (
                        "No request"
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            runAction(
                              restaurant.id,
                              "/subscription/renew",
                              { months: 1, note: "Manual one-month renewal" },
                            )
                          }
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {renewBusy ? "Renewing..." : "Renew 1 month"}
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            runAction(
                              restaurant.id,
                              "/subscription/status",
                              { status: "grace", note: "Moved to grace manually" },
                            )
                          }
                          className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 disabled:opacity-60"
                        >
                          Grace
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            runAction(
                              restaurant.id,
                              "/subscription/status",
                              { status: "suspended", note: "Suspended manually" },
                            )
                          }
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                        >
                          Suspend
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            runAction(
                              restaurant.id,
                              "/subscription/status",
                              { status: "active", note: "Reactivated manually" },
                            )
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          Activate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
