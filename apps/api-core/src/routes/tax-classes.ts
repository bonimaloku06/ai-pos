import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export const taxClassRoutes: FastifyPluginAsync = async (server) => {
  // Get all tax classes
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const taxClasses = await prisma.taxClass.findMany({
      orderBy: { rate: "asc" },
    });

    return {
      taxClasses: taxClasses.map(tc => ({
        ...tc,
        rate: Number(tc.rate),
      })),
    };
  });

  // Get single tax class
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const taxClass = await prisma.taxClass.findUnique({
      where: { id },
    });

    if (!taxClass) {
      return reply.status(404).send({ error: "Tax class not found" });
    }

    return {
      taxClass: {
        ...taxClass,
        rate: Number(taxClass.rate),
      },
    };
  });

  // Create tax class (admin only)
  server.post("/", { preHandler: authorize("ADMIN") }, async (request, reply) => {
    const { name, rate } = request.body as { name: string; rate: number };

    const taxClass = await prisma.taxClass.create({
      data: {
        name,
        rate,
      },
    });

    return {
      taxClass: {
        ...taxClass,
        rate: Number(taxClass.rate),
      },
    };
  });

  // Update tax class (admin only)
  server.patch("/:id", { preHandler: authorize("ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, rate } = request.body as { name?: string; rate?: number };

    const taxClass = await prisma.taxClass.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(rate !== undefined && { rate }),
      },
    });

    return {
      taxClass: {
        ...taxClass,
        rate: Number(taxClass.rate),
      },
    };
  });

  // Delete tax class (admin only)
  server.delete("/:id", { preHandler: authorize("ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.taxClass.delete({
      where: { id },
    });

    return { message: "Tax class deleted successfully" };
  });
};
