import { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";

const db = new Database("user.sqlite");

export const Authcontroller = {
  signin: async ({
    body,
    set,
    jwt,
    cookie,
  }: {
    body: { username: string; password: string };
    set: any;
    jwt: any;
    cookie: any;
  }) => {
    const { username, password } = body;

    if (!username || !password) {
      set.status = 400;
      return { message: "Error: Please complete all input fields" };
    }

    try {
      const result = await db
        .prepare("SELECT * FROM user WHERE username = ?")
        .get(username);

      if (!result) {
        set.status = 404;
        return { message: "Error: Username not found" }; // ❌ อย่า throw ใน logic ทั่วไป
      }

      const user = result as {
        username: string;
        email: string;
        password: string;
        role: "admin" | "user" | "kitchen";
      };

      const isMatch = await bcryptjs.compare(password, user.password);
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

      cookie.auth.set({
        value: token,
        httpOnly: true,
        path: "/",
        maxAge: 60 * 30,
        secure: process.env.NODE_ENV === "production",
      });
      let redirectpath;
      if (user.role === "admin") {
        redirectpath = "/admin";
      } else if (user.role === "kitchen") {
        redirectpath = "/kitchen";
      } else if (user.role === "user") {
        redirectpath = "/wellcome";
      }

      return {
        message: "Success: You have logged in",
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
    console.log("username", username);
    if (!username || !email || !password || !role) {
      set.status = 400;
      return { message: "Error: Please complete all fields" };
    }

    try {
      const existing = await db
        .prepare("SELECT * FROM user WHERE username = ? OR email = ?")
        .get(username, email);

      if (existing) {
        set.status = 409;
        return { message: "Error: Username or Email already exists" };
      }

      const hashedPassword = await bcryptjs.hash(password, 10);

      await db
        .prepare(
          "INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)"
        )
        .run(username, email, hashedPassword, role);

      set.status = 201;
      return { message: "Success: User registered successfully" };
    } catch (error) {
      set.status = 500;
      console.error(error);
      return { message: (error as Error).message };
    }
  },
};
