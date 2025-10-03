import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

export const auditLogRoutes: FastifyPluginAsync = async (server) => {
  // List audit logs
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const user = (request as any).user;

    // Only admins and managers can view audit logs
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const { entity, action, actorId, startDate, endDate, limit = 100 } = request.query as {
      entity?: string;
      action?: string;
      actorId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    };

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (startDate || endDate) {
      where.at = {};
      if (startDate) where.at.gte = new Date(startDate);
      if (endDate) where.at.lte = new Date(endDate);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { at: "desc" },
      take: Number(limit),
    });

    return { logs };
  });
};