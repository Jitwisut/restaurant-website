import { getDB } from "./connect";

const db = getDB();

export const SUBSCRIPTION_STATUSES = [
  "trial",
  "active",
  "past_due",
  "grace",
  "suspended",
  "cancelled",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_LOCKED_STATUSES = new Set<SubscriptionStatus>([
  "past_due",
  "grace",
  "suspended",
  "cancelled",
]);

let subscriptionSchemaPromise: Promise<void> | null = null;

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function isSubscriptionBlocked(status: string | null | undefined) {
  return BILLING_LOCKED_STATUSES.has(
    String(status || "") as SubscriptionStatus,
  );
}

export async function ensureSubscriptionSchema() {
  if (!subscriptionSchemaPromise) {
    subscriptionSchemaPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          restaurant_id INTEGER NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
          plan_code VARCHAR(50) NOT NULL DEFAULT 'starter',
          billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
          status VARCHAR(30) NOT NULL DEFAULT 'active',
          current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
          current_period_end TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 day'),
          grace_ends_at TIMESTAMP NULL,
          cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
          renewal_requested_at TIMESTAMP NULL,
          renewal_request_note TEXT NULL,
          last_payment_at TIMESTAMP NULL,
          activated_at TIMESTAMP NULL DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT subscriptions_status_check CHECK (
            status IN ('trial', 'active', 'past_due', 'grace', 'suspended', 'cancelled')
          )
        );
      `);

      await db.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_code VARCHAR(50) NOT NULL DEFAULT 'starter';
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly';
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP NOT NULL DEFAULT NOW();
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 day');
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMP NULL;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_requested_at TIMESTAMP NULL;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_request_note TEXT NULL;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP NULL;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP NULL DEFAULT NOW();
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);

      await db.query(`
        INSERT INTO subscriptions (
          restaurant_id,
          plan_code,
          billing_interval,
          status,
          current_period_start,
          current_period_end,
          grace_ends_at,
          last_payment_at,
          activated_at,
          created_at,
          updated_at
        )
        SELECT
          r.id,
          COALESCE(NULLIF(r.plan, ''), 'starter'),
          'monthly',
          'active',
          COALESCE(r.created_at, NOW()),
          COALESCE(r.created_at, NOW()) + INTERVAL '30 day',
          COALESCE(r.created_at, NOW()) + INTERVAL '37 day',
          COALESCE(r.created_at, NOW()),
          COALESCE(r.created_at, NOW()),
          COALESCE(r.created_at, NOW()),
          NOW()
        FROM restaurants r
        WHERE NOT EXISTS (
          SELECT 1 FROM subscriptions s WHERE s.restaurant_id = r.id
        );
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
      `);
    })().catch((error) => {
      subscriptionSchemaPromise = null;
      throw error;
    });
  }

  await subscriptionSchemaPromise;
}

export async function applySubscriptionTransitions(restaurantId?: number) {
  await ensureSubscriptionSchema();

  const params: unknown[] = [];
  const restaurantWhere = restaurantId ? "AND restaurant_id = $1" : "";
  if (restaurantId) params.push(restaurantId);

  await db.query(
    `
      UPDATE subscriptions
         SET status = 'grace',
             grace_ends_at = COALESCE(grace_ends_at, current_period_end + INTERVAL '7 day'),
             updated_at = NOW()
       WHERE status IN ('trial', 'active', 'past_due')
         AND current_period_end < NOW()
         ${restaurantWhere}
    `,
    params,
  );

  await db.query(
    `
      UPDATE subscriptions
         SET status = 'suspended',
             updated_at = NOW()
       WHERE status = 'grace'
         AND COALESCE(grace_ends_at, current_period_end) < NOW()
         ${restaurantWhere}
    `,
    params,
  );
}

export async function ensureRestaurantSubscription(restaurantId: number) {
  await ensureSubscriptionSchema();
  await db.query(
    `
      INSERT INTO subscriptions (
        restaurant_id,
        plan_code,
        billing_interval,
        status,
        current_period_start,
        current_period_end,
        grace_ends_at,
        last_payment_at,
        activated_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        'starter',
        'monthly',
        'active',
        NOW(),
        NOW() + INTERVAL '30 day',
        NOW() + INTERVAL '37 day',
        NOW(),
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT (restaurant_id) DO NOTHING
    `,
    [restaurantId],
  );
}

export async function getRestaurantSubscriptionSnapshot(restaurantId: number | string) {
  const normalizedRestaurantId = Number(restaurantId);
  await ensureRestaurantSubscription(normalizedRestaurantId);
  await applySubscriptionTransitions(normalizedRestaurantId);

  const result = await db.query(
    `
      SELECT
        s.*,
        (s.status IN ('past_due', 'grace', 'suspended', 'cancelled')) AS access_blocked
      FROM subscriptions s
      WHERE s.restaurant_id = $1
      LIMIT 1
    `,
    [normalizedRestaurantId],
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

export async function getRestaurantWithSubscription(restaurantId: number | string) {
  const normalizedRestaurantId = Number(restaurantId);
  const restaurantResult = await db.query(
    "SELECT * FROM restaurants WHERE id = $1 LIMIT 1",
    [normalizedRestaurantId],
  );

  if (restaurantResult.rowCount === 0) {
    return null;
  }

  const subscription = await getRestaurantSubscriptionSnapshot(
    normalizedRestaurantId,
  );

  return {
    restaurant: restaurantResult.rows[0],
    subscription,
  };
}

export async function listRestaurantsWithSubscriptions(options?: {
  onlyPending?: boolean;
}) {
  await ensureSubscriptionSchema();
  await applySubscriptionTransitions();

  const params: unknown[] = [];
  const pendingWhere = options?.onlyPending ? "WHERE r.status = $1" : "";
  if (options?.onlyPending) params.push("pending");

  const result = await db.query(
    `
      SELECT
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
      LEFT JOIN subscriptions s
        ON s.restaurant_id = r.id
      ${pendingWhere}
      ORDER BY r.created_at DESC
    `,
    params,
  );

  return result.rows;
}

export async function renewRestaurantSubscription(input: {
  restaurantId: number;
  months?: number;
  planCode?: string;
  note?: string | null;
  activatedByUserId?: number | null;
}) {
  const months = Math.max(1, Number(input.months || 1));
  const snapshot = await getRestaurantSubscriptionSnapshot(input.restaurantId);
  const anchor =
    snapshot?.current_period_end && new Date(snapshot.current_period_end) > new Date()
      ? new Date(snapshot.current_period_end)
      : new Date();
  const periodStart = new Date();
  const periodEnd = addMonths(anchor, months);
  const graceEndsAt = addMonths(periodEnd, 0);
  graceEndsAt.setDate(graceEndsAt.getDate() + 7);

  await db.query(
    `
      UPDATE subscriptions
         SET plan_code = COALESCE($2, plan_code),
             status = 'active',
             current_period_start = $3,
             current_period_end = $4,
             grace_ends_at = $5,
             cancel_at_period_end = false,
             renewal_requested_at = NULL,
             renewal_request_note = COALESCE($6, renewal_request_note),
             last_payment_at = NOW(),
             activated_at = NOW(),
             updated_at = NOW()
       WHERE restaurant_id = $1
    `,
    [
      input.restaurantId,
      input.planCode || null,
      periodStart,
      periodEnd,
      graceEndsAt,
      input.note || null,
    ],
  );

  return getRestaurantSubscriptionSnapshot(input.restaurantId);
}

export async function updateRestaurantSubscriptionStatus(input: {
  restaurantId: number;
  status: SubscriptionStatus;
  note?: string | null;
  keepPeriod?: boolean;
}) {
  await getRestaurantSubscriptionSnapshot(input.restaurantId);

  await db.query(
    `
      UPDATE subscriptions
         SET status = $2,
             grace_ends_at = CASE
               WHEN $2 = 'grace' AND grace_ends_at IS NULL THEN NOW() + INTERVAL '7 day'
               WHEN $2 = 'active' THEN current_period_end + INTERVAL '7 day'
               ELSE grace_ends_at
             END,
             renewal_request_note = COALESCE($3, renewal_request_note),
             updated_at = NOW()
       WHERE restaurant_id = $1
    `,
    [input.restaurantId, input.status, input.note || null],
  );

  return getRestaurantSubscriptionSnapshot(input.restaurantId);
}

export async function requestRestaurantRenewal(input: {
  restaurantId: number;
  note?: string | null;
}) {
  await getRestaurantSubscriptionSnapshot(input.restaurantId);
  await db.query(
    `
      UPDATE subscriptions
         SET renewal_requested_at = NOW(),
             renewal_request_note = $2,
             updated_at = NOW()
       WHERE restaurant_id = $1
    `,
    [input.restaurantId, input.note || null],
  );

  return getRestaurantSubscriptionSnapshot(input.restaurantId);
}
