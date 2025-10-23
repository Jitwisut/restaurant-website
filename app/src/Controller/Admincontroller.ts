import { Context } from "elysia";
import { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { join } from "path";
import { getDB } from "../lib/connect";
import { mkdir, writeFile } from "fs/promises";
const db = getDB();
export const Admincontroller = {
  getalluser: async ({ set }: Context) => {
    try {
      // ใช้ await สำหรับ async query ใน PostgreSQL
      const result = await db.query("SELECT * FROM users");
      const usersRaw = result.rows;

      // ตรวจสอบความถูกต้องก่อนใช้
      if (!Array.isArray(usersRaw)) {
        throw new Error("Query result is not an array");
      }

      const users = usersRaw as { role: string }[];
      const total = users.length;

      // นับจำนวน role แต่ละประเภท
      const roles = users.reduce((acc: Record<string, number>, user) => {
        if (user.role) {
          // ตรวจสอบว่า role มีค่า
          acc[user.role] = (acc[user.role] || 0) + 1;
        }
        return acc;
      }, {});

      set.status = 200;
      return {
        user: users,
        count: total,
        roles,
      };
    } catch (error) {
      console.error("Backend error:", (error as Error).message);
      set.status = 500;
      return {
        message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้",
        detail: (error as Error).message,
      };
    }
  },
  updateuser: async ({
    set,
    body,
  }: {
    set: Context["set"];
    body: { username: string; email: string; role: string; originuser: string };
  }) => {
    try {
      const { originuser, username, email, role } = body;

      const query =
        "UPDATE users SET username=$1, email=$2, role=$3 WHERE username=$4";
      const result = await db.query(query, [username, email, role, originuser]);

      set.status = 200;
      return { message: `Success update user ${username}` };
    } catch (error) {
      console.error("Error in updateuser:", error); // ใช้ logger
      set.status = 500;
      return { message: (error as Error).message };
    }
  },
  createuser: async ({
    set,
    body,
  }: {
    set: Context["set"];
    body: { username: string; email: string; password: string; role: string };
  }) => {
    if (!body.username || !body.email || !body.password || !body.role) {
      set.status = 400;
      return { message: "Please fill all field" };
    }

    try {
      let query = "SELECT * FROM users WHERE username=$1";
      let checkemail = "SELECT email from users WHERE email=$1";
      const resultemail = await db.query(checkemail, [body.email]);
      const user = await db.query(query, [body.username]);
      if (user.rowCount > 0) {
        set.status = 400;
        return { message: "Username already exist" };
      }
      if (resultemail.rowCount > 0) {
        set.status = 400;
        return { message: "Email already exist" };
      }
      const hashpass = await bcryptjs.hash(body.password, 10);
      const email = body.email.trim().toLowerCase();
      query =
        "INSERT INTO users (username,email,password,role) VALUES ($1,$2,$3,$4)";
      const result = await db.query(query, [
        body.username,
        email,
        hashpass,
        body.role,
      ]);
      if (result.rowCount > 0) {
        set.status = 201;
        return { message: "Success create user" };
      }
    } catch (error) {
      set.status = 500;
      return { message: (error as Error).message };
    }
  },
  uploaddata: async ({
    body,
    set,
  }: {
    body: {
      name: string;
      price: string;
      image_blob: string;
      image_mime: string;
      file: Blob;
      image: File;
      category: string;
      description: string;
    };
    set: Context["set"];
  }) => {
    const { name, price, category, description } = body;
    const image = body.image as File;
    const buffer = new Uint8Array(await image.arrayBuffer());
    if (!name || !price) {
      set.status = 400;
      return { message: "Please Enter value" };
    }
    try {
      db.query(
        "INSERT INTO menu_new (name,price,image_blob,image_mime,category,description) VALUES ($1,$2,$3,$4,$5,$6)",
        [name, price, buffer, image.type, category, description]
      );
    } catch (err) {
      console.error("error", err);
    }

    return { message: "Success" };
  },
  deletedata: async ({
    body,
    set,
  }: {
    body: { username: string };
    set: Context["set"];
  }) => {
    const { username } = body;
    if (!username) {
      set.status = 400;
      return { message: "Please Enter username" };
    }
    const query = "DELETE FROM users WHERE username=$1";
    const result = db.query(query, [username]);
    if (result.rowCount === 0) {
      console.warn("ไม่พบผู้ใช้ที่จะลบ");
    } else {
      console.log("แก้ไขเรียบร้อย");
    }
    set.status = 201;
    return { message: "Success Delete user" };
  },
};
