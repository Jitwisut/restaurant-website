import { Elysia, t } from "elysia";
import { Authcontroller } from "../Controller/Authcontroller";
import { afterhanlerUser } from "../middleware/Afterhanler";
export const Auths = (app: Elysia) => {
  return app.group("/auth", (app) => {
    app
      .post("/signin", Authcontroller.signin, {
        body: t.Object({
          username: t.String(),
          password: t.String(),
        }),
      })
      .post("/signup", Authcontroller.signup);
    return app;
  });
};
