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
  getprofile: ({ set, store }: Context) => {
    store as AppContext;
    if (!(store as MyStore).decode) {
      set.status = 400;
      return { message: "Error: Please login" };
    }

    const user = (store as MyStore).decode?.decode.username;

    const role = (store as MyStore).decode?.decode.role;
    return { message: "Success", user: user, role: role };
  },
};
