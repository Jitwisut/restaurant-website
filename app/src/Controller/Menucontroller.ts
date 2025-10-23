import { Context } from "elysia";
import { getDB } from "../lib/connect";
const db = getDB();
export const menucontroller = {
  getmenu: async ({ set }: { set: Context["set"] }) => {
    const query = "SELECT * FROM menu_new";
    const result = await db.query(query);
    const menu = result.rows.map((r: any) => {
      const base64 = r.image_blob
        ? Buffer.from(r.image_blob).toString("base64")
        : null;

      return {
        id: r.id,
        name: r.name,
        price: r.price,
        category: r.category,
        /* ถ้าไม่มีรูปให้ส่ง null เพื่อไม่พัง front-end */
        image: base64
          ? `data:${r.image_mime || "image/jpeg"};base64,${base64}`
          : null,
      };
    });
    return { menu: menu };
  },
};
