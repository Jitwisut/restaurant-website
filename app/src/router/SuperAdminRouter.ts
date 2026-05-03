import { Elysia, t } from "elysia";
import { SuperAdminController } from "../Controller/SuperAdminController";

const reasonBody = t.Object({
  reason: t.Optional(t.String()),
});

export const SuperAdminRouter = (app: Elysia) => {
  return app.group("/superadmin", (app) =>
    app
      .get("/restaurants", SuperAdminController.listRestaurants, {
        query: t.Object({
          q: t.Optional(t.String()),
          status: t.Optional(t.String()),
          plan: t.Optional(t.String()),
          subscription_status: t.Optional(t.String()),
          page: t.Optional(t.String()),
          pageSize: t.Optional(t.String()),
          sort: t.Optional(t.String()),
        }),
      })
      .get("/restaurants/:id", SuperAdminController.getRestaurant)
      .get("/stats", SuperAdminController.stats)
      .get("/system-health", SuperAdminController.systemHealth)
      .get("/billing/requests", SuperAdminController.billingRequests, {
        query: t.Object({
          status: t.Optional(t.String()),
        }),
      })
      .get("/billing/requests/:id/proof", SuperAdminController.billingProof)
      .post(
        "/billing/requests/:id/approve",
        SuperAdminController.approveBillingRequest,
        {
          body: t.Object({
            note: t.Optional(t.String()),
          }),
        },
      )
      .post(
        "/billing/requests/:id/reject",
        SuperAdminController.rejectBillingRequest,
        {
          body: t.Object({
            note: t.Optional(t.String()),
          }),
        },
      )
      .get("/audit", SuperAdminController.audit, {
        query: t.Object({
          restaurant_id: t.Optional(t.String()),
          actor: t.Optional(t.String()),
          action: t.Optional(t.String()),
          page: t.Optional(t.String()),
          pageSize: t.Optional(t.String()),
        }),
      })
      .post("/restaurants/:id/impersonate", SuperAdminController.impersonate, {
        body: reasonBody,
      })
      .post(
        "/restaurants/:id/status/:status",
        SuperAdminController.updateRestaurantStatus,
        { body: reasonBody },
      )
      .post("/restaurants/:id/approve", (context) =>
        SuperAdminController.updateRestaurantStatus({
          ...context,
          params: { id: context.params.id, status: "active" },
        } as any),
      )
      .post("/restaurants/:id/reject", (context) =>
        SuperAdminController.updateRestaurantStatus({
          ...context,
          params: { id: context.params.id, status: "inactive" },
        } as any),
        { body: reasonBody },
      )
      .post("/restaurants/:id/suspend", (context) =>
        SuperAdminController.updateRestaurantStatus({
          ...context,
          params: { id: context.params.id, status: "suspended" },
        } as any),
        { body: reasonBody },
      )
      .post("/restaurants/:id/archive", (context) =>
        SuperAdminController.updateRestaurantStatus({
          ...context,
          params: { id: context.params.id, status: "archived" },
        } as any),
        { body: reasonBody },
      )
      .post("/restaurants/:id/restore", (context) =>
        SuperAdminController.updateRestaurantStatus({
          ...context,
          params: { id: context.params.id, status: "active" },
        } as any),
        { body: reasonBody },
      )
      .post("/restaurants/:id/delete", (context) =>
        SuperAdminController.updateRestaurantStatus({
          ...context,
          params: { id: context.params.id, status: "deleted" },
        } as any),
        { body: reasonBody },
      )
      .post(
        "/restaurants/:id/subscription/renew",
        SuperAdminController.renewSubscription,
        {
          body: t.Object({
            months: t.Optional(t.Number({ minimum: 1, maximum: 24 })),
            plan_code: t.Optional(t.String()),
            note: t.Optional(t.String()),
            reason: t.Optional(t.String()),
          }),
        },
      )
      .post(
        "/restaurants/:id/subscription/status",
        SuperAdminController.updateSubscriptionStatus,
        {
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
            reason: t.Optional(t.String()),
          }),
        },
      )
      .post("/subscription/run-cycle", SuperAdminController.runSubscriptionCycle),
  );
};
