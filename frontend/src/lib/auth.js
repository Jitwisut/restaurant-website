"use client";

import axios from "axios";

export const AUTH_STORAGE_KEY = "restaurantos.auth";
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

export function isSubscriptionInactive(session) {
  return ["past_due", "grace", "suspended", "cancelled"].includes(
    String(session?.subscriptionStatus || ""),
  );
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window !== "undefined"
        ? window.atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function normalizeAuthSession(raw) {
  if (!raw || typeof raw !== "object") return null;

  const token = raw.token || raw.authToken || null;
  if (!token) return null;
  const tokenPayload = decodeJwtPayload(token) || {};

  return {
    token,
    refreshToken: raw.refreshToken || null,
    username: raw.username || tokenPayload.username || null,
    role: raw.role || tokenPayload.role || null,
    restaurantId:
      raw.restaurantId ??
      raw.restaurant_id ??
      raw.restaurant?.id ??
      tokenPayload.restaurant_id ??
      null,
    restaurantSlug:
      raw.restaurantSlug ?? raw.restaurant_slug ?? raw.restaurant?.slug ?? null,
    restaurantName:
      raw.restaurantName ?? raw.restaurant_name ?? raw.restaurant?.name ?? null,
    restaurantStatus:
      raw.restaurantStatus ??
      raw.restaurant_status ??
      raw.restaurant?.status ??
      null,
    subscriptionStatus:
      raw.subscriptionStatus ??
      raw.subscription_status ??
      raw.subscription?.status ??
      null,
    subscriptionPlan:
      raw.subscriptionPlan ??
      raw.subscription_plan ??
      raw.subscription?.plan_code ??
      null,
    currentPeriodStart:
      raw.currentPeriodStart ??
      raw.current_period_start ??
      raw.subscription?.current_period_start ??
      null,
    currentPeriodEnd:
      raw.currentPeriodEnd ??
      raw.current_period_end ??
      raw.subscription?.current_period_end ??
      null,
    graceEndsAt:
      raw.graceEndsAt ??
      raw.grace_ends_at ??
      raw.subscription?.grace_ends_at ??
      null,
    renewalRequestedAt:
      raw.renewalRequestedAt ??
      raw.renewal_requested_at ??
      raw.subscription?.renewal_requested_at ??
      null,
    impersonating: Boolean(raw.impersonating),
    impersonationReason:
      raw.impersonationReason ?? raw.impersonation_reason ?? null,
    redirectPath: raw.redirectPath ?? raw.redirectpath ?? null,
  };
}

export function getStoredAuth() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return normalizeAuthSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setStoredAuth(session) {
  if (typeof window === "undefined") return;

  const normalized = normalizeAuthSession(session);
  if (!normalized) return;
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function buildRestaurantPath(session, section = "admin") {
  const slug = session?.restaurantSlug;
  if (!slug && session?.role === "superadmin") return `/${section}`;
  if (!slug) return "/signin";
  return `/app/${slug}/${section}`;
}

export function getDefaultSectionForRole(role) {
  if (role === "superadmin") return "superadmin";
  if (role === "kitchen") return "kitchen";
  if (role === "staff" || role === "user") return "profile";
  return "admin";
}

export function resolveRoleHome(session) {
  if (!session) return "/signin";

  if (session.role === "superadmin") {
    return "/superadmin";
  }

  if (session.restaurantStatus === "pending") {
    return "/restaurant/pending";
  }

  if (session.restaurantStatus && session.restaurantStatus !== "active") {
    return "/restaurant/suspended";
  }

  if (isSubscriptionInactive(session)) {
    return session.role === "owner" || session.role === "admin"
      ? "/restaurant/billing"
      : "/restaurant/suspended";
  }

  return buildRestaurantPath(session, getDefaultSectionForRole(session.role));
}

export async function hydrateRestaurantSession(baseSession) {
  const session = normalizeAuthSession(baseSession);
  if (!session?.token) return null;

  try {
    const response = await axios.get(`${API_BASE}/restaurant/me`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    const restaurant = response.data?.restaurant;
    const subscription = response.data?.subscription;
    const merged = normalizeAuthSession({
      ...session,
      restaurant,
      subscription,
      restaurantId: restaurant?.id ?? session.restaurantId,
      restaurantSlug: restaurant?.slug ?? session.restaurantSlug,
      restaurantName: restaurant?.name ?? session.restaurantName,
      restaurantStatus: restaurant?.status ?? session.restaurantStatus,
      subscriptionStatus: subscription?.status ?? session.subscriptionStatus,
      subscriptionPlan: subscription?.plan_code ?? session.subscriptionPlan,
      currentPeriodStart:
        subscription?.current_period_start ?? session.currentPeriodStart,
      currentPeriodEnd:
        subscription?.current_period_end ?? session.currentPeriodEnd,
      graceEndsAt: subscription?.grace_ends_at ?? session.graceEndsAt,
      renewalRequestedAt:
        subscription?.renewal_requested_at ?? session.renewalRequestedAt,
    });

    if (merged) setStoredAuth(merged);
    return merged;
  } catch {
    if (session.restaurantStatus === "pending") {
      setStoredAuth(session);
      return session;
    }
    return session;
  }
}
