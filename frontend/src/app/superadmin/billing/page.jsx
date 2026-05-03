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

export default function SuperadminBillingRequestsPage() {
  const router = useRouter();
  const { auth, ready } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("pending_review");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (!auth?.token || auth?.role !== "superadmin") return;
    setLoading(true);
    try {
      const response = await api.get(`/superadmin/billing/requests?status=${status}`);
      setRequests(response.data.requests || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Load failed",
        text: error.normalizedMessage || "Unable to load billing requests",
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
  }, [auth, ready, router, status]);

  const viewProof = async (request) => {
    try {
      const response = await api.get(
        `/superadmin/billing/requests/${request.id}/proof`,
      );
      window.open(response.data.proof, "_blank", "noopener,noreferrer");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Proof unavailable",
        text: error.normalizedMessage || "Unable to open proof",
      });
    }
  };

  const review = async (request, action) => {
    const result = await Swal.fire({
      icon: action === "approve" ? "question" : "warning",
      title: action === "approve" ? "Approve billing request" : "Reject billing request",
      input: "textarea",
      inputPlaceholder: "Review note",
      showCancelButton: true,
      confirmButtonText: action === "approve" ? "Approve" : "Reject",
      inputValidator: (value) => {
        if (action === "reject" && (!value || !value.trim())) {
          return "Review note is required";
        }
        return null;
      },
    });

    if (!result.isConfirmed) return;

    setBusyId(`${action}:${request.id}`);
    try {
      await api.post(`/superadmin/billing/requests/${request.id}/${action}`, {
        note: result.value || `${action} billing request`,
      });
      await load();
      Swal.fire({
        icon: "success",
        title: "Billing request updated",
        timer: 1100,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Review failed",
        text: error.normalizedMessage || "Unable to review request",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        Loading billing requests...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/superadmin")}
              className="mb-4 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              Back to superadmin
            </button>
            <h1 className="text-3xl font-black text-slate-950">
              Billing Requests
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review payment proofs and approve manual subscription renewals.
            </p>
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold"
          >
            <option value="pending_review">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Restaurant
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Request
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Proof
                </th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Created
                </th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length ? (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950">
                        {request.restaurant_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        /{request.restaurant_slug}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">
                        {request.status?.replace(/_/g, " ").toUpperCase()}
                      </p>
                      <p>
                        {request.months || 1} month · {request.amount || "-"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {request.note || "No note"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {request.has_proof ? (
                        <button
                          type="button"
                          onClick={() => viewProof(request)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          View proof
                        </button>
                      ) : (
                        "No proof"
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!!busyId || request.status !== "pending_review"}
                          onClick={() => review(request, "approve")}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId || request.status !== "pending_review"}
                          onClick={() => review(request, "reject")}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-sm text-slate-500">
                    No billing requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
