import { Context } from "elysia";
import type { AppContext } from "../type/type";
interface ProfilePayload {
  username: string;
  email: string;
  role: string;
  iat: string;
}

interface MyStore {
  decode?: {
    decode: ProfilePayload;
  };
}

export const Profilecontroller = {
  getprofile: async (context: Context) => {
    const { jwt, cookie, set } = context as AppContext;
    const token = cookie.kitchen_auth?.value || cookie.auth?.value;
    if (!token) {
      set.status = 401;
      return { message: "Please login" };
    }
    const decode = await jwt.verify(token);
    //(decode);
    const user = decode.username;
    const role = decode.role;
    set.status = 200;
    return { message: "Success", user: user, role: role };
  },
  getkitchenprofile: async (context: Context) => {
    const { jwt, cookie, set } = context as AppContext;
    const token = cookie.kitchen_auth.value;
    if (!token) {
      set.status = 401;
      return { message: "Please login" };
    }
    const decode = await jwt.verify(token);
    //(decode);
    const user = decode.username;
    const role = decode.role;
    set.status = 200;
    return { message: "Success", user: user, role: role };
  },
};
