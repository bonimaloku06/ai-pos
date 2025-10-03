import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export const supplierRoutes: FastifyPluginAsync = async (server) => {
  // Get all suppliers
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { page = 1, limit = 50, isActive } = request.query as {
      page?: number;
      limit?: number;
      isActive?: string;
    };

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    try {
      const [suppliers, total] = await Promise.all([
        prisma.supplier.findMany({
          where,
          skip: offset,
          take: limitNum,
          orderBy: { name: "asc" },
        }),
        prisma.supplier.count({ where }),
      ]);

      return {
        suppliers,
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch suppliers" });
    }
  });

  // Get single supplier
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplier) {
        return reply.status(404).send({ error: "Supplier not found" });
      }

      return { supplier };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch supplier" });
    }
  });

  // Create supplier
  server.post(
    "/",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const user = request.user as { id: string };
      const data = request.body as {
        name: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        address?: string;
        leadTimeDays?: number;
        deliveryDays?: string[];
        moq?: number;
        currency?: string;
        paymentTerms?: string;
        notes?: string;
      };

      // Validation
      if (!data.name) {
        return reply.status(400).send({ error: "Supplier name is required" });
      }

      try {
        const supplier = await prisma.supplier.create({
          data: {
            name: data.name,
            contactPerson: data.contactPerson || null,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
            leadTimeDays: data.leadTimeDays || 7,
            deliveryDays: data.deliveryDays || [],
            moq: data.moq || 1,
            currency: data.currency || "USD",
            paymentTerms: data.paymentTerms || "NET 30",
            notes: data.notes || null,
            isActive: true,
          },
        });

        // Log audit
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "CREATE",
            entity: "suppliers",
            entityId: supplier.id,
            diff: { new: supplier },
          },
        });

        return reply.status(201).send({ supplier });
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to create supplier" });
      }
    }
  );

  // Update supplier
  server.put(
    "/:id",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };
      const data = request.body as {
        name?: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        address?: string;
        leadTimeDays?: number;
        deliveryDays?: string[];
        moq?: number;
        currency?: string;
        paymentTerms?: string;
        notes?: string;
        isActive?: boolean;
      };

      try {
        const existing = await prisma.supplier.findUnique({
          where: { id },
        });

        if (!existing) {
          return reply.status(404).send({ error: "Supplier not found" });
        }

        const supplier = await prisma.supplier.update({
          where: { id },
          data: {
            name: data.name,
            contactPerson: data.contactPerson,
            email: data.email,
            phone: data.phone,
            address: data.address,
            leadTimeDays: data.leadTimeDays,
            deliveryDays: data.deliveryDays,
            moq: data.moq,
            currency: data.currency,
            paymentTerms: data.paymentTerms,
            notes: data.notes,
            isActive: data.isActive,
          },
        });

        // Log audit
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "UPDATE",
            entity: "suppliers",
            entityId: supplier.id,
            diff: { old: existing, new: supplier },
          },
        });

        return { supplier };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to update supplier" });
      }
    }
  );

  // Deactivate supplier
  server.delete(
    "/:id",
    { preHandler: authorize("ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      try {
        const existing = await prisma.supplier.findUnique({
          where: { id },
        });

        if (!existing) {
          return reply.status(404).send({ error: "Supplier not found" });
        }

        const supplier = await prisma.supplier.update({
          where: { id },
          data: { isActive: false },
        });

        // Log audit
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "DELETE",
            entity: "suppliers",
            entityId: supplier.id,
            diff: { old: existing, new: supplier },
          },
        });

        return { success: true, supplier };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to deactivate supplier" });
      }
    }
  );

  // Get supplier delivery calendar
  server.get(
    "/:id/calendar",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const supplier = await prisma.supplier.findUnique({
          where: { id },
          select: {
            deliveryDays: true,
            deliverySchedule: true,
            leadTimeDays: true,
          },
        });

        if (!supplier) {
          return reply.status(404).send({ error: "Supplier not found" });
        }

        // Calculate next delivery dates based on delivery days
        const today = new Date();
        const nextDeliveries = [];
        const dayMap: Record<string, number> = {
          SUN: 0,
          MON: 1,
          TUE: 2,
          WED: 3,
          THU: 4,
          FRI: 5,
          SAT: 6,
        };

        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() + i);
          const dayOfWeek = checkDate.getDay();
          const dayName = Object.keys(dayMap).find((key) => dayMap[key] === dayOfWeek);

          if (dayName && supplier.deliveryDays.includes(dayName)) {
            nextDeliveries.push({
              date: checkDate.toISOString().split("T")[0],
              dayName,
            });
          }
        }

        return {
          deliveryDays: supplier.deliveryDays,
          deliverySchedule: supplier.deliverySchedule,
          leadTimeDays: supplier.leadTimeDays,
          nextDeliveries: nextDeliveries.slice(0, 10), // Next 10 delivery dates
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch delivery calendar" });
      }
    }
  );

  // Get next delivery date (enhanced with deliverySchedule support)
  server.get(
    "/:id/next-delivery",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const supplier = await prisma.supplier.findUnique({
          where: { id },
          select: {
            deliverySchedule: true,
            deliveryDays: true,
            leadTimeDays: true,
          },
        });

        if (!supplier) {
          return reply.status(404).send({ error: "Supplier not found" });
        }

        const today = new Date();
        let nextDeliveryDate: Date | null = null;

        // Use enhanced deliverySchedule if available
        if (supplier.deliverySchedule) {
          const schedule = supplier.deliverySchedule as any;

          if (schedule.type === "daily") {
            // Next day delivery
            nextDeliveryDate = new Date(today);
            nextDeliveryDate.setDate(nextDeliveryDate.getDate() + 1);
          } else if (schedule.type === "specific_days") {
            // Find next occurrence of specified days
            const days = schedule.days || [];
            const dayMap: Record<string, number> = {
              sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
              thursday: 4, friday: 5, saturday: 6,
            };

            for (let i = 1; i <= 7; i++) {
              const checkDate = new Date(today);
              checkDate.setDate(checkDate.getDate() + i);
              const dayName = Object.keys(dayMap).find(
                (key) => dayMap[key] === checkDate.getDay()
              );

              if (dayName && days.includes(dayName)) {
                nextDeliveryDate = checkDate;
                break;
              }
            }
          } else if (schedule.type === "weekly") {
            // Find next occurrence of the specific day
            const targetDay = schedule.day || "monday";
            const dayMap: Record<string, number> = {
              sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
              thursday: 4, friday: 5, saturday: 6,
            };
            const targetDayNum = dayMap[targetDay];

            for (let i = 1; i <= 7; i++) {
              const checkDate = new Date(today);
              checkDate.setDate(checkDate.getDate() + i);
              if (checkDate.getDay() === targetDayNum) {
                nextDeliveryDate = checkDate;
                break;
              }
            }
          } else if (schedule.type === "bi_weekly") {
            // Simplified bi-weekly (every 14 days)
            nextDeliveryDate = new Date(today);
            nextDeliveryDate.setDate(nextDeliveryDate.getDate() + 14);
          }
        }

        // Fallback to deliveryDays if no deliverySchedule
        if (!nextDeliveryDate && supplier.deliveryDays.length > 0) {
          const dayMap: Record<string, number> = {
            SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
          };

          for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() + i);
            const dayOfWeek = checkDate.getDay();
            const dayName = Object.keys(dayMap).find((key) => dayMap[key] === dayOfWeek);

            if (dayName && supplier.deliveryDays.includes(dayName)) {
              nextDeliveryDate = checkDate;
              break;
            }
          }
        }

        // Default to lead time if no schedule
        if (!nextDeliveryDate) {
          nextDeliveryDate = new Date(today);
          nextDeliveryDate.setDate(nextDeliveryDate.getDate() + supplier.leadTimeDays);
        }

        const daysUntil = Math.ceil(
          (nextDeliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          nextDeliveryDate: nextDeliveryDate.toISOString(),
          daysUntil,
          leadTimeDays: supplier.leadTimeDays,
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to calculate next delivery date" });
      }
    }
  );
};