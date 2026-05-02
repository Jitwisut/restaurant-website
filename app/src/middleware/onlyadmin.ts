import type { Context } from "elysia";
import type { AppContext } from "../type/type";
export const beforeadmin = async (context: Context) => {
  const { store, jwt, cookie, set, headers } = context as AppContext;

  const authhead = headers["authorization"];
  const token = authhead?.split(" ")[1];
  if (!token) {
    set.status = 401;
    return { message: "Unauthorized: Please login" };
  }

  const decode = await jwt.verify(token);
  
  if (!decode) {
    set.status = 401;
    return { message: "Unauthorized: Invalid token" };
  }

  if (!["admin", "owner", "superadmin"].includes(decode.role)) {
    set.status = 403;
    return { message: "Forbidden: Not an admin" };
  }
  return { message: "You are admin", user: decode };
};
