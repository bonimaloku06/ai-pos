import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

export const storeRoutes: FastifyPluginAsync = async (server) => {
  // List all stores
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const stores = await prisma.store.findMany({
      orderBy: { name: "asc" },
    });

    return { stores };
  });
};