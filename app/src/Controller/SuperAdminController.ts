import type { Context } from "elysia";
import { getDB } from "../lib/connect";
import {
  applySubscriptionTransitions,
  listRestaurantsWithSubscriptions,
  renewRestaurantSubscription,
  SUBSCRIPTION_STATUSES,
  updateRestaurantSubscriptionStatus,
  type SubscriptionStatus,
} from "../lib/subscription";
import {
  getJwtPayload,
  normalizeRestaurantId,
  requireRole,
} from "../middleware/restaurantScope";
import {
  ensureSuperadminAuditSchema,
  writeSuperadminAudit,
} from "../lib/superadminAudit";
import {
  getBillingRequestProof,
  listSuperadminBillingRequests,
  updateBillingRequestReview,
} from "../lib/billingRequests";

const db = getDB();

const RESTAURANT_STATUSES = [
  "pending",
  "active",
  "suspended",
  "inactive",
  "archived",
  "deleted",
] as const;

const sortMap: Record<string, string> = {
  created_desc: "r.created_at DESC",
  created_asc: "r.created_at ASC",
  name_asc: "LOWER(r.name) ASC",
  name_desc: "LOWER(r.name) DESC",
  status_asc: "r.status ASC, r.created_at DESC",
};

function getClientIp(context: Context) {
  return (
    context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    context.request.headers.get("x-real-ip") ||
    null
  );
}

