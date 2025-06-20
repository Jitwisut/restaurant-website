import { Context } from "elysia";
import { Database } from "bun:sqlite";
const db = new Database("restaurant.sqlite");
export const menucontroller = {
  getmenu: ({ set }: { set: Context["set"] }) => {
    const query = "SELECT * FROM menu_new";
    const result = db.prepare(query).all();
    const menu = result.map((r: any) => {
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
