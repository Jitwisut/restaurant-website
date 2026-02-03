import { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { getDB } from "../lib/connect";
import { SigninHandler } from "../type/type";
const db = getDB();

export const Authcontroller = {
  signin: async ({ body, set, jwt }: SigninHandler) => {
    const { username, password } = body;

    if (!username || !password) {
      set.status = 400;
      return { message: "Error: Please complete all input fields" };
    }

    try {
      const result = await db.query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);

      if (result.rows.length === 0) {
        set.status = 404;
        return { message: "User not found" };
      }
      const user = result.rows[0];
      if (!user.password) {
        return { message: "Invalid credentials" };
      }
      const isMatch = await bcryptjs.compare(
        String(password),
        String(user.password),
      );
      if (!isMatch) {
        set.status = 400;
        return { message: "Error: Invalid password" };
      }

      const now = Math.floor(Date.now() / 1000);

      const payload = {
        username: user.username,
        email: user.email,
        role: user.role,
        iat: now,
      };

      const payloadRefresh = {
        ...payload,
        exp: now + 7 * 24 * 60 * 60,
      };

      const token = await jwt.sign(payload);
      const refreshToken = await jwt.sign(payloadRefresh);

      let redirectpath;
      if (user.role === "admin") {
        redirectpath = "/";
      } else if (user.role === "kitchen") {
        redirectpath = "/kitchen";
      } else if (user.role === "user") {
        redirectpath = "/wellcome";
      }

      return {
        message: "Success: You have logged in",
        token,
        refreshToken,
        redirectpath,
      };
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
      role: "admin" | "user" | "kitchen";
    };
    set: any;
  }) => {
    const { username, email, password, role } = body;
    //("username", username);
    if (!username || !email || !password || !role) {
      set.status = 400;
      return { message: "Error: Please complete all fields" };
    }

    try {
      const existing = await db.query(
        "SELECT * FROM users WHERE username = $1 OR email = $2",
        [username, email],
      );

      // ถ้ามีข้อมูลแล้ว
      if (existing.rows.length > 0) {
        set.status = 409; // Conflict
        return { message: "Error: Username or Email already exists" };
      }

      const hashedPassword = await bcryptjs.hash(password, 10);

      await db.query(
        "INSERT INTO users (username, email, password, role) VALUES ($1, $2,$3,$4)",
        [username, email, hashedPassword, role],
      );

      set.status = 201;
      return { message: "Success: User registered successfully" };
    } catch (error) {
      set.status = 500;
      console.error(error);
      return { message: (error as Error).message };
    }
  },
};
