import { Elysia, t } from "elysia";
import { Orderscontroller } from "../Controller/Ordercontroller";
export const Orderrouter = (app: Elysia) => {
  app.group("/order", (app) => {
    app.post("/orderhistory", Orderscontroller.orderhistory, {
      body: t.Object({
        table_number: t.Optional(
          t.Number({
            minimum: 1,
            maximum: 11,
            error: "Quantity must be between 1-11",
          }),
        ),
      }),
    });
    return app;
  });
  return app;
};
