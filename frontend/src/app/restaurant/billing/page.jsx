"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const statusStyles = {
  trial: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  past_due: "bg-amber-100 text-amber-700",
  grace: "bg-orange-100 text-orange-700",
  suspended: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-700",
};

export default function RestaurantBillingPage() {
  const router = useRouter();
  const { auth, ready, refreshAuth, signOut } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready) return;

    if (!auth?.token) {
      router.replace("/signin");
      return;
    }

    if (auth.role === "superadmin") {
      router.replace("/superadmin/subscriptions");
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get("/restaurant/subscription");
        setPayload(response.data);
      } catch (error) {
        setMessage(
          error.normalizedMessage || "Unable to load subscription details.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [api, auth?.role, auth?.token, ready, router]);

  const requestRenewal = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await api.post("/restaurant/subscription/request-renewal", {
        note: "Renewal requested from billing page",
      });
      setPayload((current) => ({
        ...(current || {}),
        subscription: response.data.subscription,
      }));
      await refreshAuth();
      setMessage("Renewal request submitted. Please review it from superadmin.");
    } catch (error) {
      setMessage(error.normalizedMessage || "Unable to request renewal.");
    } finally {
      setSubmitting(false);
    }
  };

  const goHome = async () => {
    const next = await refreshAuth();
    router.replace(resolveRoleHome(next || auth));
  };

  const handleLogout = () => {
    signOut();
    router.push("/signin");
  };

  const subscription = payload?.subscription;
  const restaurant = payload?.restaurant;
  const status = String(subscription?.status || auth?.subscriptionStatus || "active");
  const badgeClass = statusStyles[status] || statusStyles.suspended;
  const canRequestRenewal = ["owner", "admin"].includes(String(auth?.role || ""));

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        Loading subscription details...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1ec] px-5 py-8 text-slate-900">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Subscription Billing
          </p>
          <h1 className="mt-3 text-3xl font-bold">
            {restaurant?.name || auth?.restaurantName || "Restaurant"}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Manage subscription access, review the current billing period, and
            request manual renewal from the superadmin team.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Plan
              </p>
              <p className="mt-2 text-xl font-semibold">
                {subscription?.plan_code || auth?.subscriptionPlan || "starter"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </p>
              <div className="mt-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badgeClass}`}>
                  {status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Billing Interval
              </p>
              <p className="mt-2 text-xl font-semibold">
                {subscription?.billing_interval || "monthly"}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Current period start</p>
              <p className="mt-2 text-lg font-semibold">
                {formatDate(subscription?.current_period_start || auth?.currentPeriodStart)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Current period end</p>
              <p className="mt-2 text-lg font-semibold">
                {formatDate(subscription?.current_period_end || auth?.currentPeriodEnd)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Grace ends</p>
              <p className="mt-2 text-lg font-semibold">
                {formatDate(subscription?.grace_ends_at || auth?.graceEndsAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Renewal requested</p>
              <p className="mt-2 text-lg font-semibold">
                {formatDate(
                  subscription?.renewal_requested_at || auth?.renewalRequestedAt,
                )}
              </p>
            </div>
          </div>
        </article>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">Actions</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              When the plan is no longer active, operational tools stay locked
              until the subscription is manually renewed by the platform team.
            </p>

            <div className="mt-6 grid gap-3">
              {canRequestRenewal ? (
                <button
                  type="button"
                  onClick={requestRenewal}
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Request renewal"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={goHome}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh access
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>

            {message ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {message}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">What happens when it expires?</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <li>Logins still work so owners can review billing and request renewal.</li>
              <li>Operational tools like opening tables and placing orders are locked.</li>
              <li>Superadmin can reactivate access manually without a payment gateway.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
