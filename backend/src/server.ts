import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { Agent, setGlobalDispatcher } from "undici";
import { config } from "./config.js";
import { registerProxyRoutes } from "./routes/proxy.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerKeyRoutes } from "./routes/keys.js";
import { startRequestLogWorker } from "./queue/worker.js";
import { registerSpendRoutes } from "./routes/spend.js";
import { registerRequestRoutes } from "./routes/requests.js";
import { registerRuleRoutes } from "./routes/rules.js";
import { startAlertWorker } from "./queue/alertWorker.js";
import { registerBillingRoutes } from "./routes/billing.js";

setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: "http://localhost:3000", // Next.js dev server — adjust if yours runs elsewhere
  credentials: true, // required for the session cookie to be sent/received cross-origin
});
await app.register(cookie);

app.get("/health", async () => {
  return {
    ok: true,
    mode: config.isMock ? "mock" : "real",
    baseUrl: config.baseUrl,
  };
});

await registerProxyRoutes(app);
await registerAuthRoutes(app);
await registerProjectRoutes(app);
await registerKeyRoutes(app);
await registerSpendRoutes(app);
await registerRuleRoutes(app);
await registerRequestRoutes(app);
await registerBillingRoutes(app);

startRequestLogWorker();
startAlertWorker();

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
