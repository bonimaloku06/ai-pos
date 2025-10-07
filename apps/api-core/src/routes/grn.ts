import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export const grnRoutes: FastifyPluginAsync = async (server) => {
  // Create GRN (Goods Receipt Note)
  server.post(
    "/",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const user = request.user as { id: string; storeId: string };
      const data = request.body as {
        storeId: string;
        supplierId: string;
        purchaseOrderId?: string;
        vatRateId?: string;
        lines: Array<{
          productId: string;
          batchNumber?: string;
          expiryDate?: string;
          qty: number;
          unitCost: number;
          margin?: number;
        }>;
        notes?: string;
      };

      // Validation
      if (!data.lines || data.lines.length === 0) {
        return reply.status(400).send({ error: "At least one line item is required" });
      }

      if (!data.storeId || !data.supplierId) {
        return reply.status(400).send({ error: "Store and supplier are required" });
      }

      // Validate all products exist
      const productIds = data.lines.map((l) => l.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        return reply.status(400).send({ error: "One or more products not found" });
      }

      // Validate supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        return reply.status(404).send({ error: "Supplier not found" });
      }

      // Get VAT rate (use provided, or default)
      let vatRate;
      if (data.vatRateId) {
        vatRate = await prisma.vatRate.findUnique({
          where: { id: data.vatRateId },
        });
        if (!vatRate) {
          return reply.status(400).send({ error: "Invalid VAT rate" });
        }
      } else {
        // Get default VAT rate
        vatRate = await prisma.vatRate.findFirst({
          where: { isDefault: true, isActive: true },
        });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Generate GRN number
          const grnCount = await tx.stockMovement.count({
            where: { type: "RECEIVE" },
          });
          const grnNumber = `GRN-${String(grnCount + 1).padStart(6, "0")}`;

          const createdBatches = [];
          const stockMovements = [];
          
          // Calculate total cost before VAT
          const totalCost = data.lines.reduce((sum, line) => sum + (line.unitCost * line.qty), 0);
          
          // Calculate VAT amount
          const vatAmount = vatRate ? (totalCost * Number(vatRate.rate)) / 100 : 0;
          const totalWithVat = totalCost + vatAmount;

          // Process each line
          for (const line of data.lines) {
            // Generate batch number if not provided
            const batchNumber = line.batchNumber || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Set expiry date to 1 year from now if not provided
            const expiryDate = line.expiryDate ? new Date(line.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

            // Check if batch number already exists for this product
            const existingBatch = await tx.batch.findFirst({
              where: {
                productId: line.productId,
                batchNumber: batchNumber,
              },
            });

            let batch;

            if (existingBatch) {
              // Update existing batch quantity
              batch = await tx.batch.update({
                where: { id: existingBatch.id },
                data: {
                  qtyOnHand: existingBatch.qtyOnHand + line.qty,
                },
              });
            } else {
              // Create new batch
              batch = await tx.batch.create({
                data: {
                  productId: line.productId,
                  supplierId: data.supplierId,
                  storeId: data.storeId,
                  batchNumber: batchNumber,
                  expiryDate: expiryDate,
                  unitCost: line.unitCost,
                  qtyOnHand: line.qty,
                  receivedAt: new Date(),
                },
              });
            }

            createdBatches.push(batch);

            // Create stock movement
            stockMovements.push({
              productId: line.productId,
              batchId: batch.id,
              type: "RECEIVE",
              qty: line.qty,
              unitCost: line.unitCost,
              userId: user.id,
              refTable: "grn",
              refId: grnNumber,
              notes: JSON.stringify({
                margin: line.margin || 30,
              }),
            });
          }

          // Create all stock movements
          for (const movement of stockMovements) {
            await tx.stockMovement.create({
              data: movement,
            });
          }

          // Log audit
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "CREATE",
              entity: "grn",
              entityId: grnNumber,
              diff: {
                new: {
                  grnNumber,
                  storeId: data.storeId,
                  supplierId: data.supplierId,
                  lines: data.lines,
                  notes: data.notes,
                  vatRate: vatRate?.id,
                  vatAmount,
                  totalWithVat,
                },
              },
            },
          });

          return {
            grnNumber,
            batches: createdBatches,
            totalItems: data.lines.reduce((sum, l) => sum + l.qty, 0),
            totalCost,
            vatRate: vatRate ? { id: vatRate.id, name: vatRate.name, rate: vatRate.rate } : null,
            vatAmount,
            totalWithVat,
          };
        });

        return reply.status(201).send({
          grn: {
            ...result,
            batches: result.batches.map(batch => ({
              ...batch,
              unitCost: Number(batch.unitCost),
            })),
          }
        });
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: error.message || "Failed to create GRN" });
      }
    }
  );

  // Update GRN
  server.put(
    "/:grnNumber",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const user = request.user as { id: string; storeId: string };
      const { grnNumber } = request.params as { grnNumber: string };
      const data = request.body as {
        lines: Array<{
          productId: string;
          batchNumber?: string;
          expiryDate?: string;
          qty: number;
          unitCost: number;
          margin?: number;
        }>;
        notes?: string;
      };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Find all existing stock movements for this GRN
          const existingMovements = await tx.stockMovement.findMany({
            where: {
              refTable: "grn",
              refId: grnNumber,
            },
            include: {
              batch: true,
            },
          });

          // Reverse the old stock movements (subtract quantities)
          for (const movement of existingMovements) {
            if (movement.batchId) {
              await tx.batch.update({
                where: { id: movement.batchId },
                data: {
                  qtyOnHand: {
                    decrement: movement.qty,
                  },
                },
              });
            }

            // Delete old stock movement
            await tx.stockMovement.delete({
              where: { id: movement.id },
            });
          }

          // Get supplier from first existing movement
          const supplierId = existingMovements[0]?.batch?.supplierId;
          const storeId = existingMovements[0]?.batch?.storeId || user.storeId;

          if (!supplierId || !storeId) {
            throw new Error("Could not determine supplier or store from existing GRN");
          }

          const createdBatches = [];
          const stockMovements = [];

          // Process new lines
          for (const line of data.lines) {
            const batchNumber = line.batchNumber || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const expiryDate = line.expiryDate ? new Date(line.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

            const existingBatch = await tx.batch.findFirst({
              where: {
                productId: line.productId,
                batchNumber: batchNumber,
              },
            });

            let batch;

            if (existingBatch) {
              batch = await tx.batch.update({
                where: { id: existingBatch.id },
                data: {
                  qtyOnHand: existingBatch.qtyOnHand + line.qty,
                },
              });
            } else {
              batch = await tx.batch.create({
                data: {
                  productId: line.productId,
                  supplierId: supplierId,
                  storeId: storeId,
                  batchNumber: batchNumber,
                  expiryDate: expiryDate,
                  unitCost: line.unitCost,
                  qtyOnHand: line.qty,
                  receivedAt: new Date(),
                },
              });
            }

            createdBatches.push(batch);

            // Create new stock movement
            stockMovements.push({
              productId: line.productId,
              batchId: batch.id,
              type: "RECEIVE",
              qty: line.qty,
              unitCost: line.unitCost,
              userId: user.id,
              refTable: "grn",
              refId: grnNumber,
              notes: JSON.stringify({
                margin: line.margin || 30,
              }),
            });
          }

          // Create all stock movements
          for (const movement of stockMovements) {
            await tx.stockMovement.create({
              data: movement,
            });
          }

          return {
            grnNumber,
            batches: createdBatches,
            totalItems: data.lines.reduce((sum, l) => sum + l.qty, 0),
            totalValue: data.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0),
          };
        });

        return reply.status(200).send({
          grn: {
            ...result,
            batches: result.batches.map(batch => ({
              ...batch,
              unitCost: Number(batch.unitCost),
            })),
          }
        });
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: error.message || "Failed to update GRN" });
      }
    }
  );

  // Get GRN history
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { page = 1, limit = 20, startDate, endDate, supplierId, productId } = request.query as {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      supplierId?: string;
      productId?: string;
    };

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: any = { type: "RECEIVE" };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (productId) {
      where.productId = productId;
    }
    if (supplierId) {
      where.batch = {
        supplierId: supplierId,
      };
    }

    try {
      const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          include: {
            product: true,
            batch: {
              include: {
                supplier: true,
              },
            },
            user: {
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
        prisma.stockMovement.count({ where }),
      ]);

      // Group by GRN number
      const grnMap = new Map();
      movements.forEach((movement) => {
        const grnNumber = movement.refId;
        if (!grnMap.has(grnNumber)) {
          grnMap.set(grnNumber, {
            grnNumber,
            date: movement.createdAt,
            user: movement.user,
            supplier: movement.batch?.supplier,
            lines: [],
            totalQty: 0,
            totalValue: 0,
          });
        }

        const grn = grnMap.get(grnNumber);

        // Parse notes to get margin
        let purchaseDetails = { margin: 30 };
        try {
          if (movement.notes) {
            purchaseDetails = JSON.parse(movement.notes);
          }
        } catch (e) {
          // Ignore parsing errors
        }

        grn.lines.push({
          productId: movement.productId,
          product: movement.product,
          batch: movement.batch ? {
            ...movement.batch,
            unitCost: Number(movement.batch.unitCost),
          } : null,
          qty: movement.qty,
          unitCost: Number(movement.unitCost || 0),
          margin: purchaseDetails.margin,
        });
        grn.totalQty += movement.qty;
        grn.totalValue += movement.qty * Number(movement.unitCost || 0);
      });

      const grns = Array.from(grnMap.values());

      return {
        grns,
        total: grns.length,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch GRN history" });
    }
  });
};