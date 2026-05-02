import bcryptjs from "bcryptjs";
import { getDB } from "../lib/connect";
import {
  ensureRestaurantSubscription,
  getRestaurantSubscriptionSnapshot,
  isSubscriptionBlocked,
} from "../lib/subscription";
import { SigninHandler } from "../type/type";
import { normalizeRestaurantId } from "../middleware/restaurantScope";

const db = getDB();

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function buildRedirectPath(
  user: { role: string; restaurant_status?: string | null },
  subscription?: { status?: string } | null,
) {
  if (
    user.restaurant_status === "pending" &&
    (user.role === "admin" || user.role === "owner")
  ) {
    return "/restaurant/pending";
  }

  if (
    user.restaurant_status &&
    user.restaurant_status !== "active" &&
    user.role !== "superadmin"
  ) {
    return "/restaurant/suspended";
  }

  if (
    user.role !== "superadmin" &&
    subscription &&
    isSubscriptionBlocked(subscription.status)
  ) {
    return user.role === "owner" || user.role === "admin"
      ? "/restaurant/billing"
      : "/restaurant/suspended";
  }

  if (user.role === "superadmin") return "/superadmin";
  if (user.role === "admin" || user.role === "owner") return "/";
  if (user.role === "kitchen") return "/kitchen";
  if (user.role === "user" || user.role === "staff") return "/wellcome";
  return "/";
}

async function buildSessionResponse(user: any, jwt: any) {
  const restaurantId =
    user.restaurant_id === null || user.restaurant_id === undefined
      ? null
      : normalizeRestaurantId(user.restaurant_id);
  let subscription = null;

  if (restaurantId !== null) {
    await ensureRestaurantSubscription(restaurantId);
    subscription = await getRestaurantSubscriptionSnapshot(restaurantId);
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    username: user.username,
    email: user.email,
    role: user.role,
    restaurant_id: restaurantId,
    iat: now,
  };
  const refreshPayload = {
    ...payload,
    exp: now + 7 * 24 * 60 * 60,
  };

  return {
    message: "Success: You have logged in",
    token: await jwt.sign(payload),
    refreshToken: await jwt.sign(refreshPayload),
    role: user.role,
    username: user.username,
    email: user.email,
    restaurant_id: restaurantId,
    restaurant: restaurantId
      ? {
          id: restaurantId,
          slug: user.restaurant_slug,
          name: user.restaurant_name,
          status: user.restaurant_status,
        }
      : null,
    subscription,
    redirectpath: buildRedirectPath(user, subscription),
  };
}

async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcryptjs.compare(String(password), String(hash));
}

