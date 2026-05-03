"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { createApiClient } from "@/lib/api";
import { resolveRoleHome } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";

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

function statusTone(status) {
  if (status === "ok") return "bg-emerald-100 text-emerald-700";
  if (status === "available") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

export default function SuperadminHealthPage() {
  const router = useRouter();
  const { auth, ready } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!auth?.token || auth?.role !== "superadmin") return;
    setLoading(true);
    try {
      const [healthResponse, statsResponse] = await Promise.all([
        api.get("/superadmin/system-health"),
        api.get("/superadmin/stats"),
      ]);
      setHealth(healthResponse.data);
      setStats(statsResponse.data.stats || {});
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load system health failed",
        text: error.normalizedMessage || "Unable to load system health",
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

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        Loading system health...
      </main>
    );
  }

  const checks = health?.checks || {};
  const statCards = [
    ["Total Tenants", stats?.total_tenants || 0, "database"],
    ["Active Tenants", stats?.active_tenants || 0, "storefront"],
    ["Pending Tenants", stats?.pending_tenants || 0, "pending_actions"],
    ["Suspended Tenants", stats?.suspended_tenants || 0, "gpp_bad"],
    ["Renewal Requests", stats?.renewal_requests || 0, "credit_card_clock"],
    ["Blocked Subscriptions", stats?.blocked_subscriptions || 0, "lock"],
    ["Orders Today", stats?.orders_today || 0, "receipt_long"],
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
              Back to superadmin
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black text-slate-950">
                System Health
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusTone(
                  health?.status,
                )}`}
              >
                {health?.status || "unknown"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Last checked {formatDate(health?.checkedAt)} · {health?.latencyMs ?? "-"}ms
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(checks).map(([name, value]) => (
            <div
              key={name}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {name.replace(/([A-Z])/g, " $1")}
                  </p>
                  <p className="mt-2 text-xl font-black text-slate-950">
                    {String(value).replace(/_/g, " ")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusTone(
                    String(value),
                  )}`}
                >
                  {String(value)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {statCards.map(([label, value, icon]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {value}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <span className="material-symbols-outlined">{icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Operational Notes</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <p className="rounded-lg bg-slate-50 p-4">
              Database connectivity is checked live from the backend endpoint.
            </p>
            <p className="rounded-lg bg-slate-50 p-4">
              Subscription cycle availability confirms the manual expiry job can run.
            </p>
            <p className="rounded-lg bg-slate-50 p-4">
              Platform metrics are read from tenant, subscription, and order tables.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
