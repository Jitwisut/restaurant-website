import { Elysia, t } from "elysia";
import { Orderscontroller } from "../Controller/Ordercontroller";
export const Orderrouter = (app: Elysia) => {
  app.group("/order", (app) => {
    app.get("/active", Orderscontroller.active);
    app.get("/ready-to-serve", Orderscontroller.readyToServe);
    app.post("/orderhistory", Orderscontroller.orderhistory, {
      body: t.Object({
        table_number: t.Optional(
          t.Number({
            minimum: 1,
            maximum: 14,
            error: "Quantity must be between 1-14",
          }),
        ),
        status: t.Optional(t.String()),
        payment_status: t.Optional(t.String()),
      }),
    });
    app.post("/:id/status", Orderscontroller.updateStatus, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.String(),
        reason: t.Optional(t.String()),
      }),
    });
    app.post("/:id/served", Orderscontroller.markServed, {
      params: t.Object({ id: t.String() }),
      body: t.Optional(
        t.Object({
          note: t.Optional(t.String()),
        }),
      ),
    });
    return app;
  });
  app.group("/payments", (app) => {
    app.get("/pending", Orderscontroller.pendingPayments);
    app.post("/:id/submit-proof", Orderscontroller.submitProof, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reference: t.Optional(t.String()),
        note: t.Optional(t.String()),
      }),
    });
    app.post("/:id/approve", Orderscontroller.approvePayment, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        note: t.Optional(t.String()),
      }),
    });
    app.post("/:id/reject", Orderscontroller.rejectPayment, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.Optional(t.String()),
      }),
    });
    app.post("/:id/refund", Orderscontroller.refundPayment, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.Optional(t.String()),
      }),
    });
    app.post("/:id/void", Orderscontroller.voidPayment, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.Optional(t.String()),
      }),
    });
    return app;
  });
  return app;
};
