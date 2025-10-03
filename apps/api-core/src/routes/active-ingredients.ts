import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import type { CreateActiveIngredientRequest } from "shared-types";

export const activeIngredientRoutes: FastifyPluginAsync = async (server) => {
  // List all active ingredients (with product count)
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { search } = request.query as { search?: string };

    const ingredients = await prisma.activeIngredient.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : undefined,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return { ingredients };
  });

  // Get single active ingredient
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const ingredient = await prisma.activeIngredient.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            dosage: true,
          },
        },
      },
    });

    if (!ingredient) {
      return reply.status(404).send({ error: "Active ingredient not found" });
    }

    return { ingredient };
  });

  // Create active ingredient
  server.post("/", { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as CreateActiveIngredientRequest;
    const user = (request as any).user;

    // Check if already exists
    const existing = await prisma.activeIngredient.findUnique({
      where: { name: body.name },
    });

    if (existing) {
      return reply.status(400).send({ error: "Active ingredient already exists" });
    }

    const ingredient = await prisma.activeIngredient.create({
      data: {
        name: body.name,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "CREATE",
        entity: "active_ingredients",
        entityId: ingredient.id,
        diff: { created: ingredient },
      },
    });

    return reply.status(201).send({ ingredient });
  });

  // Find or create active ingredient (upsert by name)
  server.post("/find-or-create", { preHandler: authenticate }, async (request, reply) => {
    const { name } = request.body as { name: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: "Name is required" });
    }

    const ingredient = await prisma.activeIngredient.upsert({
      where: { name: name.trim() },
      update: {},
      create: { name: name.trim() },
    });

    return { ingredient };
  });

  // Delete active ingredient
  server.delete("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const existing = await prisma.activeIngredient.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Active ingredient not found" });
    }

    // Check if any products use this ingredient
    if (existing.products.length > 0) {
      return reply.status(400).send({
        error: "Cannot delete active ingredient with associated products",
        productsCount: existing.products.length,
      });
    }

    await prisma.activeIngredient.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "DELETE",
        entity: "active_ingredients",
        entityId: id,
        diff: { deleted: existing },
      },
    });

    return reply.status(204).send();
  });
};
