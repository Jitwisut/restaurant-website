import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import jwt from "@elysiajs/jwt";
import { Auths } from "./router/Auth";
import { Adminrouter } from "./router/Adminrouter";
import { Tablerouter } from "./router/Tablerouter";
import { middlewareadmin } from "./router/middlewarerouter";
import { menurouter } from "./router/menurouter";
import { web } from "./router/websocket";
import { profilerouter } from "./router/Profilerouter";
const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(
    jwt({
      name: "jwt",
      secret: "kormadi",
    })
  )
  .use(cors())
  .use(profilerouter)
  .use(middlewareadmin)
  .use(Tablerouter)
  .use(Adminrouter)
  .use(Auths)
  .use(menurouter)
  .use(web)
  .listen({
    port: 4000,
    //    hostname: "0.0.0.0"
  });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
