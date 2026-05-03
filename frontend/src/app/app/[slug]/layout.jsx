"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";

export default function RestaurantScopedLayout({ children }) {
  const router = useRouter();
  const { auth } = useAuth();

  const returnToSuperadmin = () => {
    router.push("/superadmin");
  };

  return (
    <>
      {auth?.impersonating ? (
        <div className="sticky top-0 z-[80] flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-sm">
          <div className="min-w-0">
            <span className="font-bold">Impersonation mode</span>
            <span className="ml-2 truncate">
              {auth.restaurantName || auth.restaurantSlug || "Selected restaurant"}
            </span>
            {auth.impersonationReason ? (
              <span className="ml-2 text-amber-700">
                Reason: {auth.impersonationReason}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={returnToSuperadmin}
            className="shrink-0 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-800"
          >
            Return to Superadmin
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}
