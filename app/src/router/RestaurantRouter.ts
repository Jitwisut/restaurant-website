import { Elysia, t } from "elysia";
import { RestaurantController } from "../Controller/RestaurantController";

export const RestaurantRouter = (app: Elysia) => {
  return app.group("/restaurant", (app) => {
    app
      .post("/create", RestaurantController.create, {
        body: t.Object({
          name: t.String(),
          slug: t.Optional(t.String()),
          status: t.Optional(
            t.Union([
              t.Literal("active"),
              t.Literal("pending"),
              t.Literal("suspended"),
              t.Literal("inactive"),
            ]),
          ),
          plan: t.Optional(t.String()),
          username: t.String(),
          email: t.String(),
          password: t.String(),
          role: t.Optional(
            t.Union([t.Literal("owner"), t.Literal("admin")]),
          ),
        }),
      })
      .post("/register", RestaurantController.register, {
        body: t.Object({
          name: t.String(),
          slug: t.Optional(t.String()),
        }),
      })
      .get("/me", RestaurantController.me)
      .get("/subscription", RestaurantController.subscription)
      .post("/subscription/request-renewal", RestaurantController.requestRenewal, {
        body: t.Object({
          note: t.Optional(t.String()),
        }),
      })
      .post("/subscription/run-cycle", RestaurantController.runSubscriptionCycle)
      .put("/me", RestaurantController.updateMe, {
        body: t.Object({
          name: t.Optional(t.String()),
          slug: t.Optional(t.String()),
        }),
      })
      .get("/all", RestaurantController.list)
      .get("/pending", RestaurantController.pending)
      .post("/:id/subscription/renew", RestaurantController.renew, {
        body: t.Object({
          months: t.Optional(t.Number({ minimum: 1, maximum: 24 })),
          plan_code: t.Optional(t.String()),
          note: t.Optional(t.String()),
        }),
      })
      .post("/:id/subscription/status", RestaurantController.updateSubscriptionStatus, {
        body: t.Object({
          status: t.Union([
            t.Literal("trial"),
            t.Literal("active"),
            t.Literal("past_due"),
            t.Literal("grace"),
            t.Literal("suspended"),
            t.Literal("cancelled"),
          ]),
          note: t.Optional(t.String()),
        }),
      })
      .post("/:id/impersonate", RestaurantController.impersonate)
      .post("/:id/approve", RestaurantController.approve)
      .post("/:id/suspend", RestaurantController.suspend)
      .post("/:id/reject", RestaurantController.reject)
      .post("/:id/status/:status", RestaurantController.setStatus);

    return app;
  });
};
