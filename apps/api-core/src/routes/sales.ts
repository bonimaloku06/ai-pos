import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

export const salesRoutes: FastifyPluginAsync = async (server) => {
  // Create sale with FEFO enforcement
  server.post("/", { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as { id: string; storeId: string };
    const data = request.body as {
      storeId: string;
      lines: Array<{
        productId: string;
        batchId?: string;
        qty: number;
        unitPrice: number;
        taxRate: number;
        discount?: number;
      }>;
      paymentMethod: string;
      paid: number;
      notes?: string;
      saleDate?: string; // Optional custom sale date for testing
    };

    // Validation
    if (!data.lines || data.lines.length === 0) {
      return reply.status(400).send({ error: "At least one line item is required" });
    }

    if (!data.paymentMethod || !data.paid) {
      return reply.status(400).send({ error: "Payment method and amount are required" });
    }

    try {
      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Process each line and allocate stock using FEFO
        const processedLines = [];
        const stockMovements = [];

        for (const line of data.lines) {
          // Get available batches for this product (FEFO order)
          const batches = await tx.batch.findMany({
            where: {
              productId: line.productId,
              storeId: data.storeId,
              qtyOnHand: { gt: 0 },
            },
            orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
          });

          if (batches.length === 0) {
            throw new Error(`No stock available for product ${line.productId}`);
          }

          // Calculate total available
          const totalAvailable = batches.reduce((sum, b) => sum + b.qtyOnHand, 0);
          if (totalAvailable < line.qty) {
            throw new Error(
              `Insufficient stock for product ${line.productId}. Available: ${totalAvailable}, Required: ${line.qty}`
            );
          }

          // Allocate from batches using FEFO
          let remainingQty = line.qty;
          let batchId = null;

          for (const batch of batches) {
            if (remainingQty <= 0) break;

            const qtyToTake = Math.min(remainingQty, batch.qtyOnHand);

            // Update batch quantity
            await tx.batch.update({
              where: { id: batch.id },
              data: { qtyOnHand: batch.qtyOnHand - qtyToTake },
            });

            remainingQty -= qtyToTake;

            // Use first batch for sale line reference
            if (!batchId) batchId = batch.id;

            // Create stock movement
            stockMovements.push({
              productId: line.productId,
              batchId: batch.id,
              type: "SALE",
              qty: -qtyToTake,
              unitCost: batch.unitCost,
              userId: user.id,
            });
          }

          // Calculate line total
          const lineTotal = line.qty * line.unitPrice * (1 + line.taxRate - (line.discount || 0));

          processedLines.push({
            productId: line.productId,
            batchId,
            qty: line.qty,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            discount: line.discount || 0,
            lineTotal,
          });
        }

        // Calculate totals
        const subtotal = processedLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
        const taxTotal = processedLines.reduce(
          (sum, l) => sum + l.qty * l.unitPrice * l.taxRate,
          0
        );
        const discountTotal = processedLines.reduce(
          (sum, l) => sum + l.qty * l.unitPrice * l.discount,
          0
        );
        const total = subtotal + taxTotal - discountTotal;
        const change = data.paid - total;

        // Generate sale number
        const saleCount = await tx.sale.count();
        const saleNumber = `SALE-${String(saleCount + 1).padStart(6, "0")}`;

        // Parse custom sale date if provided
        const saleDate = data.saleDate ? new Date(data.saleDate) : undefined;

        // Create sale
        const sale = await tx.sale.create({
          data: {
            saleNumber,
            storeId: data.storeId,
            cashierId: user.id,
            subtotal,
            taxTotal,
            discountTotal,
            total,
            paid: data.paid,
            change,
            paymentMethod: data.paymentMethod,
            status: "COMPLETED",
            notes: data.notes,
            ...(saleDate && { createdAt: saleDate }), // Override createdAt if custom date provided
            lines: {
              create: processedLines,
            },
          },
          include: {
            lines: {
              include: {
                product: true,
              },
            },
          },
        });

        // Create stock movements
        for (const movement of stockMovements) {
          await tx.stockMovement.create({
            data: {
              ...movement,
              refTable: "sales",
              refId: sale.id,
            },
          });
        }

        // Log audit
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "CREATE",
            entity: "sales",
            entityId: sale.id,
            diff: { new: sale },
          },
        });

        return sale;
      });

      return reply.status(201).send({
        sale: {
          ...result,
          subtotal: Number(result.subtotal),
          taxTotal: Number(result.taxTotal),
          discountTotal: Number(result.discountTotal),
          total: Number(result.total),
          paid: Number(result.paid),
          change: Number(result.change),
          lines: result.lines.map((line) => ({
            ...line,
            unitPrice: Number(line.unitPrice),
            taxRate: Number(line.taxRate),
            discount: Number(line.discount),
            lineTotal: Number(line.lineTotal),
          })),
        },
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message || "Failed to create sale" });
    }
  });

  // Get sale by ID
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: true,
            batch: true,
          },
        },
        cashier: {
          select: {
            id: true,
            email: true,
          },
        },
        store: true,
      },
    });

    if (!sale) {
      return reply.status(404).send({ error: "Sale not found" });
    }

    return {
      sale: {
        ...sale,
        subtotal: Number(sale.subtotal),
        taxTotal: Number(sale.taxTotal),
        discountTotal: Number(sale.discountTotal),
        total: Number(sale.total),
        paid: Number(sale.paid),
        change: Number(sale.change),
        lines: sale.lines.map((line) => ({
          ...line,
          unitPrice: Number(line.unitPrice),
          taxRate: Number(line.taxRate),
          discount: Number(line.discount),
          lineTotal: Number(line.lineTotal),
          batch: line.batch
            ? {
                ...line.batch,
                unitCost: Number(line.batch.unitCost),
              }
            : null,
        })),
      },
    };
  });

  // Refund sale
  server.post(
    "/:id/refund",
    { preHandler: authorize("ADMIN", "MANAGER") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const originalSale = await prisma.sale.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!originalSale) {
        return reply.status(404).send({ error: "Sale not found" });
      }

      if (originalSale.status === "REFUNDED") {
        return reply.status(400).send({ error: "Sale already refunded" });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Update original sale status
          await tx.sale.update({
            where: { id },
            data: { status: "REFUNDED" },
          });

          // Return stock to batches
          for (const line of originalSale.lines) {
            if (line.batchId) {
              await tx.batch.update({
                where: { id: line.batchId },
                data: {
                  qtyOnHand: {
                    increment: line.qty,
                  },
                },
              });

              // Create return stock movement
              await tx.stockMovement.create({
                data: {
                  productId: line.productId,
                  batchId: line.batchId,
                  type: "RETURN",
                  qty: line.qty,
                  refTable: "sales",
                  refId: id,
                  userId: user.id,
                },
              });
            }
          }

          // Log audit
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "UPDATE",
              entity: "sales",
              entityId: id,
              diff: { status: "REFUNDED" },
            },
          });

          return originalSale;
        });

        return {
          sale: {
            ...result,
            subtotal: Number(result.subtotal),
            taxTotal: Number(result.taxTotal),
            discountTotal: Number(result.discountTotal),
            total: Number(result.total),
            paid: Number(result.paid),
            change: Number(result.change),
            lines: result.lines.map((line) => ({
              ...line,
              unitPrice: Number(line.unitPrice),
              taxRate: Number(line.taxRate),
              discount: Number(line.discount),
              lineTotal: Number(line.lineTotal),
            })),
          },
          message: "Sale refunded successfully",
        };
      } catch (error: any) {
        server.log.error(error);
        return reply.status(500).send({ error: "Failed to refund sale" });
      }
    }
  );

  // Get sales list with pagination
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
    } = request.query as {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    };

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          cashier: {
            select: {
              id: true,
              email: true,
            },
          },
          lines: {
            include: {
              product: true,
            },
          },
        },
        skip: offset,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      sales: sales.map((sale) => ({
        ...sale,
        subtotal: Number(sale.subtotal),
        taxTotal: Number(sale.taxTotal),
        discountTotal: Number(sale.discountTotal),
        total: Number(sale.total),
        paid: Number(sale.paid),
        change: Number(sale.change),
        lines: sale.lines.map((line) => ({
          ...line,
          unitPrice: Number(line.unitPrice),
          taxRate: Number(line.taxRate),
          discount: Number(line.discount),
          lineTotal: Number(line.lineTotal),
        })),
      })),
      total,
      page: pageNum,
      limit: limitNum,
    };
  });

  // Get sales history for forecasting (used by Python service)
  server.post("/history", async (request, reply) => {
    const {
      storeId,
      skus,
      days,
      period = "month",
    } = request.body as {
      storeId: string;
      skus: string[];
      days?: number;
      period?: "week" | "month" | "quarter" | "year" | "custom";
    };

    try {
      // Calculate days based on period if not explicitly provided
      let analysisDays = days;
      if (!analysisDays) {
        const periodDays: Record<string, number> = {
          week: 7,
          month: 30,
          quarter: 90,
          year: 365,
        };
        analysisDays = periodDays[period] || 30;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - analysisDays);

      // Get sales for requested products
      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          createdAt: { gte: startDate },
        },
        include: {
          lines: {
            where: {
              product: {
                sku: { in: skus },
              },
            },
            include: {
              product: {
                select: {
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Group sales by SKU and date
      const history: Record<string, number[]> = {};

      // Initialize arrays for each SKU
      skus.forEach((sku) => {
        history[sku] = [];
      });

      // Group sales by date
      const salesByDate: Record<string, Record<string, number>> = {};

      sales.forEach((sale) => {
        const date = sale.createdAt.toISOString().split("T")[0];

        sale.lines.forEach((line) => {
          const sku = line.product.sku;

          if (!salesByDate[date]) {
            salesByDate[date] = {};
          }

          if (!salesByDate[date][sku]) {
            salesByDate[date][sku] = 0;
          }

          salesByDate[date][sku] += line.qty;
        });
      });

      // Convert to daily arrays
      const dates = Object.keys(salesByDate).sort();

      dates.forEach((date) => {
        skus.forEach((sku) => {
          history[sku].push(salesByDate[date][sku] || 0);
        });
      });

      // If no sales data, return empty arrays
      skus.forEach((sku) => {
        if (history[sku].length === 0) {
          // Return at least 7 days of zeros to avoid division by zero
          history[sku] = new Array(7).fill(0);
        }
      });

      return {
        history,
        days: dates.length || 7,
        analysisDays,
        period,
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch sales history" });
    }
  });
};
