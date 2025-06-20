import { Elysia } from "elysia";
import { menucontroller } from "../Controller/Menucontroller";
export const menurouter = (app: Elysia) => {
  return app.group("/menu", (app) => {
    app.get("/get", menucontroller.getmenu);

    return app;
  });
};
