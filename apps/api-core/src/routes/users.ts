import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import type { CreateUserRequest, UpdateUserRequest } from "shared-types";

export const userRoutes: FastifyPluginAsync = async (server) => {
  // List users
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const user = (request as any).user;

    // Only admins can list users
    if (user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { users };
  });

  // Get single user
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user;

    // Users can only view themselves unless they're admin
    if (currentUser.role !== "ADMIN" && currentUser.id !== id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    return { user };
  });

  // Create user
  server.post("/", { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as CreateUserRequest;
    const currentUser = (request as any).user;

    // Only admins can create users
    if (currentUser.role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return reply.status(400).send({ error: "User with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: body.role,
        storeId: body.storeId || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: "CREATE",
        entity: "users",
        entityId: user.id,
        diff: { created: user },
      },
    });

    return reply.status(201).send({ user });
  });

  // Update user
  server.patch("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateUserRequest;
    const currentUser = (request as any).user;

    // Users can only update themselves unless they're admin
    if (currentUser.role !== "ADMIN" && currentUser.id !== id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Non-admins can't change role or activate/deactivate
    if (currentUser.role !== "ADMIN" && (body.role || body.isActive !== undefined)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const updateData: any = {};
    if (body.email) updateData.email = body.email;
    if (body.role) updateData.role = body.role;
    if (body.storeId !== undefined) updateData.storeId = body.storeId || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.password) {
      updateData.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: "UPDATE",
        entity: "users",
        entityId: id,
        diff: { before: existing, after: user },
      },
    });

    return { user };
  });

  // Delete user
  server.delete("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user;

    // Only admins can delete users
    if (currentUser.role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Can't delete yourself
    if (currentUser.id === id) {
      return reply.status(400).send({ error: "Cannot delete your own account" });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "User not found" });
    }

    await prisma.user.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: "DELETE",
        entity: "users",
        entityId: id,
        diff: { deleted: existing },
      },
    });

    return reply.status(204).send();
  });
};