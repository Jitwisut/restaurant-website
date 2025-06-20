import { Elysia } from "elysia";
import { Tablecontroller } from "../Controller/Tablescontroller";
export const Tablerouter = (app: Elysia) => {
  return app.group("/tables", (app) => {
    app
      .get("/gettable", Tablecontroller.gettable)
      .post("/opentable", Tablecontroller.opentable)
      .post("/closetable", Tablecontroller.closetable)
      .get("/checktable/:session", Tablecontroller.checktabel);
    return app;
  });
};
