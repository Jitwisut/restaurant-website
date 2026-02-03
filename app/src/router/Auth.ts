import { Elysia, t } from "elysia";
import { Authcontroller } from "../Controller/Authcontroller";
import { afterhanlerUser } from "../middleware/Afterhanler";
import jwt from "@elysiajs/jwt";
export const Auths = (app: Elysia) => {
  return app.group("/auth", (app) => {
    app

      .post("/signin", Authcontroller.signin, {
        body: t.Optional(
          t.Object({
            username: t.String(),
            password: t.String(),
          }),
        ),
      })
      .post("/signup", Authcontroller.signup, {
        body: t.Object({
          username: t.String(),
          email: t.String(),
          password: t.String(),
          role: t.Union([
            t.Literal("admin"),
            t.Literal("user"),
            t.Literal("kitchen"),
          ]),
        }),
      });
    return app;
  });
};