export const Authcontroller = {
  signin: async ({ body, set, jwt }: SigninHandler) => {
    const { email, password } = body;

    if (!email || !password) {
      set.status = 400;
      return { message: "Error: Please complete all input fields" };
    }

    try {
      const result = await db.query(
        `SELECT
            u.*,
            r.status AS restaurant_status,
            r.slug AS restaurant_slug,
            r.name AS restaurant_name
           FROM users u
           LEFT JOIN restaurants r ON r.id = u.restaurant_id
          WHERE LOWER(u.email) = LOWER($1)
            AND u.role IN ('owner', 'admin', 'superadmin')
          LIMIT 1`,
        [email],
      );

      if (result.rows.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      const user = result.rows[0];
      if (!(await verifyPassword(password, user.password))) {
        set.status = 400;
        return { message: "Error: Invalid password" };
      }

      return buildSessionResponse(user, jwt);
    } catch (error) {
      set.status = 500;
      console.error(error);
      return { message: (error as Error).message };
    }
  },

  staffSignin: async ({
    body,
    set,
    jwt,
  }: {
    body: { slug: string; username: string; password: string };
    set: any;
    jwt: any;
  }) => {
    const slug = toSlug(body.slug || "");
    const username = body.username?.trim();
    const password = body.password;

    if (!slug || !username || !password) {
      set.status = 400;
      return { message: "Error: Please complete all input fields" };
    }

    try {
      const result = await db.query(
        `SELECT
            u.*,
            r.status AS restaurant_status,
            r.slug AS restaurant_slug,
            r.name AS restaurant_name
           FROM restaurants r
           JOIN users u ON u.restaurant_id = r.id
          WHERE r.slug = $1
            AND u.username = $2
            AND u.role IN ('staff', 'kitchen', 'user')
          LIMIT 1`,
        [slug, username],
      );

      if (result.rows.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      const user = result.rows[0];
      if (!(await verifyPassword(password, user.password))) {
        set.status = 400;
        return { message: "Error: Invalid password" };
      }

      return buildSessionResponse(user, jwt);
    } catch (error) {
      set.status = 500;
      console.error(error);
      return { message: (error as Error).message };
    }
  },

  signup: async ({
    body,
    set,
  }: {
    body: {
      username: string;
      email: string;
      password: string;
      role: "admin" | "user" | "kitchen" | "owner" | "staff" | "superadmin";
      restaurant_name?: string;
      restaurant_slug?: string;
    };
    set: any;
  }) => {
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const role = body.role;

    if (!username || !email || !password || !role) {
      set.status = 400;
      return { message: "Error: Please complete all fields" };
    }

    try {
      const hashedPassword = await bcryptjs.hash(password, 10);
      let restaurantId: number | null = null;

      if (role === "admin" || role === "owner") {
        const existing = await db.query(
          "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)",
          [email],
        );
        if (existing.rows.length > 0) {
          set.status = 409;
          return { message: "Error: Email already exists" };
        }

        const restaurantName =
          body.restaurant_name?.trim() || `${username}'s Restaurant`;
        const baseSlug =
          toSlug(body.restaurant_slug || restaurantName || username) ||
          `restaurant-${Date.now()}`;
        const restaurant = await db.query(
          `INSERT INTO restaurants (name, slug, status, plan)
           VALUES ($1, $2, 'pending', 'free')
           RETURNING id`,
          [restaurantName, baseSlug],
        );
        restaurantId = restaurant.rows[0].id;
        await ensureRestaurantSubscription(restaurantId);
      } else if (role === "superadmin") {
        const existing = await db.query(
          "SELECT 1 FROM users WHERE username = $1 OR LOWER(email) = LOWER($2)",
          [username, email],
        );
        if (existing.rows.length > 0) {
          set.status = 409;
          return { message: "Error: Username or Email already exists" };
        }
      } else {
        const slug = toSlug(body.restaurant_slug || "");
        if (!slug) {
          set.status = 400;
          return { message: "Restaurant slug is required for staff users" };
        }

        const restaurant = await db.query(
          "SELECT id FROM restaurants WHERE slug=$1 AND status='active' LIMIT 1",
          [slug],
        );
        if (restaurant.rowCount === 0) {
          set.status = 404;
          return { message: "Restaurant not found" };
        }

        restaurantId = restaurant.rows[0].id;
        const existing = await db.query(
          "SELECT 1 FROM users WHERE restaurant_id=$1 AND username=$2",
          [restaurantId, username],
        );
        if (existing.rows.length > 0) {
          set.status = 409;
          return { message: "Error: Username already exists in this restaurant" };
        }
      }

      await db.query(
        "INSERT INTO users (username, email, password, role, restaurant_id) VALUES ($1, $2, $3, $4, $5)",
        [username, email, hashedPassword, role, restaurantId],
      );

      set.status = 201;
      return { message: "Success: User registered successfully" };
    } catch (error) {
      const dbError = error as { code?: string; message?: string };
      if (dbError.code === "23505") {
        set.status = 409;
        return { message: "Error: Username or Email already exists" };
      }

      set.status = 500;
      console.error(error);
      return { message: (error as Error).message };
    }
  },

  test: async ({ set, body }: { set: any; body: { password: string } }) => {
    const hashedPassword = await bcryptjs.hash(body.password, 10);
    return {
      hash: hashedPassword,
      default: body.password,
    };
  },
};
