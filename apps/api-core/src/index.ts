import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { initializeProductIndex } from "./lib/meilisearch.js";
import {
  createForecastWorker,
  scheduleForecastGeneration,
} from "./lib/queue.js";
import { generateForecastSuggestions } from "./jobs/forecast-generator.js";
import { authRoutes } from "./routes/auth.js";
import { productRoutes } from "./routes/products.js";
import { batchRoutes } from "./routes/batches.js";
import { salesRoutes } from "./routes/sales.js";
import { supplierRoutes } from "./routes/suppliers.js";
import { purchaseOrderRoutes } from "./routes/purchase-orders.js";
import { reportRoutes } from "./routes/reports.js";
import { grnRoutes } from "./routes/grn.js";
import { pricingRoutes } from "./routes/pricing.js";
import { reorderSuggestionRoutes } from "./routes/reorder-suggestions.js";
import { userRoutes } from "./routes/users.js";
import { storeRoutes } from "./routes/stores.js";
import { auditLogRoutes } from "./routes/audit-logs.js";
import { activeIngredientRoutes } from "./routes/active-ingredients.js";
import { taxClassRoutes } from "./routes/tax-classes.js";

const server = Fastify({
  logger: true,
});

// Register plugins
await server.register(cors, {
  origin: config.cors.origins,
  credentials: true,
});

await server.register(helmet, {
  contentSecurityPolicy: config.env === "production",
});

await server.register(jwt, {
  secret: config.jwt.secret,
  sign: {
    expiresIn: config.jwt.expiresIn,
  },
});

await server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

await server.register(rateLimit, {
  max: config.env === "production" ? 100 : 1000,
  timeWindow: "1 minute",
});

// Health check
server.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Register routes
await server.register(authRoutes, { prefix: "/auth" });
await server.register(productRoutes, { prefix: "/products" });
await server.register(batchRoutes, { prefix: "/batches" });
await server.register(salesRoutes, { prefix: "/sales" });
await server.register(supplierRoutes, { prefix: "/suppliers" });
await server.register(purchaseOrderRoutes, { prefix: "/po" });
await server.register(reportRoutes, { prefix: "/reports" });
await server.register(grnRoutes, { prefix: "/grn" });
await server.register(pricingRoutes, { prefix: "/pricing" });
await server.register(reorderSuggestionRoutes, { prefix: "/reorder-suggestions" });
await server.register(userRoutes, { prefix: "/users" });
await server.register(storeRoutes, { prefix: "/stores" });
await server.register(auditLogRoutes, { prefix: "/audit-logs" });
await server.register(activeIngredientRoutes, { prefix: "/active-ingredients" });
await server.register(taxClassRoutes, { prefix: "/tax-classes" });

// Error handler
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: error.message || "Internal Server Error",
    statusCode: error.statusCode || 500,
  });
});

// Start server
const start = async () => {
  try {
    // Initialize Meilisearch
    await initializeProductIndex();

    // Initialize forecast worker (optional, comment out if Redis not available)
    if (process.env.ENABLE_FORECAST_WORKER === "true") {
      const worker = createForecastWorker(async (job) => {
        await generateForecastSuggestions();
      });

      // Schedule nightly forecast generation
      await scheduleForecastGeneration();

      console.log("✓ Forecast worker initialized");

      // Graceful shutdown
      process.on("SIGTERM", async () => {
        await worker.close();
      });
    } else {
      console.log(
        "ℹ Forecast worker disabled. Set ENABLE_FORECAST_WORKER=true to enable."
      );
    }

    await server.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`Server listening on http://localhost:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();