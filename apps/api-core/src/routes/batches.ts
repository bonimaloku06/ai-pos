import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

export const batchRoutes: FastifyPluginAsync = async (server) => {
  // Get all batches with pagination and filters
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { page = 1, limit = 50, storeId, productId, hasStock } = request.query as {
      page?: number;
      limit?: number;
      storeId?: string;
      productId?: string;
      hasStock?: string;
    };

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (productId) where.productId = productId;
    if (hasStock === "true") where.qtyOnHand = { gt: 0 };

    try {
      const [batches, total] = await Promise.all([
        prisma.batch.findMany({
          where,
          include: {
            product: {
              include: {
                category: true,
              },
            },
            supplier: true,
            store: true,
          },
          skip: offset,
          take: limitNum,
          orderBy: [{ expiryDate: "asc" }, { receivedAt: "desc" }],
        }),
        prisma.batch.count({ where }),
      ]);

      // Calculate days until expiry for each batch
      const now = new Date();
      const batchesWithExpiry = batches.map((batch) => ({
        ...batch,
        unitCost: Number(batch.unitCost),
        daysUntilExpiry: Math.ceil(
          (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

      return {
        batches: batchesWithExpiry,
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch batches" });
    }
  });

  // Get expiring batches (within next 90 days)
  server.get("/expiring", { preHandler: authenticate }, async (request, reply) => {
    const { days = 90, storeId } = request.query as {
      days?: number;
      storeId?: string;
    };

    const daysNum = Number(days);
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysNum);

    const where: any = {
      expiryDate: {
        gte: now,
        lte: futureDate,
      },
      qtyOnHand: { gt: 0 },
    };

    if (storeId) where.storeId = storeId;

    try {
      const batches = await prisma.batch.findMany({
        where,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          supplier: true,
          store: true,
        },
        orderBy: { expiryDate: "asc" },
      });

      // Calculate days until expiry and value at risk
      const batchesWithExpiry = batches.map((batch) => ({
        ...batch,
        unitCost: Number(batch.unitCost),
        daysUntilExpiry: Math.ceil(
          (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
        valueAtRisk: batch.qtyOnHand * Number(batch.unitCost),
      }));

      return { batches: batchesWithExpiry };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch expiring batches" });
    }
  });

  // Get inventory summary by product
  server.get("/inventory-summary", { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };

    try {
      // Get all products with their batch information
      const products = await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          batches: storeId ? { some: { storeId } } : undefined,
        },
        include: {
          category: true,
          batches: {
            where: {
              qtyOnHand: { gt: 0 },
              ...(storeId ? { storeId } : {}),
            },
            orderBy: { expiryDate: "asc" },
          },
        },
      });

      // Calculate inventory metrics for each product
      const now = new Date();
      const inventory = products.map((product) => {
        const totalQty = product.batches.reduce((sum, b) => sum + b.qtyOnHand, 0);
        const totalValue = product.batches.reduce(
          (sum, b) => sum + b.qtyOnHand * Number(b.unitCost),
          0
        );
        const avgCost = totalQty > 0 ? totalValue / totalQty : 0;

        // Find earliest expiring batch
        const earliestBatch = product.batches[0];
        const daysUntilExpiry = earliestBatch
          ? Math.ceil(
              (earliestBatch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            )
          : null;

        return {
          product,
          totalQty,
          totalValue,
          avgCost,
          batchCount: product.batches.length,
          earliestExpiry: earliestBatch?.expiryDate || null,
          daysUntilExpiry,
        };
      });

      return { inventory };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch inventory summary" });
    }
  });
};