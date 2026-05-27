import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import jwt from "@elysiajs/jwt";
import { elysiaHelmet } from "elysiajs-helmet";
import { rateLimit } from "elysia-rate-limit";
import { Auths } from "./router/Auth";
import { Adminrouter } from "./router/Adminrouter";
import { Tablerouter } from "./router/Tablerouter";
import { middlewareadmin } from "./router/middlewarerouter";
import { menurouter } from "./router/menurouter";
import { web } from "./router/websocket";
import { profilerouter } from "./router/Profilerouter";
import { Orderrouter } from "./router/Orderrouter";
import { RestaurantRouter } from "./router/RestaurantRouter";
import { SuperAdminRouter } from "./router/SuperAdminRouter";
import { ReportRouter } from "./router/ReportRouter";
import { ensureSalesSchema } from "./lib/connect";

const port = Number(Bun.env.PORT || 4000);
const jwtsecret = Bun.env.JWT_SECRET as string;
const url = Bun.env.ORIGIN_URL;
const url2 = Bun.env.ORIGIN_URL2;
const app = new Elysia();
const csp =
  "default-src 'self'; connect-src 'self' http://localhost:4000 ws://localhost:4000 https://backend-restaurant-deploy.onrender.com https://frontend-restaurant-97nb.vercel.app";

await ensureSalesSchema();

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  if (origin.includes("localhost")) return true;
  return origin === url || origin === url2;
}

app
  .use(
    cors({
      origin: ({ headers }) => isAllowedOrigin(headers.get("origin")),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-XSRF-TOKEN"],
    }),
  )
  .onAfterHandle(({ set }) => {
    set.headers["Content-Security-Policy"] = csp;
  })
  .onError(({ code, error, set }) => {
    set.headers["Content-Security-Policy"] = csp;

    if (code === "VALIDATION") {
      set.status = error.status;
      return {
        status: "error",
        message: "Validation failed",
        errors: error.all,
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 400;
      return {
        status: "error",
        message: "Not found page",
      };
    }

    set.status = 500;
    console.error(error);
    return {
      status: "error",
      message: (error as Error).message || "Internal server error",
    };
  })
  .use(elysiaHelmet({}))
  .use(
    rateLimit({
      duration: 60000,
      max: 100,
      generator: (req, server) =>
        server?.requestIP(req)?.address ??
        req.headers.get("x-forwarded-for") ??
        "unknown",
    }),
  )
  .use(
    jwt({
      name: "jwt",
      secret: jwtsecret,
    }),
  )
  .get("/", () => "Hello Elysia")
  .get("/healthz", () => ({
    status: "ok",
    service: "restaurant-api",
    checkedAt: new Date().toISOString(),
  }))
  .get("/readyz", async () => {
    const db = await import("./lib/connect").then((module) => module.getDB());
    await db.query("SELECT 1");
    return {
      status: "ready",
      database: "ok",
      checkedAt: new Date().toISOString(),
    };
  })
  .use(profilerouter)
  .use(middlewareadmin)
  .use(Tablerouter)
  .use(Adminrouter)
  .use(Auths)
  .use(RestaurantRouter)
  .use(SuperAdminRouter)
  .use(ReportRouter)
  .use(menurouter)
  .use(Orderrouter)
  .use(web)
  .listen({ port, hostname: "0.0.0.0" });

console.log(`Elysia is running at 0.0.0.0:${port}`);