function trimOptional(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function getActor(context: Context & { jwt?: any }) {
  const payload = await getJwtPayload(context);
  if (!payload?.email) {
    return { payload, userId: null };
  }

  const result = await db.query(
    "SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1",
    [payload.email],
  );

  return {
    payload,
    userId: result.rowCount > 0 ? Number(result.rows[0].id) : null,
  };
}

export const SuperAdminController = {
  listRestaurants: async (
    context: Context & {
      query: {
        q?: string;
        status?: string;
        plan?: string;
        subscription_status?: string;
        page?: string;
        pageSize?: string;
        sort?: string;
      };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    await applySubscriptionTransitions();

    const query = context.query || {};
    const page = parsePage(query.page, 1);
    const pageSize = Math.min(parsePage(query.pageSize, 20), 100);
    const offset = (page - 1) * pageSize;
    const filters: string[] = [];
    const params: unknown[] = [];

    const q = trimOptional(query.q);
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      filters.push(
        `(LOWER(r.name) LIKE $${params.length} OR LOWER(r.slug) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`,
      );
    }

    const status = trimOptional(query.status);
    if (status && status !== "all") {
      params.push(status);
      filters.push(`r.status = $${params.length}`);
    }

    const plan = trimOptional(query.plan);
    if (plan && plan !== "all") {
      params.push(plan);
      filters.push(
        `COALESCE(s.plan_code, r.plan, 'starter') = $${params.length}`,
      );
    }

    const subscriptionStatus = trimOptional(query.subscription_status);
    if (subscriptionStatus && subscriptionStatus !== "all") {
      params.push(subscriptionStatus);
      filters.push(`COALESCE(s.status, 'active') = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const orderBy = sortMap[query.sort || ""] || sortMap.created_desc;

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
         FROM restaurants r
         LEFT JOIN users u ON u.id = r.owner_id
         LEFT JOIN subscriptions s ON s.restaurant_id = r.id
        ${where}`,
      params,
    );

    const listParams = [...params, pageSize, offset];
    const result = await db.query(
      `SELECT
         r.*,
         u.username AS owner_username,
         u.email AS owner_email,
         s.plan_code AS subscription_plan_code,
         s.billing_interval AS subscription_billing_interval,
         s.status AS subscription_status,
         s.current_period_start,
         s.current_period_end,
         s.grace_ends_at,
         s.cancel_at_period_end,
         s.renewal_requested_at,
         s.renewal_request_note,
         s.last_payment_at
       FROM restaurants r
       LEFT JOIN users u ON u.id = r.owner_id
       LEFT JOIN subscriptions s ON s.restaurant_id = r.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams,
    );

    const countsResult = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended,
         COUNT(*) FILTER (WHERE status = 'archived')::int AS archived,
         COUNT(*) FILTER (WHERE status = 'deleted')::int AS deleted
       FROM restaurants`,
    );

    const total = Number(countResult.rows[0]?.total || 0);
    return {
      items: result.rows,
      restaurants: result.rows,
      counts: countsResult.rows[0] || {},
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  },

  getRestaurant: async (
    context: Context & { params: { id: string }; jwt?: any },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    await ensureSuperadminAuditSchema();
    await applySubscriptionTransitions(normalizeRestaurantId(context.params.id));

    const restaurantId = normalizeRestaurantId(context.params.id);
    const restaurantResult = await db.query(
      `SELECT
         r.*,
         s.plan_code AS subscription_plan_code,
         s.billing_interval AS subscription_billing_interval,
         s.status AS subscription_status,
         s.current_period_start,
         s.current_period_end,
         s.grace_ends_at,
         s.cancel_at_period_end,
         s.renewal_requested_at,
         s.renewal_request_note,
         s.last_payment_at
       FROM restaurants r
       LEFT JOIN subscriptions s ON s.restaurant_id = r.id
       WHERE r.id = $1
       LIMIT 1`,
      [restaurantId],
    );

    if (restaurantResult.rowCount === 0) {
      context.set.status = 404;
      return { message: "Restaurant not found" };
    }

    const [users, counts, recentAudit] = await Promise.all([
      db.query(
        `SELECT id, username, email, role, created_at
           FROM users
          WHERE restaurant_id = $1
          ORDER BY
            CASE role
              WHEN 'owner' THEN 1
              WHEN 'admin' THEN 2
              ELSE 3
            END,
            created_at DESC`,
        [restaurantId],
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM users WHERE restaurant_id = $1) AS users,
           (SELECT COUNT(*)::int FROM tables WHERE restaurant_id = $1) AS tables,
           (SELECT COUNT(*)::int FROM menu_new WHERE restaurant_id = $1) AS menu_items,
           (SELECT COUNT(*)::int FROM sessions WHERE restaurant_id = $1) AS sessions,
           (SELECT COUNT(*)::int FROM orders WHERE restaurant_id = $1) AS orders,
           (SELECT COUNT(*)::int FROM orders WHERE restaurant_id = $1 AND created_at >= CURRENT_DATE) AS orders_today`,
        [restaurantId],
      ),
      db.query(
        `SELECT *
           FROM superadmin_audit_logs
          WHERE restaurant_id = $1
          ORDER BY created_at DESC
          LIMIT 10`,
        [restaurantId],
      ),
    ]);

    return {
      restaurant: restaurantResult.rows[0],
      users: users.rows,
      counts: counts.rows[0] || {},
      recentAudit: recentAudit.rows,
    };
  },

  stats: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    await applySubscriptionTransitions();
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM restaurants) AS total_tenants,
         (SELECT COUNT(*)::int FROM restaurants WHERE status = 'active') AS active_tenants,
         (SELECT COUNT(*)::int FROM restaurants WHERE status = 'pending') AS pending_tenants,
         (SELECT COUNT(*)::int FROM restaurants WHERE status = 'suspended') AS suspended_tenants,
         (SELECT COUNT(*)::int FROM subscriptions WHERE renewal_requested_at IS NOT NULL) AS renewal_requests,
         (SELECT COUNT(*)::int FROM subscriptions WHERE status IN ('past_due', 'grace', 'suspended', 'cancelled')) AS blocked_subscriptions,
         (SELECT COUNT(*)::int FROM orders WHERE created_at >= CURRENT_DATE) AS orders_today`,
    );

    return { stats: result.rows[0] || {} };
  },

  systemHealth: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const startedAt = Date.now();
    await db.query("SELECT 1");
    return {
      status: "ok",
      checks: {
        database: "ok",
        subscriptionCycle: "available",
      },
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  },

  audit: async (
    context: Context & {
      query: {
        restaurant_id?: string;
        actor?: string;
        action?: string;
        page?: string;
        pageSize?: string;
      };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    await ensureSuperadminAuditSchema();

    const page = parsePage(context.query?.page, 1);
    const pageSize = Math.min(parsePage(context.query?.pageSize, 30), 100);
    const offset = (page - 1) * pageSize;
    const filters: string[] = [];
    const params: unknown[] = [];

    const restaurantId = trimOptional(context.query?.restaurant_id);
    if (restaurantId) {
      params.push(normalizeRestaurantId(restaurantId));
      filters.push(`l.restaurant_id = $${params.length}`);
    }

    const actor = trimOptional(context.query?.actor);
    if (actor) {
      params.push(`%${actor.toLowerCase()}%`);
      filters.push(`LOWER(COALESCE(l.actor_email, '')) LIKE $${params.length}`);
    }

    const action = trimOptional(context.query?.action);
    if (action && action !== "all") {
      params.push(action);
      filters.push(`l.action = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM superadmin_audit_logs l ${where}`,
      params,
    );

    const listParams = [...params, pageSize, offset];
    const result = await db.query(
      `SELECT
         l.*,
         r.name AS restaurant_name,
         r.slug AS restaurant_slug
       FROM superadmin_audit_logs l
       LEFT JOIN restaurants r ON r.id = l.restaurant_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams,
    );

    const total = Number(countResult.rows[0]?.total || 0);
    return {
      items: result.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  },

  updateRestaurantStatus: async (
    context: Context & {
      params: { id: string; status: string };
      body?: { reason?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const status = String(context.params.status || "");
    if (!RESTAURANT_STATUSES.includes(status as any)) {
      context.set.status = 400;
      return { message: "Invalid restaurant status" };
    }

    const reason = trimOptional(context.body?.reason);
    if (["suspended", "archived", "deleted", "inactive"].includes(status) && !reason) {
      context.set.status = 400;
      return { message: "Reason is required" };
    }

    const restaurantId = normalizeRestaurantId(context.params.id);
    const before = await db.query("SELECT * FROM restaurants WHERE id=$1", [
      restaurantId,
    ]);
    if (before.rowCount === 0) {
      context.set.status = 404;
      return { message: "Restaurant not found" };
    }

    const result = await db.query(
      "UPDATE restaurants SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, restaurantId],
    );

    const actor = await getActor(context);
    await writeSuperadminAudit({
      actorUserId: actor.userId,
      actorEmail: actor.payload?.email || null,
      restaurantId,
      action: `restaurant.${status}`,
      reason,
      oldValue: before.rows[0],
      newValue: result.rows[0],
      ipAddress: getClientIp(context),
    });

    return { restaurant: result.rows[0] };
  },

  impersonate: async (
    context: Context & {
      params: { id: string };
      body?: { reason?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const reason = trimOptional(context.body?.reason);
    if (!reason) {
      context.set.status = 400;
      return { message: "Reason is required before impersonation" };
    }

    const restaurantId = normalizeRestaurantId(context.params.id);
    const restaurantResult = await db.query(
      "SELECT * FROM restaurants WHERE id=$1",
      [restaurantId],
    );

    if (restaurantResult.rowCount === 0) {
      context.set.status = 404;
      return { message: "Restaurant not found" };
    }

    const restaurant = restaurantResult.rows[0];
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      username: scope.payload.username,
      email: scope.payload.email,
      role: "superadmin",
      restaurant_id: restaurant.id,
      impersonating: true,
      impersonation_reason: reason,
      iat: now,
      exp: now + 60 * 60,
    };

    const token = context.jwt ? await context.jwt.sign(payload) : undefined;
    const refreshToken = context.jwt
      ? await context.jwt.sign({ ...payload, exp: now + 2 * 60 * 60 })
      : undefined;

    const actor = await getActor(context);
    await writeSuperadminAudit({
      actorUserId: actor.userId,
      actorEmail: actor.payload?.email || null,
      restaurantId,
      action: "restaurant.impersonate",
      reason,
      newValue: { restaurant_id: restaurant.id, slug: restaurant.slug },
      ipAddress: getClientIp(context),
    });

    return {
      token,
      refreshToken,
      restaurant,
      role: "superadmin",
      redirectpath: `/app/${restaurant.slug}/admin`,
    };
  },

  renewSubscription: async (
    context: Context & {
      params: { id: string };
      body: { months?: number; plan_code?: string; note?: string; reason?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const restaurantId = normalizeRestaurantId(context.params.id);
    const before = await db.query(
      "SELECT * FROM subscriptions WHERE restaurant_id=$1",
      [restaurantId],
    );
    const subscription = await renewRestaurantSubscription({
      restaurantId,
      months: context.body?.months || 1,
      planCode: context.body?.plan_code || undefined,
      note: context.body?.note || null,
    });

    const actor = await getActor(context);
    await writeSuperadminAudit({
      actorUserId: actor.userId,
      actorEmail: actor.payload?.email || null,
      restaurantId,
      action: "subscription.renew",
      reason: context.body?.reason || context.body?.note || null,
      oldValue: before.rows[0] || null,
      newValue: subscription,
      ipAddress: getClientIp(context),
    });

    return { subscription };
  },

  updateSubscriptionStatus: async (
    context: Context & {
      params: { id: string };
      body: { status: SubscriptionStatus; note?: string; reason?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    if (!SUBSCRIPTION_STATUSES.includes(context.body?.status)) {
      context.set.status = 400;
      return { message: "Invalid subscription status" };
    }

    const restaurantId = normalizeRestaurantId(context.params.id);
    const before = await db.query(
      "SELECT * FROM subscriptions WHERE restaurant_id=$1",
      [restaurantId],
    );
    const subscription = await updateRestaurantSubscriptionStatus({
      restaurantId,
      status: context.body.status,
      note: context.body?.note || null,
    });

    const actor = await getActor(context);
    await writeSuperadminAudit({
      actorUserId: actor.userId,
      actorEmail: actor.payload?.email || null,
      restaurantId,
      action: "subscription.status",
      reason: context.body?.reason || context.body?.note || null,
      oldValue: before.rows[0] || null,
      newValue: subscription,
      ipAddress: getClientIp(context),
    });

    return { subscription };
  },

  runSubscriptionCycle: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    await applySubscriptionTransitions();
    const actor = await getActor(context);
    await writeSuperadminAudit({
      actorUserId: actor.userId,
      actorEmail: actor.payload?.email || null,
      action: "subscription.run_cycle",
      ipAddress: getClientIp(context),
    });

    return { success: true };
  },

  billingRequests: async (
    context: Context & {
      query?: { status?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const requests = await listSuperadminBillingRequests(
      context.query?.status || "pending_review",
    );
    return { requests };
  },

  billingProof: async (
    context: Context & { params: { id: string }; jwt?: any },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const proof = await getBillingRequestProof(Number(context.params.id));
    if (!proof) {
      context.set.status = 404;
      return { message: "Proof not found" };
    }

    return {
      proof: `data:${proof.proof_mime || "application/octet-stream"};base64,${Buffer.from(
        proof.proof_blob,
      ).toString("base64")}`,
      mime: proof.proof_mime,
      filename: proof.proof_filename,
    };
  },

  approveBillingRequest: async (
    context: Context & {
      params: { id: string };
      body?: { note?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const actor = await getActor(context);
    const request = await updateBillingRequestReview({
      requestId: Number(context.params.id),
      status: "approved",
      reviewedByUserId: actor.userId,
      reviewNote: context.body?.note || null,
    });

    if (!request) {
      context.set.status = 404;
      return { message: "Pending billing request not found" };
    }

    const subscription = await renewRestaurantSubscription({
      restaurantId: Number(request.restaurant_id),
      months: Number(request.months || 1),
      planCode: request.plan_code || undefined,
      note: context.body?.note || "Billing request approved",
    });

    await writeSuperadminAudit({
      actorUserId: actor.userId,
      actorEmail: actor.payload?.email || null,
      restaurantId: Number(request.restaurant_id),
      action: "billing_request.approved",
      reason: context.body?.note || "Billing request approved",
      newValue: { request, subscription },
      ipAddress: getClientIp(context),
    });

    return { request, subscription };
  },

  rejectBillingRequest: async (
    context: Context & {
      params: { id: string };
      body?: { note?: string };
      jwt?: any;
    },
  ) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const note = trimOptional(context.body?.note);
    if (!note) {
      context.set.status = 400;
      return { message: "Review note is required" };
    }

    const actor = await getActor(context);
    const request = await updateBillingRequestReview({
      requestId: Number(context.params.id),
      status: "rejected",
      reviewedByUserId: actor.userId,
      reviewNote: note,
    });

    if (!request) {
      context.set.status = 404;
      return { message: "Pending billing request not found" };
    }

    await writeSuperadminAudit({
      actorUserId: actor.userId,
      actorEmail: actor.payload?.email || null,
      restaurantId: Number(request.restaurant_id),
      action: "billing_request.rejected",
      reason: note,
      newValue: request,
      ipAddress: getClientIp(context),
    });

    return { request };
  },

  legacyRestaurants: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, ["superadmin"], {
      skipSubscriptionCheck: true,
    });
    if (!scope.ok) return scope.response;

    const restaurants = await listRestaurantsWithSubscriptions();
    return { restaurants };
  },
};
