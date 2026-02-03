import { Elysia, t } from "elysia";
import { Tablecontroller } from "../Controller/Tablescontroller";
import { rateLimit } from "elysia-rate-limit";

export const Tablerouter = (app: Elysia) => {
  return app.group("/tables", (app) => {
    const gettableLimit = new Elysia()
      .use(
        rateLimit({
          scoping: "scoped",
          duration: 60000, //60s
          max: 10,
          errorResponse: new Response(
            "มีการเรียกใช้งานมากเกินไป กรุณารอสักครู่",
            {
              status: 429,
              headers: new Headers({
                "Content-Type": "text/plain; charset=utf-8",
                "Retry-After": "60",
                "Custom-Header": "custom",
              }),
            },
          ),
        }),
      )
      .get("/gettable", Tablecontroller.gettable);
    app
      .use(gettableLimit)
      .post("/opentable", Tablecontroller.opentable)
      .post(
        "/closetable",
        Tablecontroller.closetable /*, {
        body: t.Object({
          number: t.Number(),
        }),
      }*/,
      )
      .get("/checktable/:session", Tablecontroller.checktabel)

      .post("/ordersuccess", Tablecontroller.ordersuccess, {
        body: t.Object({
          table_number: t.Optional(
            t.Number({
              minimum: 1,
              maximum: 11,
              error: "Quantity must be between 1-11",
            }),
          ),
        }),
      })
      .post("/addtable", Tablecontroller.addtable);
    return app;
  });
};
