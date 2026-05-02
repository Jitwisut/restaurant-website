import { Context } from "elysia";
import bcryptjs from "bcryptjs";
import { getDB } from "../lib/connect";
import { requireRole } from "../middleware/restaurantScope";

const db = getDB();

export const Admincontroller = {
  getalluser: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    try {
      const result = await db.query(
        "SELECT * FROM users WHERE restaurant_id=$1",
        [scope.restaurantId],
      );
      const usersRaw = result.rows;

      if (!Array.isArray(usersRaw)) {
        throw new Error("Query result is not an array");
      }

      const users = usersRaw as { role: string }[];
      const roles = users.reduce((acc: Record<string, number>, user) => {
        if (user.role) acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      set.status = 200;
      return {
        user: users,
        count: users.length,
        roles,
      };
    } catch (error) {
      console.error("Backend error:", (error as Error).message);
      set.status = 500;
      return {
        message: "Error fetching users",
        detail: (error as Error).message,
      };
    }
  },

  updateuser: async (
    context: Context & {
      body: { username: string; email: string; role: string; originuser: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    try {
      const { originuser, username, email, role } = body;
      const duplicateUsername = await db.query(
        `SELECT 1
           FROM users
          WHERE restaurant_id=$1
            AND username=$2
            AND username<>$3`,
        [scope.restaurantId, username, originuser],
      );
      if (duplicateUsername.rowCount > 0) {
        set.status = 400;
        return { message: "Username already exist in this restaurant" };
      }

      const duplicateEmail = await db.query(
        `SELECT 1
           FROM users
          WHERE LOWER(email)=LOWER($1)
            AND NOT (restaurant_id=$2 AND username=$3)`,
        [email, scope.restaurantId, originuser],
      );
      if (duplicateEmail.rowCount > 0) {
        set.status = 400;
        return { message: "Email already exist" };
      }

      const result = await db.query(
        "UPDATE users SET username=$1, email=$2, role=$3 WHERE username=$4 AND restaurant_id=$5",
        [username, email.trim().toLowerCase(), role, originuser, scope.restaurantId],
      );

      if (result.rowCount === 0) {
        set.status = 404;
        return { message: "User not found in this restaurant" };
      }

      set.status = 200;
      return { message: `Success update user ${username}` };
    } catch (error) {
      console.error("Error in updateuser:", error);
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  createuser: async (
    context: Context & {
      body: { username: string; email: string; password: string; role: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    if (!body.username || !body.email || !body.password || !body.role) {
      set.status = 400;
      return { message: "Please fill all field" };
    }

    try {
      const resultemail = await db.query(
        "SELECT email FROM users WHERE LOWER(email)=LOWER($1)",
        [body.email],
      );
      const user = await db.query(
        "SELECT * FROM users WHERE restaurant_id=$1 AND username=$2",
        [scope.restaurantId, body.username],
      );

      if (user.rowCount > 0) {
        set.status = 400;
        return { message: "Username already exist in this restaurant" };
      }
      if (resultemail.rowCount > 0) {
        set.status = 400;
        return { message: "Email already exist" };
      }

      const hashpass = await bcryptjs.hash(body.password, 10);
      const email = body.email.trim().toLowerCase();
      const result = await db.query(
        "INSERT INTO users (username,email,password,role,restaurant_id) VALUES ($1,$2,$3,$4,$5)",
        [body.username, email, hashpass, body.role, scope.restaurantId],
      );

      if (result.rowCount > 0) {
        set.status = 201;
        return { message: "Success create user" };
      }
    } catch (error) {
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  uploaddata: async (
    context: Context & {
      body: {
        name: string;
        price: string;
        image: File;
        category: string;
        description: string;
      };
      jwt?: any;
    },
  ) => {
    const { body, set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const { name, price, category, description } = body;
    const image = body.image as File;
    const buffer = new Uint8Array(await image.arrayBuffer());
    if (!name || !price) {
      set.status = 400;
      return { message: "Please Enter value" };
    }

    try {
      await db.query(
        "INSERT INTO menu_new (name,price,image_blob,image_mime,category,description,restaurant_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [name, price, buffer, image.type, category, description, scope.restaurantId],
      );
    } catch (err) {
      console.error("error", err);
      set.status = 500;
      return { message: (err as Error).message };
    }

    return { message: "Success" };
  },

  deletedata: async (
    context: Context & {
      body: { username: string };
      jwt?: any;
    },
  ) => {
    const { body, set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const { username } = body;
    if (!username) {
      set.status = 400;
      return { message: "Please Enter username" };
    }

    const result = await db.query(
      "DELETE FROM users WHERE username=$1 AND restaurant_id=$2",
      [username, scope.restaurantId],
    );

    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "User not found in this restaurant" };
    }

    set.status = 201;
    return { message: "Success Delete user" };
  },
};
