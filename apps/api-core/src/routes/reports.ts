import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

export const reportRoutes: FastifyPluginAsync = async (server) => {
  // Sales Report
  server.get("/sales", { preHandler: authenticate }, async (request, reply) => {
    const { startDate, endDate, storeId, groupBy = "day" } = request.query as {
      startDate?: string;
      endDate?: string;
      storeId?: string;
      groupBy?: "day" | "week" | "month";
    };

    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        // Start of day (00:00:00)
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // End of day (23:59:59.999)
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    try {
      const sales = await prisma.sale.findMany({
        where,
        include: {
          lines: {
            include: {
              product: true,
            },
          },
          cashier: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Aggregate stats
      const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);
      const totalTransactions = sales.length;
      const totalTax = sales.reduce((sum, s) => sum + Number(s.taxTotal), 0);
      const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discountTotal), 0);
      const avgTransaction = totalSales / (totalTransactions || 1);

      // Group by time period
      const grouped: Record<string, any> = {};
      sales.forEach((sale) => {
        let key: string;
        const date = new Date(sale.createdAt);

        if (groupBy === "day") {
          key = date.toISOString().split("T")[0];
        } else if (groupBy === "week") {
          const week = Math.ceil(date.getDate() / 7);
          key = `${date.getFullYear()}-W${week}`;
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }

        if (!grouped[key]) {
          grouped[key] = {
            period: key,
            sales: 0,
            transactions: 0,
            tax: 0,
            discount: 0,
          };
        }

        grouped[key].sales += Number(sale.total);
        grouped[key].transactions += 1;
        grouped[key].tax += Number(sale.taxTotal);
        grouped[key].discount += Number(sale.discountTotal);
      });

      // Top products
      const productSales: Record<string, { qty: number; revenue: number; name: string }> = {};
      sales.forEach((sale) => {
        sale.lines.forEach((line) => {
          const key = line.productId;
          if (!productSales[key]) {
            productSales[key] = {
              name: line.product.name,
              qty: 0,
              revenue: 0,
            };
          }
          productSales[key].qty += line.qty;
          productSales[key].revenue += Number(line.lineTotal);
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        summary: {
          totalSales,
          totalTransactions,
          totalTax,
          totalDiscount,
          avgTransaction,
          period: { startDate, endDate },
        },
        timeSeries: Object.values(grouped).sort((a, b) =>
          a.period.localeCompare(b.period)
        ),
        topProducts,
      };
    } catch (error) {
      console.error("Sales report error:", error);
      return reply.status(500).send({ error: "Failed to generate sales report" });
    }
  });

  // Margins Report
  server.get("/margins", { preHandler: authenticate }, async (request, reply) => {
    const { startDate, endDate, storeId } = request.query as {
      startDate?: string;
      endDate?: string;
      storeId?: string;
    };

    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        // Start of day (00:00:00)
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // End of day (23:59:59.999)
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    try {
      const sales = await prisma.sale.findMany({
        where,
        include: {
          lines: {
            include: {
              product: true,
              batch: true,
            },
          },
        },
      });

      let totalRevenue = 0;
      let totalCost = 0;
      const productMargins: Record<
        string,
        { name: string; revenue: number; cost: number; qty: number }
      > = {};

      sales.forEach((sale) => {
        sale.lines.forEach((line) => {
          const revenue = Number(line.lineTotal);
          const cost = line.batch ? Number(line.batch.unitCost) * line.qty : 0;

          totalRevenue += revenue;
          totalCost += cost;

          const key = line.productId;
          if (!productMargins[key]) {
            productMargins[key] = {
              name: line.product.name,
              revenue: 0,
              cost: 0,
              qty: 0,
            };
          }

          productMargins[key].revenue += revenue;
          productMargins[key].cost += cost;
          productMargins[key].qty += line.qty;
        });
      });

      const totalMargin = totalRevenue - totalCost;
      const marginPercentage = (totalMargin / (totalRevenue || 1)) * 100;

      const productData = Object.entries(productMargins).map(([id, data]) => {
        const margin = data.revenue - data.cost;
        const marginPct = (margin / (data.revenue || 1)) * 100;
        return {
          productId: id,
          ...data,
          margin,
          marginPercentage: marginPct,
        };
      });

      return {
        summary: {
          totalRevenue,
          totalCost,
          totalMargin,
          marginPercentage,
        },
        products: productData.sort((a, b) => b.margin - a.margin),
      };
    } catch (error) {
      console.error("Margins report error:", error);
      return reply.status(500).send({ error: "Failed to generate margins report" });
    }
  });

  // Dead Stock Report
  server.get("/dead-stock", { preHandler: authenticate }, async (request, reply) => {
    const { storeId, daysThreshold = 90 } = request.query as {
      storeId?: string;
      daysThreshold?: number;
    };

    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - Number(daysThreshold));

      // Get all products with stock
      const batches = await prisma.batch.findMany({
        where: {
          qtyOnHand: { gt: 0 },
          ...(storeId && { storeId }),
        },
        include: {
          product: true,
        },
      });

      // Get recent sales for these products
      const productIds = [...new Set(batches.map((b) => b.productId))];

      const recentSales = await prisma.saleLine.findMany({
        where: {
          productId: { in: productIds },
          sale: {
            createdAt: { gte: thresholdDate },
          },
        },
        include: {
          product: true,
        },
      });

      // Calculate sales frequency
      const salesCount: Record<string, number> = {};
      recentSales.forEach((line) => {
        salesCount[line.productId] = (salesCount[line.productId] || 0) + 1;
      });

      // Find dead stock (no sales in threshold period)
      const deadStock = batches
        .filter((batch) => !salesCount[batch.productId])
        .map((batch) => {
          const daysInStock = Math.ceil(
            (Date.now() - batch.receivedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          const value = batch.qtyOnHand * Number(batch.unitCost);

          return {
            productId: batch.productId,
            productName: batch.product.name,
            sku: batch.product.sku,
            batchId: batch.id,
            qtyOnHand: batch.qtyOnHand,
            unitCost: Number(batch.unitCost),
            totalValue: value,
            daysInStock,
            lastReceived: batch.receivedAt,
          };
        });

      const totalValue = deadStock.reduce((sum, item) => sum + item.totalValue, 0);

      return {
        summary: {
          totalItems: deadStock.length,
          totalValue,
          daysThreshold: Number(daysThreshold),
        },
        deadStock: deadStock.sort((a, b) => b.totalValue - a.totalValue),
      };
    } catch (error) {
      console.error("Dead stock report error:", error);
      return reply.status(500).send({ error: "Failed to generate dead stock report" });
    }
  });

  // Service Level Report (stock-out analysis)
  server.get("/service-level", { preHandler: authenticate }, async (request, reply) => {
    const { storeId, startDate, endDate } = request.query as {
      storeId?: string;
      startDate?: string;
      endDate?: string;
    };

    try {
      // Get all products
      const products = await prisma.product.findMany({
        where: {
          status: "ACTIVE",
        },
        include: {
          batches: {
            where: {
              ...(storeId && { storeId }),
            },
          },
        },
      });

      const currentlyStocked = products.filter((p) =>
        p.batches.some((b) => b.qtyOnHand > 0)
      ).length;

      const outOfStock = products.filter(
        (p) => !p.batches.some((b) => b.qtyOnHand > 0)
      ).length;

      const serviceLevel = (currentlyStocked / (products.length || 1)) * 100;

      // Get stock movement history for the period
      const where: any = { type: "SALE" };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const stockMovements = await prisma.stockMovement.findMany({
        where,
        include: {
          product: true,
        },
      });

      // Identify potential stock-outs (negative movements with no stock)
      const stockOutEvents: Record<string, number> = {};
      stockMovements.forEach((movement) => {
        // This is a simplified check; real implementation would need batch availability tracking
        stockOutEvents[movement.productId] =
          (stockOutEvents[movement.productId] || 0) + 1;
      });

      return {
        summary: {
          totalProducts: products.length,
          currentlyStocked,
          outOfStock,
          serviceLevel,
        },
        outOfStockProducts: products
          .filter((p) => !p.batches.some((b) => b.qtyOnHand > 0))
          .map((p) => ({
            productId: p.id,
            name: p.name,
            sku: p.sku,
            status: p.status,
          })),
      };
    } catch (error) {
      console.error("Service level report error:", error);
      return reply.status(500).send({ error: "Failed to generate service level report" });
    }
  });
};