import { Elysia } from "elysia";
import { beforeadmin } from "../middleware/onlyadmin";

import { Admincontroller } from "../Controller/Admincontroller";

export const Adminrouter = (app: Elysia) => {
  return app.group("/admin", (app) => {
    app
      // .onBeforeHandle(beforeadmin)
      .get("/analytics", Admincontroller.analytics)
      .get("/getuser", Admincontroller.getalluser)
      .post("/updateuser", Admincontroller.updateuser)
      .post("/createuser", Admincontroller.createuser)
      .post("/upload-menu", Admincontroller.uploaddata)
      .patch("/menu/:id/availability", Admincontroller.updateMenuAvailability)
      .patch("/menu/:id", Admincontroller.updateMenu)
      .delete("/menu/:id", Admincontroller.deleteMenu)
      .post("/deleteuser", Admincontroller.deletedata);

    return app;
  });
};
