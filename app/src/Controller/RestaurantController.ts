import type { Context } from "elysia";
import bcryptjs from "bcryptjs";
import { getDB } from "../lib/connect";
import {
  applySubscriptionTransitions,
  ensureRestaurantSubscription,
  getRestaurantWithSubscription,
  listRestaurantsWithSubscriptions,
  renewRestaurantSubscription,
  requestRestaurantRenewal,
  updateRestaurantSubscriptionStatus,
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "../lib/subscription";
import {
  createBillingRequest,
  listRestaurantBillingRequests,
} from "../lib/billingRequests";
import {
  getJwtPayload,
  normalizeRestaurantId,
  requireRestaurantScope,
  requireRole,
} from "../middleware/restaurantScope";
import {
  getRestaurantSettings,
  updateRestaurantSettings,
} from "../lib/restaurantSettings";

const db = getDB();

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function getUserIdFromPayload(payload: { email?: string } | null | undefined) {
  if (!payload?.email) return null;
  const result = await db.query(
    "SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1",
    [payload.email],
  );
  return result.rowCount > 0 ? Number(result.rows[0].id) : null;
}

export const RestaurantController = {
  create: async (
    context: Context & {
      body: {
        name: string;
        slug?: string;
        status?: "active" | "pending" | "suspended" | "inactive";
        plan?: string;
        username?: string;
        email?: string;
        password?: string;
        role?: "owner" | "admin";
      };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const name = body.name?.trim();
    const slug = toSlug(body.slug || body.name || "");
    const status = body.status || "pending";
    const plan = body.plan?.trim() || "free";
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const role = body.role || "owner";

    if (!name) {
      set.status = 400;
      return { message: "Restaurant name is required" };
    }

    if (!slug) {
      set.status = 400;
      return { message: "Restaurant slug is required" };
    }

    if (!["active", "pending", "suspended", "inactive"].includes(status)) {
      set.status = 400;
      return { message: "Invalid restaurant status" };
    }

    if (!username || !email || !password) {
      set.status = 400;
      return { message: "Owner or admin credentials are required" };
    }

    if (!["owner", "admin"].includes(role)) {
      set.status = 400;
      return { message: "Invalid account role" };
    }

    try {
      const existingUser = await db.query(
        "SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)",
        [email],
      );
      if (existingUser.rowCount > 0) {
        set.status = 409;
        return { message: "Email already exists" };
      }

      const passwordHash = await bcryptjs.hash(password, 10);

      await db.query("BEGIN");
      const restaurantResult = await db.query(
        `INSERT INTO restaurants (name, slug, status, plan, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [name, slug, status, plan],
      );
      const restaurant = restaurantResult.rows[0];

      const userResult = await db.query(
        `INSERT INTO users (username, email, password, role, restaurant_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, role`,
        [username, email, passwordHash, role, restaurant.id],
      );
      const createdUser = userResult.rows[0];

      if (role === "owner") {
        await db.query(
          "UPDATE restaurants SET owner_id=$1, updated_at=NOW() WHERE id=$2",
          [createdUser.id, restaurant.id],
        );
      }

      await db.query("COMMIT");
      await ensureRestaurantSubscription(restaurant.id);

      set.status = 201;
      return {
        restaurant: {
          ...restaurant,
          owner_id: role === "owner" ? createdUser.id : restaurant.owner_id,
        },
        user: createdUser,
      };
    } catch (error) {
      await db.query("ROLLBACK");
      const dbError = error as { code?: string };
      if (dbError.code === "23505") {
        set.status = 409;
        return { message: "Restaurant slug already exists" };
      }
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  impersonate: async (
    context: Context & {
      params: { id: string };
      jwt?: any;
    },
  ) => {
    const { set, params } = context;
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const restaurantId = normalizeRestaurantId(params.id);
    const restaurantResult = await db.query(
      "SELECT * FROM restaurants WHERE id=$1",
      [restaurantId],
    );

    if (restaurantResult.rowCount === 0) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    const restaurant = restaurantResult.rows[0];
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      username: scope.payload.username,
      email: scope.payload.email,
      role: "superadmin",
      restaurant_id: restaurant.id,
      iat: now,
    };
    const refreshPayload = {
      ...payload,
      exp: now + 7 * 24 * 60 * 60,
    };

    const token = context.jwt ? await context.jwt.sign(payload) : undefined;
    const refreshToken = context.jwt
      ? await context.jwt.sign(refreshPayload)
      : undefined;

    return {
      token,
      refreshToken,
      restaurant,
      role: "superadmin",
      redirectpath: `/app/${restaurant.slug}/admin`,
    };
  },

  register: async (
    context: Context & {
      body: { name: string; slug?: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const payload = await getJwtPayload(context);
    if (!payload?.username) {
      set.status = 401;
      return { message: "Unauthorized: Please login" };
    }

    if (!body.name) {
      set.status = 400;
      return { message: "Restaurant name is required" };
    }

    const slug = toSlug(body.slug || body.name);
    if (!slug) {
      set.status = 400;
      return { message: "Restaurant slug is required" };
    }

    try {
      const userResult = await db.query(
        `SELECT id, username, email
           FROM users
          WHERE LOWER(email)=LOWER($1)
             OR (restaurant_id=$2 AND username=$3)
          LIMIT 1`,
        [payload.email || "", payload.restaurant_id || null, payload.username],
      );
      if (userResult.rowCount === 0) {
        set.status = 404;
        return { message: "User not found" };
      }
      const user = userResult.rows[0];

      await db.query("BEGIN");
      const restaurant = await db.query(
        `INSERT INTO restaurants (name, slug, owner_id, status, plan)
         VALUES ($1, $2, $3, 'pending', 'free')
         RETURNING *`,
        [body.name, slug, user.id],
      );
      await db.query(
        "UPDATE users SET restaurant_id=$1, role='owner' WHERE id=$2",
        [restaurant.rows[0].id, user.id],
      );
      await db.query("COMMIT");
      await ensureRestaurantSubscription(restaurant.rows[0].id);

      const now = Math.floor(Date.now() / 1000);
      const nextPayload = {
        username: user.username,
        email: user.email,
        role: "owner",
        restaurant_id: restaurant.rows[0].id,
        iat: now,
      };
      const token = context.jwt
        ? await context.jwt.sign(nextPayload)
        : undefined;
      const refreshToken = context.jwt
        ? await context.jwt.sign({
            ...nextPayload,
            exp: now + 7 * 24 * 60 * 60,
          })
        : undefined;

      set.status = 201;
      return {
        restaurant: restaurant.rows[0],
        token,
        refreshToken,
        role: "owner",
        redirectpath: "/restaurant/pending",
      };
    } catch (error) {
      await db.query("ROLLBACK");
      const dbError = error as { code?: string; message?: string };
      if (dbError.code === "23505") {
        set.status = 409;
        return { message: "Restaurant slug already exists" };
      }
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  me: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRestaurantScope(context);
    if (!scope.ok) return scope.response;

    const payload = await getRestaurantWithSubscription(scope.restaurantId);
    if (!payload) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    return payload;
  },

  updateMe: async (
    context: Context & {
      body: { name?: string; slug?: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["owner", "admin", "superadmin"]);
    if (!scope.ok) return scope.response;

    const name = body.name?.trim();
    const slug = body.slug ? toSlug(body.slug) : undefined;
    if (!name && !slug) {
      set.status = 400;
      return { message: "No changes provided" };
    }

    const result = await db.query(
      `UPDATE restaurants
          SET name = COALESCE($1, name),
              slug = COALESCE($2, slug),
              updated_at = NOW()
        WHERE id=$3
        RETURNING *`,
      [name || null, slug || null, scope.restaurantId],
    );

    return { restaurant: result.rows[0] };
  },

  settings: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(
      context,
      ["owner", "admin", "staff", "kitchen", "superadmin"],
      { skipSubscriptionCheck: true },
    );
    if (!scope.ok) return scope.response;

    const payload = await getRestaurantSettings(scope.restaurantId);
    if (!payload) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    const subscriptionPayload = await getRestaurantWithSubscription(
      scope.restaurantId,
    );

    return {
      ...payload,
      subscription: subscriptionPayload?.subscription || null,
    };
  },

  updateSettings: async (
    context: Context & {
      body: {
        profile?: Record<string, any>;
        business_hours?: Record<string, any>;
        account_security?: Record<string, any>;
        team_settings?: Record<string, any>;
        order_settings?: Record<string, any>;
        table_qr_settings?: Record<string, any>;
        menu_settings?: Record<string, any>;
        notification_settings?: Record<string, any>;
        danger_zone?: Record<string, any>;
      };
      jwt?: any;
    },
  ) => {
    const { body, set } = context;
    const scope = await requireRole(context, ["owner", "admin", "superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const profile = body?.profile || {};
    const name = typeof profile.name === "string" ? profile.name.trim() : "";
    const slug = typeof profile.slug === "string" ? toSlug(profile.slug) : "";

    if (profile.name !== undefined && !name) {
      set.status = 400;
      return { message: "Restaurant name is required" };
    }
    if (profile.slug !== undefined && !slug) {
      set.status = 400;
      return { message: "Restaurant slug is required" };
    }

    if (name || slug) {
      try {
        await db.query(
          `UPDATE restaurants
              SET name = COALESCE($1, name),
                  slug = COALESCE($2, slug),
                  updated_at = NOW()
            WHERE id=$3`,
          [name || null, slug || null, scope.restaurantId],
        );
      } catch (error) {
        const dbError = error as { code?: string };
        if (dbError.code === "23505") {
          set.status = 409;
          return { message: "Restaurant slug already exists" };
        }
        throw error;
      }
    }

    const updated = await updateRestaurantSettings(scope.restaurantId, body || {});
    if (!updated) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    const subscriptionPayload = await getRestaurantWithSubscription(
      scope.restaurantId,
    );

    return {
      ...updated,
      subscription: subscriptionPayload?.subscription || null,
    };
  },

  changePassword: async (
    context: Context & {
      body: { current_password?: string; new_password?: string };
      jwt?: any;
    },
  ) => {
    const { body, set } = context;
    const scope = await requireRole(context, ["owner", "admin", "superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    if (!scope.payload?.email) {
      set.status = 400;
      return { message: "Account email is required" };
    }
    if (!body?.current_password || !body?.new_password) {
      set.status = 400;
      return { message: "Current password and new password are required" };
    }
    if (body.new_password.length < 8) {
      set.status = 400;
      return { message: "New password must be at least 8 characters" };
    }

    const userResult = await db.query(
      `SELECT id, password
         FROM users
        WHERE LOWER(email)=LOWER($1)
          AND (restaurant_id=$2 OR role='superadmin')
        LIMIT 1`,
      [scope.payload.email, scope.restaurantId],
    );
    if (userResult.rowCount === 0) {
      set.status = 404;
      return { message: "User not found" };
    }

    const valid = await bcryptjs.compare(
      body.current_password,
      userResult.rows[0].password,
    );
    if (!valid) {
      set.status = 403;
      return { message: "Current password is incorrect" };
    }

    const hash = await bcryptjs.hash(body.new_password, 10);
    await db.query("UPDATE users SET password=$1 WHERE id=$2", [
      hash,
      userResult.rows[0].id,
    ]);

    return { success: true };
  },

  list: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const restaurants = await listRestaurantsWithSubscriptions();
    return { restaurants };
  },

  pending: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const restaurants = await listRestaurantsWithSubscriptions({ onlyPending: true });
    return { restaurants };
  },

  approve: async (context: Context & { params: { id: string }; jwt?: any }) => {
    return RestaurantController.updateStatus(context, "active");
  },

  suspend: async (context: Context & { params: { id: string }; jwt?: any }) => {
    return RestaurantController.updateStatus(context, "suspended");
  },

  reject: async (context: Context & { params: { id: string }; jwt?: any }) => {
    return RestaurantController.updateStatus(context, "inactive");
  },

  updateStatus: async (
    context: Context & {
      params: { id: string };
      jwt?: any;
    },
    status: "active" | "suspended" | "inactive" | "deleted",
  ) => {
    const { set, params } = context;
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const result = await db.query(
      "UPDATE restaurants SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, normalizeRestaurantId(params.id)],
    );
    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    return { restaurant: result.rows[0] };
  },

  setStatus: async (
    context: Context & {
      params: { id: string; status: string };
      jwt?: any;
    },
  ) => {
    const { set, params } = context;
    const scope = await requireRole(context, ["superadmin"]);
    if (!scope.ok) return scope.response;

    const status = params.status;
    if (!["active", "suspended", "inactive", "deleted"].includes(status)) {
      set.status = 400;
      return { message: "Invalid restaurant status" };
    }

    return RestaurantController.updateStatus(
      { ...context, params: { id: params.id } },
      status as "active" | "suspended" | "inactive" | "deleted",
    );
  },

  subscription: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(
      context,
      ["owner", "admin", "staff", "kitchen", "user", "superadmin"],
      { skipSubscriptionCheck: true },
    );
    if (!scope.ok) return scope.response;

    const payload = await getRestaurantWithSubscription(scope.restaurantId);
    if (!payload) {
      set.status = 404;
      return { message: "Restaurant not found" };
    }

    return payload;
  },

  requestRenewal: async (
    context: Context & {
      body: { note?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["owner", "admin", "superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const subscription = await requestRestaurantRenewal({
      restaurantId: scope.restaurantId,
      note: context.body?.note || null,
    });

    return { subscription };
  },

  billingRequests: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["owner", "admin", "superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const requests = await listRestaurantBillingRequests(scope.restaurantId);
    return { requests };
  },

  createBillingRequest: async (
    context: Context & {
      body: {
        plan_code?: string;
        months?: number;
        amount?: number;
        note?: string;
        proof_base64?: string;
        proof_mime?: string;
        proof_filename?: string;
      };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["owner", "admin", "superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const requestedByUserId = await getUserIdFromPayload(scope.payload);
    const request = await createBillingRequest({
      restaurantId: scope.restaurantId,
      requestedByUserId,
      planCode: context.body?.plan_code || "starter",
      months: context.body?.months || 1,
      amount: context.body?.amount || null,
      note: context.body?.note || null,
      proofBase64: context.body?.proof_base64 || null,
      proofMime: context.body?.proof_mime || null,
      proofFilename: context.body?.proof_filename || null,
    });

    return { request };
  },

  renew: async (
    context: Context & {
      params: { id: string };
      body: { months?: number; plan_code?: string; note?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const restaurantId = normalizeRestaurantId(context.params.id);
    const subscription = await renewRestaurantSubscription({
      restaurantId,
      months: context.body?.months || 1,
      planCode: context.body?.plan_code || undefined,
      note: context.body?.note || null,
    });

    return { subscription };
  },

  updateSubscriptionStatus: async (
    context: Context & {
      params: { id: string };
      body: { status: SubscriptionStatus; note?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const status = context.body?.status;
    if (!SUBSCRIPTION_STATUSES.includes(status)) {
      context.set.status = 400;
      return { message: "Invalid subscription status" };
    }

    const subscription = await updateRestaurantSubscriptionStatus({
      restaurantId: normalizeRestaurantId(context.params.id),
      status,
      note: context.body?.note || null,
    });

    return { subscription };
  },

  runSubscriptionCycle: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    await applySubscriptionTransitions();
    return { success: true };
  },
};
