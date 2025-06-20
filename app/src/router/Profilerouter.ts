import { Elysia } from "elysia";
import { Profilecontroller } from "../Controller/Profilecontroller";
import { beforeadmin } from "../middleware/onlyadmin";
export const profilerouter = (app: Elysia) => {
  return app.group("/profile", (app) => {
    app.get("/", Profilecontroller.getprofile);
    return app;
  });
};
