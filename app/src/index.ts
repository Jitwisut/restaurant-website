import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import jwt from "@elysiajs/jwt";
import { elysiaHelmet } from "elysiajs-helmet";
/* routers ของคุณ */
import { Auths } from "./router/Auth";
import { Adminrouter } from "./router/Adminrouter";
import { Tablerouter } from "./router/Tablerouter";
import { middlewareadmin } from "./router/middlewarerouter";
import { menurouter } from "./router/menurouter";
import { web } from "./router/websocket";
import { profilerouter } from "./router/Profilerouter";
const port = Number(Bun.env.PORT);
const jwtsecret = Bun.env.JWT_SECRET as string;
const url = Bun.env.ORIGIN_URL;
const url2 = Bun.env.ORIGIN_URL2;
const app = new Elysia();

/* ① CORS ต้องมาก่อนทุกอย่าง  */
app
  .use(
    cors({
      origin: url2,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-XSRF-TOKEN"],
    })
  )
  .onAfterHandle(({ request, set }) => {
    const o = request.headers.get("origin");
    if (o) {
      set.headers["Access-Control-Allow-Origin"] = o; // สะท้อน origin
      set.headers["Access-Control-Allow-Credentials"] = "true";
    }
    set.headers["Content-Security-Policy"] =
      "default-src 'self'; connect-src 'self' https://backend-restaurant-deploy.onrender.com https://frontend-restaurant-97nb.vercel.app";
  })
  
  .use(elysiaHelmet({}))

  .use(
    jwt({
      name: "jwt",
      secret: jwtsecret,
    })
  )

  /* ④ เส้นทางจริง */
  .get("/", () => "Hello Elysia")
  .use(profilerouter)
  .use(middlewareadmin)
  .use(Tablerouter)
  .use(Adminrouter)
  .use(Auths)
  .use(menurouter)
  .use(web)

  .listen({ port, hostname: "0.0.0.0" });

console.log(`🦊  Elysia is running at 0.0.0.0:${port}`);
