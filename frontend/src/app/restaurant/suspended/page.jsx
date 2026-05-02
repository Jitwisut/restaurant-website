"use client";

import { Ban, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isSubscriptionInactive } from "@/lib/auth";
import { resolveRoleHome } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";

export default function SuspendedPage() {
  const router = useRouter();
  const { auth, refreshAuth, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const billingInactive = isSubscriptionInactive(auth);

  const handleRefresh = async () => {
    setChecking(true);
    setMessage("");

    try {
      const next = await refreshAuth();
      if (
        next?.restaurantStatus === "active" &&
        !isSubscriptionInactive(next)
      ) {
        router.replace(resolveRoleHome(next));
        return;
      }
      setMessage(
        billingInactive
          ? "The subscription is still inactive."
          : "This restaurant is still suspended or unavailable.",
      );
    } catch {
      setMessage("Could not refresh the restaurant status right now.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    signOut();
    router.push("/signin");
  };

  return (
    <main className="min-h-screen bg-[#f8f1ef] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-8 sm:px-6 md:py-10">
        <section className="grid w-full overflow-hidden rounded-lg border border-rose-200 bg-white shadow-xl md:grid-cols-[0.95fr_1.05fr]">
          <div className="relative hidden min-h-[460px] bg-rose-950 md:block">
            <div className="absolute inset-0 bg-gradient-to-t from-rose-950 via-rose-950/70 to-transparent" />
            <div className="absolute bottom-0 p-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">
                RestaurantOS
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-tight">
                Restaurant access is currently restricted
              </h1>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <Ban aria-hidden="true" className="h-7 w-7" />
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Access suspended
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-950">
              {billingInactive
                ? "Subscription access is inactive"
                : "This restaurant has been suspended"}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {billingInactive
                ? `${auth?.restaurantName || auth?.restaurantSlug || "This restaurant"} needs a subscription renewal before the dashboard and ordering tools can be used again.`
                : `${auth?.restaurantName || auth?.restaurantSlug || "This restaurant"} cannot use the dashboard or ordering tools right now. Please contact the platform administrator for more information.`}
            </p>

            {message ? (
              <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {message}
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={checking}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`h-4 w-4 ${checking ? "animate-spin" : ""}`}
                />
                {checking ? "Checking..." : "Refresh status"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sign out
              </button>
            </div>
            {billingInactive &&
            (auth?.role === "owner" || auth?.role === "admin") ? (
              <div className="mt-4">
                <Link
                  href="/restaurant/billing"
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-rose-100 px-4 text-sm font-semibold text-rose-800 transition hover:bg-rose-200"
                >
                  Open billing page
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
