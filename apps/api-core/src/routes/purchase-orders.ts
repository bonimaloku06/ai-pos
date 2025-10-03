import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export const purchaseOrderRoutes: FastifyPluginAsync = async (server) => {
  // Get all purchase orders
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { page = 1, limit = 20, status, supplierId } = request.query as {
      page?: number;
      limit?: number;
      status?: string;
      supplierId?: string;
    };

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    try {
      const [pos, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          include: {
            supplier: true,
            lines: {
              include: {
                product: true,
              },
            },
            creator: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          skip: offset,
          take: limitNum,
          orderBy: { createdAt: "desc" },
        }),
        prisma.purchaseOrder.count({ where }),
      ]);

      return {
        pos: pos.map(po => ({
          ...po,
          subtotal: Number(po.subtotal),
          lines: po.lines.map(line => ({
            ...line,
            unitCost: Number(line.unitCost),
            lineTotal: Number(line.lineTotal),
          })),
        })),
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch purchase orders" });
    }
  });

  // Get single PO
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          lines: {
            include: {
              product: true,
            },
          },
          creator: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!po) {
        return reply.status(404).send({ error: "Purchase order not found" });
      }

      return {
        po: {
          ...po,
          subtotal: Number(po.subtotal),
          lines: po.lines.map(line => ({
            ...line,
            unitCost: Number(line.unitCost),
            lineTotal: Number(line.lineTotal),
          })),
        }
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch purchase order" });
    }
  });

  // Create new PO
  server.post(
    "/",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const user = request.user as { id: string };
      const data = request.body as {
        supplierId: string;
        expectedAt?: string;
        notes?: string;
        lines: Array<{
          productId: string;
          qty: number;
          unitCost: number;
          notes?: string;
        }>;
      };

      // Validation
      if (!data.supplierId || !data.lines || data.lines.length === 0) {
        return reply.status(400).send({ error: "Supplier and line items are required" });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Generate PO number
          const poCount = await tx.purchaseOrder.count();
          const poNumber = `PO-${String(poCount + 1).padStart(6, "0")}`;

          // Calculate totals
          const subtotal = data.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);

          // Create PO
          const po = await tx.purchaseOrder.create({
            data: {
              poNumber,
              supplierId: data.supplierId,
              status: "DRAFT",
              expectedAt: data.expectedAt ? new Date(data.expectedAt) : null,
              subtotal,
              notes: data.notes,
              createdById: user.id,
              lines: {
                create: data.lines.map((line) => ({
                  productId: line.productId,
                  qty: line.qty,
                  unitCost: line.unitCost,
                  lineTotal: line.qty * line.unitCost,
                  notes: line.notes,
                })),
              },
            },
            include: {
              supplier: true,
              lines: {
                include: {
                  product: true,
                },
              },
            },
          });

          // Log audit
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "CREATE",
              entity: "purchase_orders",
              entityId: po.id,
              diff: { new: po },
            },
          });

          return po;
        });

        return reply.status(201).send({
          po: {
            ...result,
            subtotal: Number(result.subtotal),
            lines: result.lines.map(line => ({
              ...line,
              unitCost: Number(line.unitCost),
              lineTotal: Number(line.lineTotal),
            })),
          }
        });
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to create purchase order" });
      }
    }
  );

  // Update draft PO
  server.put(
    "/:id",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };
      const data = request.body as {
        expectedAt?: string;
        notes?: string;
        lines?: Array<{
          id?: string;
          productId: string;
          qty: number;
          unitCost: number;
          notes?: string;
        }>;
      };

      try {
        const existing = await prisma.purchaseOrder.findUnique({
          where: { id },
          include: { lines: true },
        });

        if (!existing) {
          return reply.status(404).send({ error: "Purchase order not found" });
        }

        if (existing.status !== "DRAFT") {
          return reply.status(400).send({
            error: "Can only update draft purchase orders",
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          // Delete existing lines if new ones provided
          if (data.lines) {
            await tx.poLine.deleteMany({
              where: { poId: id },
            });
          }

          // Calculate new totals
          const subtotal = data.lines
            ? data.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0)
            : existing.subtotal;

          // Update PO
          const po = await tx.purchaseOrder.update({
            where: { id },
            data: {
              expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
              notes: data.notes,
              subtotal,
              lines: data.lines
                ? {
                    create: data.lines.map((line) => ({
                      productId: line.productId,
                      qty: line.qty,
                      unitCost: line.unitCost,
                      lineTotal: line.qty * line.unitCost,
                      notes: line.notes,
                    })),
                  }
                : undefined,
            },
            include: {
              supplier: true,
              lines: {
                include: {
                  product: true,
                },
              },
            },
          });

          // Log audit
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "UPDATE",
              entity: "purchase_orders",
              entityId: id,
              diff: { old: existing, new: po },
            },
          });

          return po;
        });

        return {
          po: {
            ...result,
            subtotal: Number(result.subtotal),
            lines: result.lines.map(line => ({
              ...line,
              unitCost: Number(line.unitCost),
              lineTotal: Number(line.lineTotal),
            })),
          }
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to update purchase order" });
      }
    }
  );

  // Approve PO
  server.post(
    "/:id/approve",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      try {
        const existing = await prisma.purchaseOrder.findUnique({
          where: { id },
        });

        if (!existing) {
          return reply.status(404).send({ error: "Purchase order not found" });
        }

        if (existing.status !== "DRAFT") {
          return reply.status(400).send({ error: "Only draft POs can be approved" });
        }

        const result = await prisma.$transaction(async (tx) => {
          const po = await tx.purchaseOrder.update({
            where: { id },
            data: {
              status: "APPROVED",
              approvedAt: new Date(),
            },
            include: {
              supplier: true,
              lines: {
                include: {
                  product: true,
                },
              },
            },
          });

          // Log audit
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "UPDATE",
              entity: "purchase_orders",
              entityId: id,
              diff: { old: existing, new: po },
            },
          });

          return po;
        });

        return {
          po: {
            ...result,
            subtotal: Number(result.subtotal),
            lines: result.lines.map(line => ({
              ...line,
              unitCost: Number(line.unitCost),
              lineTotal: Number(line.lineTotal),
            })),
          }
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to approve purchase order" });
      }
    }
  );

  // Cancel PO
  server.post(
    "/:id/cancel",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      try {
        const existing = await prisma.purchaseOrder.findUnique({
          where: { id },
        });

        if (!existing) {
          return reply.status(404).send({ error: "Purchase order not found" });
        }

        if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
          return reply.status(400).send({
            error: "Cannot cancel received or already cancelled PO",
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          const po = await tx.purchaseOrder.update({
            where: { id },
            data: {
              status: "CANCELLED",
            },
            include: {
              supplier: true,
              lines: {
                include: {
                  product: true,
                },
              },
            },
          });

          // Log audit
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "UPDATE",
              entity: "purchase_orders",
              entityId: id,
              diff: { old: existing, new: po },
            },
          });

          return po;
        });

        return {
          po: {
            ...result,
            subtotal: Number(result.subtotal),
            lines: result.lines.map(line => ({
              ...line,
              unitCost: Number(line.unitCost),
              lineTotal: Number(line.lineTotal),
            })),
          }
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to cancel purchase order" });
      }
    }
  );

  // Mark PO as received (link to GRN)
  server.post(
    "/:id/receive",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };
      const data = request.body as {
        grnNumber: string;
      };

      try {
        const existing = await prisma.purchaseOrder.findUnique({
          where: { id },
        });

        if (!existing) {
          return reply.status(404).send({ error: "Purchase order not found" });
        }

        if (existing.status !== "APPROVED") {
          return reply.status(400).send({ error: "Only approved POs can be received" });
        }

        const result = await prisma.$transaction(async (tx) => {
          const po = await tx.purchaseOrder.update({
            where: { id },
            data: {
              status: "RECEIVED",
              receivedAt: new Date(),
            },
            include: {
              supplier: true,
              lines: {
                include: {
                  product: true,
                },
              },
            },
          });

          // Log audit
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "UPDATE",
              entity: "purchase_orders",
              entityId: id,
              diff: {
                old: existing,
                new: po,
                grnNumber: data.grnNumber,
              },
            },
          });

          return po;
        });

        return {
          po: {
            ...result,
            subtotal: Number(result.subtotal),
            lines: result.lines.map(line => ({
              ...line,
              unitCost: Number(line.unitCost),
              lineTotal: Number(line.lineTotal),
            })),
          }
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to mark PO as received" });
      }
    }
  );
};