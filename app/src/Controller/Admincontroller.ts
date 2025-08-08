import { Context } from "elysia";
import { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
const db = new Database("user.sqlite");
const dbres = new Database("restaurant.sqlite");
export const Admincontroller = {
  getalluser: async ({ set }: Context) => {
    try {
      let usersRaw = db.query("SELECT * FROM user").all();

      // ตรวจสอบความถูกต้องก่อนใช้
      if (!Array.isArray(usersRaw)) {
        throw new Error("Query result is not an array");
      }

      const users = usersRaw as { role: string }[];
      const total = users.length;

      const roles = users.reduce((acc: Record<string, number>, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
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
      return { message: "เกิดข้อผิดพลาด", detail: (error as Error).message };
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
        "UPDATE user SET username=?, email=?, role=? WHERE username=?";
      const result = db.prepare(query).run(username, email, role, originuser);

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
      let query = "SELECT * FROM user WHERE username=?";
      const user = db.prepare(query).get(body.username);
      if (user) {
        set.status = 400;
        return { message: "Username already exist" };
      }
      const hashpass = await bcryptjs.hash(body.password, 10);
      query =
        "INSERT INTO user (username,email,password,role) VALUES (?,?,?,?)";
      db.prepare(query).run(body.username, body.email, hashpass, body.role);
      set.status = 201;
      return { message: "Success create user" };
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
      dbres
        .query(
          "INSERT INTO menu_new (name,price,image_blob,image_mime,category,description) VALUES (?,?,?,?,?,?)"
        )
        .run(name, price, buffer, image.type, category, description);
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
    const query = "DELETE FROM user WHERE username=?";
    const result = db.prepare(query).run(username);
    if (!result.changes) {
      console.warn("ไม่พบผู้ใช้ที่จะลบ");
    } else {
      console.log("แก้ไขเรียบร้อย");
    }
    set.status = 201;
    return { message: "Success Delete user" };
  },
};
