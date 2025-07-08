import { Elysia } from "elysia";
import { beforeadmin } from "../middleware/onlyadmin";

import { Admincontroller } from "../Controller/Admincontroller";

export const Adminrouter = (app: Elysia) => {
  return app.group("/admin", (app) => {
    app
      // .onBeforeHandle(beforeadmin)
      .get("/getuser", Admincontroller.getalluser)
      .post("/updateuser", Admincontroller.updateuser)
      .post("/createuser", Admincontroller.createuser)
      .post("/upload-menu", Admincontroller.uploaddata);
    return app;
  });
};
