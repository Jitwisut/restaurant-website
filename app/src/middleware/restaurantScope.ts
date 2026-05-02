import type { Context } from "elysia";
import { getDB } from "../lib/connect";
import {
  getRestaurantSubscriptionSnapshot,
  isSubscriptionBlocked,
} from "../lib/subscription";

export type RestaurantRole = "owner" | "admin" | "staff" | "user" | "kitchen" | "superadmin";

export type RestaurantJwtPayload = {
  username?: string;
  email?: string;
  role?: RestaurantRole;
  restaurant_id?: number | string | null;
  restaurantId?: number | string | null;
  iat?: number;
  exp?: number;
};

const DEFAULT_RESTAURANT_ID = Number(Bun.env.DEFAULT_RESTAURANT_ID || 1);
const db = getDB();

export function normalizeRestaurantId(value: unknown) {
  const restaurantId = Number(value ?? DEFAULT_RESTAURANT_ID);
  return Number.isFinite(restaurantId) && restaurantId > 0
    ? restaurantId
    : DEFAULT_RESTAURANT_ID;
}

export function resolveRestaurantId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return normalizeRestaurantId(value);
}

export async function getJwtPayload(context: Context & { jwt?: any }) {
  const authHeader =
    context.headers?.authorization ??
    (context.headers as Record<string, string | undefined> | undefined)?.Authorization ??
    context.request?.headers.get("authorization") ??
    context.request?.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token || !context.jwt) return null;

  const payload = await context.jwt.verify(token);
  return payload ? (payload as RestaurantJwtPayload) : null;
}

export async function getRestaurantScope(context: Context & { jwt?: any }) {
  const payload = await getJwtPayload(context);
  return {
    payload,
    restaurantId: resolveRestaurantId(
      payload?.restaurant_id ?? payload?.restaurantId,
    ),
  };
}

export async function getRestaurantById(restaurantId: number | string) {
  const result = await db.query("SELECT * FROM restaurants WHERE id=$1", [
    normalizeRestaurantId(restaurantId),
  ]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

export async function getRestaurantStatusById(restaurantId: number | string) {
  const restaurant = await getRestaurantById(restaurantId);
  return restaurant?.status || null;
}

export async function requireRestaurantScope(context: Context & { jwt?: any }) {
  const scope = await getRestaurantScope(context);

  if (!scope.payload) {
    context.set.status = 401;
    return {
      ok: false as const,
      response: { message: "Unauthorized: Please login" },
    };
  }

  if (scope.payload.role !== "superadmin" && scope.restaurantId === null) {
    context.set.status = 403;
    return {
      ok: false as const,
      response: { message: "Restaurant context is required" },
    };
  }

  return { ok: true as const, ...scope };
}

export async function requireRole(
  context: Context & { jwt?: any },
  allowedRoles: RestaurantRole[],
  options?: { skipSubscriptionCheck?: boolean },
) {
  const scope = await requireRestaurantScope(context);
  if (!scope.ok) return scope;

  if (!scope.payload.role || !allowedRoles.includes(scope.payload.role)) {
    context.set.status = 403;
    return {
      ok: false as const,
      response: { message: "Forbidden: You do not have permission" },
    };
  }

  if (scope.payload.role !== "superadmin") {
    const status = await getRestaurantStatusById(scope.restaurantId);
    if (status !== "active") {
      context.set.status = 403;
      return {
        ok: false as const,
        response: {
          message:
            status === "pending"
              ? "Restaurant is pending approval"
              : status === "suspended"
                ? "Restaurant is suspended"
                : "Restaurant is not active",
        },
      };
    }

    if (!options?.skipSubscriptionCheck) {
      const subscription = await getRestaurantSubscriptionSnapshot(
        scope.restaurantId,
      );
      if (subscription && isSubscriptionBlocked(subscription.status)) {
        context.set.status = 403;
        return {
          ok: false as const,
          response: {
            message:
              subscription.status === "grace"
                ? "Subscription is in grace period and operational access is locked"
                : subscription.status === "past_due"
                  ? "Subscription payment is overdue"
                  : subscription.status === "cancelled"
                    ? "Subscription has been cancelled"
                    : "Subscription is suspended",
            code: "subscription_inactive",
            subscription,
          },
        };
      }
    }
  }

  return scope;
}
