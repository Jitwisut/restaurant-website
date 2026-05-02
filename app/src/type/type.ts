import type { Context } from "elysia";
export interface User {
  username: string;
  password: string;
  email: string;
  role: string;
}

// ถ้าคุณมี store แบบนี้
export interface Store {
  decode?: {
    decode: {
      role: "admin" | "user" | "kitchen" | "owner" | "staff" | "superadmin";
      username: string;
      email: string;
      restaurant_id?: number | null;
      iat: number;
    };
  };
}

// รวมทุกอย่างให้กลายเป็น AppContext
export type AppContext = Context & {
  store: Store;
  jwt: any;
  cookie: Context["cookie"];
  set: Context["set"];
  headers: Context["headers"];
};

export type SigninHandler = {
  body: { email: string; password: string };
  set: any;
  jwt: any;
  cookie: any;
};
