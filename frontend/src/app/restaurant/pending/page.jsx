"use client";

import { Clock3, LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolveRoleHome } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";

export default function PendingPage() {
  const router = useRouter();
  const { auth, refreshAuth, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const handleRefresh = async () => {
    setChecking(true);
    setMessage("");

    try {
      const next = await refreshAuth();
      if (next?.restaurantStatus === "active") {
        router.replace(resolveRoleHome(next));
        return;
      }
      setMessage("Your restaurant is still waiting for superadmin approval.");
    } catch {
      setMessage("Could not refresh your status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    signOut();
    router.push("/signin");
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-8 sm:px-6 md:py-10">
        <section className="grid w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl md:grid-cols-[0.95fr_1.05fr]">
          <div className="relative hidden min-h-[460px] bg-slate-950 md:block">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-55"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1974&auto=format&fit=crop')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
            <div className="absolute bottom-0 p-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
                RestaurantOS
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-tight">
                Your restaurant is waiting to go live
              </h1>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock3 aria-hidden="true" className="h-7 w-7" />
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Pending approval
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-950">
              Approval in progress
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {auth?.restaurantName || auth?.restaurantSlug || "Your restaurant"} is
              under review. Once approved, you will be redirected to the
              restaurant dashboard automatically.
            </p>

            {message ? (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
                {checking ? "Checking..." : "Check status"}
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
          </div>
        </section>
      </div>
    </main>
  );
}
