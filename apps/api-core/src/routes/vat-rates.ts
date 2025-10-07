import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export async function vatRatesRoutes(fastify: FastifyInstance) {
  // Get all VAT rates
  fastify.get(
    "/",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const vatRates = await prisma.vatRate.findMany({
        orderBy: [{ isDefault: "desc" }, { rate: "asc" }],
      });

      return reply.send(vatRates);
    }
  );

  // Get default VAT rate
  fastify.get(
    "/default",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const defaultRate = await prisma.vatRate.findFirst({
        where: { isDefault: true, isActive: true },
      });

      if (!defaultRate) {
        return reply.status(404).send({ error: "No default VAT rate found" });
      }

      return reply.send(defaultRate);
    }
  );

  // Get single VAT rate
  fastify.get(
    "/:id",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const vatRate = await prisma.vatRate.findUnique({
        where: { id },
      });

      if (!vatRate) {
        return reply.status(404).send({ error: "VAT rate not found" });
      }

      return reply.send(vatRate);
    }
  );

  // Create VAT rate
  fastify.post(
    "/",
    {
      preHandler: [authenticate, authorize(["ADMIN", "MANAGER"])],
    },
    async (request, reply) => {
      const data = request.body as {
        name: string;
        rate: number; // e.g., 8 for 8%
        isDefault?: boolean;
        description?: string;
      };

      // If setting as default, unset other defaults
      if (data.isDefault) {
        await prisma.vatRate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const vatRate = await prisma.vatRate.create({
        data: {
          name: data.name,
          rate: data.rate,
          isDefault: data.isDefault || false,
          description: data.description || null,
        },
      });

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "CREATE",
          entity: "vat_rates",
          entityId: vatRate.id,
          diff: { new: vatRate },
        },
      });

      return reply.status(201).send(vatRate);
    }
  );

  // Update VAT rate
  fastify.patch(
    "/:id",
    {
      preHandler: [authenticate, authorize(["ADMIN", "MANAGER"])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as {
        name?: string;
        rate?: number;
        isDefault?: boolean;
        isActive?: boolean;
        description?: string;
      };

      const existing = await prisma.vatRate.findUnique({ where: { id } });

      if (!existing) {
        return reply.status(404).send({ error: "VAT rate not found" });
      }

      // If setting as default, unset other defaults
      if (data.isDefault) {
        await prisma.vatRate.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const vatRate = await prisma.vatRate.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.rate !== undefined && { rate: data.rate }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.description !== undefined && { description: data.description }),
        },
      });

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "UPDATE",
          entity: "vat_rates",
          entityId: vatRate.id,
          diff: { old: existing, new: vatRate },
        },
      });

      return reply.send(vatRate);
    }
  );

  // Delete VAT rate
  fastify.delete(
    "/:id",
    {
      preHandler: [authenticate, authorize(["ADMIN"])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await prisma.vatRate.findUnique({ where: { id } });

      if (!existing) {
        return reply.status(404).send({ error: "VAT rate not found" });
      }

      // Don't allow deletion of default VAT rate
      if (existing.isDefault) {
        return reply.status(400).send({ 
          error: "Cannot delete default VAT rate. Set another rate as default first." 
        });
      }

      await prisma.vatRate.delete({ where: { id } });

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "DELETE",
          entity: "vat_rates",
          entityId: id,
          diff: { old: existing },
        },
      });

      return reply.send({ message: "VAT rate deleted successfully" });
    }
  );

  // Set as default
  fastify.post(
    "/:id/set-default",
    {
      preHandler: [authenticate, authorize(["ADMIN", "MANAGER"])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const vatRate = await prisma.vatRate.findUnique({ where: { id } });

      if (!vatRate) {
        return reply.status(404).send({ error: "VAT rate not found" });
      }

      // Unset all defaults
      await prisma.vatRate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });

      // Set this as default
      const updatedRate = await prisma.vatRate.update({
        where: { id },
        data: { isDefault: true, isActive: true },
      });

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "UPDATE",
          entity: "vat_rates",
          entityId: id,
          diff: { action: "set_as_default" },
        },
      });

      return reply.send(updatedRate);
    }
  );

  // Toggle default status (convenient for checkboxes/toggles)
  fastify.patch(
    "/:id/toggle-default",
    {
      preHandler: [authenticate, authorize(["ADMIN", "MANAGER"])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const vatRate = await prisma.vatRate.findUnique({ where: { id } });

      if (!vatRate) {
        return reply.status(404).send({ error: "VAT rate not found" });
      }

      let updatedRate;

      if (vatRate.isDefault) {
        // If it's already default, don't allow untoggling (must have a default)
        return reply.status(400).send({ 
          error: "Cannot remove default status. Set another VAT rate as default first." 
        });
      } else {
        // Unset all other defaults
        await prisma.vatRate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });

        // Set this as default and activate it
        updatedRate = await prisma.vatRate.update({
          where: { id },
          data: { isDefault: true, isActive: true },
        });
      }

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "UPDATE",
          entity: "vat_rates",
          entityId: id,
          diff: { 
            old: { isDefault: vatRate.isDefault },
            new: { isDefault: updatedRate.isDefault },
            action: "toggle_default"
          },
        },
      });

      return reply.send(updatedRate);
    }
  );
}
