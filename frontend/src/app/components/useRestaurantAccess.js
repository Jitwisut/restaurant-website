"use client";

import { useEffect, useMemo } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  buildRestaurantPath,
  getDefaultSectionForRole,
  isSubscriptionInactive,
  resolveRoleHome,
} from "@/lib/auth";
import { useAuth } from "./AuthProvider";

export function useRestaurantAccess(allowedRoles = []) {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const slug = typeof params?.slug === "string" ? params.slug : null;
  const rolesKey = allowedRoles.join("|");
  const allowedRoleList = useMemo(
    () => (rolesKey ? rolesKey.split("|") : []),
    [rolesKey],
  );

  const canonicalPath = useMemo(() => {
    if (!auth?.restaurantSlug) return null;

    const section =
      pathname?.split("/").filter(Boolean).slice(-1)[0] ||
      getDefaultSectionForRole(auth.role);

    return buildRestaurantPath(auth, section);
  }, [auth, pathname]);

  useEffect(() => {
    if (!ready) return;

    if (!auth?.token) {
      router.replace("/signin");
      return;
    }

    if (auth.restaurantStatus === "pending" && auth.role !== "superadmin") {
      router.replace("/restaurant/pending");
      return;
    }

    if (
      auth.restaurantStatus &&
      auth.restaurantStatus !== "active" &&
      auth.role !== "superadmin"
    ) {
      router.replace("/restaurant/suspended");
      return;
    }

    if (auth.role !== "superadmin" && isSubscriptionInactive(auth)) {
      router.replace(
        auth.role === "owner" || auth.role === "admin"
          ? "/restaurant/billing"
          : "/restaurant/suspended",
      );
      return;
    }

    if (allowedRoleList.length > 0 && !allowedRoleList.includes(auth.role)) {
      router.replace(resolveRoleHome(auth));
      return;
    }

    if (slug && auth.restaurantSlug && slug !== auth.restaurantSlug) {
      router.replace(canonicalPath || resolveRoleHome(auth));
      return;
    }

    if (
      !slug &&
      auth.restaurantSlug &&
      /^\/(admin|tables|orders|profile|kitchen|billing)$/.test(pathname || "")
    ) {
      router.replace(canonicalPath || resolveRoleHome(auth));
    }
  }, [allowedRoleList, auth, canonicalPath, pathname, ready, router, slug]);

  const allowed =
    !!auth?.token &&
    (auth.role === "superadmin" ||
      (auth.restaurantStatus === "active" && !isSubscriptionInactive(auth))) &&
    (allowedRoleList.length === 0 || allowedRoleList.includes(auth.role)) &&
    (!slug || !auth?.restaurantSlug || slug === auth.restaurantSlug);

  return {
    auth,
    ready,
    slug,
    allowed,
    canonicalPath,
  };
}
