"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function SuperadminAuditPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          Loading audit logs...
        </main>
      }
    >
      <SuperadminAuditContent />
    </Suspense>
  );
}

function SuperadminAuditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auth, ready } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("all");

  const restaurantId = searchParams.get("restaurant_id") || "";

  const load = async (page = pagination.page) => {
    if (!auth?.token || auth?.role !== "superadmin") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize),
      });
      if (restaurantId) params.set("restaurant_id", restaurantId);
      if (actor.trim()) params.set("actor", actor.trim());
      if (action !== "all") params.set("action", action);

      const response = await api.get(`/superadmin/audit?${params.toString()}`);
      setEntries(response.data.items || []);
      setPagination(response.data.pagination || pagination);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load audit failed",
        text: error.normalizedMessage || "Unable to load audit logs",
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
    load(1);
  }, [auth, ready, router, restaurantId]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        Loading audit logs...
      </main>
    );
  }

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
            <h1 className="text-3xl font-black text-slate-950">Audit Log</h1>
            <p className="mt-2 text-sm text-slate-500">
              Track high-risk superadmin actions across restaurants.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            placeholder="Filter actor email"
            className="h-10 min-w-64 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold"
          >
            <option value="all">All actions</option>
            <option value="restaurant.active">Restaurant active</option>
            <option value="restaurant.suspended">Restaurant suspended</option>
            <option value="restaurant.archived">Restaurant archived</option>
            <option value="restaurant.deleted">Restaurant deleted</option>
            <option value="restaurant.impersonate">Impersonation</option>
            <option value="subscription.renew">Subscription renew</option>
            <option value="subscription.status">Subscription status</option>
          </select>
          <button
            type="button"
            onClick={() => load(1)}
            className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white"
          >
            Apply
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Action
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Restaurant
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actor
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Reason
                </th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length ? (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-950">
                      {entry.action}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <p>{entry.restaurant_name || "-"}</p>
                      <p className="text-xs text-slate-400">
                        {entry.restaurant_slug ? `/${entry.restaurant_slug}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {entry.actor_email || "-"}
                    </td>
                    <td className="max-w-md px-5 py-4 text-sm text-slate-600">
                      {entry.reason || "No reason"}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-500">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-sm text-slate-500">
                    No audit entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages}, {pagination.total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => load(pagination.page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 font-bold disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => load(pagination.page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 font-bold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
