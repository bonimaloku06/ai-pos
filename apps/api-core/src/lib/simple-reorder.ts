import { prisma } from "./prisma.js";

/**
 * Simple reorder calculation without forecast service
 * Uses basic ROP = (avg daily demand × lead time) + safety stock
 */
export async function generateSimpleReorderSuggestions(
  storeId: string,
  serviceLevel: number = 0.95
) {
  const analysisPeriodDays = 30; // Last 30 days

  // Get all active products with current stock
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: {
      batches: {
        where: { storeId },
      },
      suppliers: {
        include: { supplier: true },
      },
    },
  });

  // Get sales history for the period
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - analysisPeriodDays);

  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      createdAt: { gte: startDate },
    },
    include: {
      lines: true,
    },
  });

  const suggestions = [];

  for (const product of products) {
    // Calculate current stock
    const currentStock = product.batches.reduce((sum, b) => sum + b.qtyOnHand, 0);

    // Calculate sales for this product
    const productSales = sales
      .flatMap((s) => s.lines)
      .filter((line) => line.productId === product.id);

    const totalQtySold = productSales.reduce((sum, line) => sum + line.qty, 0);
    const avgDailyDemand = totalQtySold / analysisPeriodDays;

    // Skip if no demand
    if (avgDailyDemand === 0) continue;

    // Get supplier info
    const primarySupplier = product.suppliers[0];
    const leadTimeDays = primarySupplier?.supplier.leadTimeDays || 7;

    // Calculate standard deviation (simplified)
    const dailySales = new Array(analysisPeriodDays).fill(0);
    productSales.forEach((line) => {
      const saleDate = sales.find((s) => s.lines.some((l) => l.id === line.id))?.createdAt;
      if (saleDate) {
        const dayIndex = Math.floor(
          (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (dayIndex < analysisPeriodDays) {
          dailySales[analysisPeriodDays - dayIndex - 1] += line.qty;
        }
      }
    });

    const mean = avgDailyDemand;
    const variance =
      dailySales.reduce((sum, qty) => sum + Math.pow(qty - mean, 2), 0) / analysisPeriodDays;
    const stdDev = Math.sqrt(variance);

    // Calculate safety stock: z-score × std dev × √lead time
    const zScore = serviceLevel >= 0.99 ? 2.33 : serviceLevel >= 0.95 ? 1.65 : 1.28;
    const safetyStock = Math.ceil(zScore * stdDev * Math.sqrt(leadTimeDays));

    // Calculate ROP: (avg daily demand × lead time) + safety stock
    const rop = Math.ceil(avgDailyDemand * leadTimeDays + safetyStock);

    // Calculate days remaining
    const daysRemaining = currentStock / avgDailyDemand;

    // Determine urgency
    let urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    if (currentStock <= rop * 0.5) {
      urgency = "CRITICAL";
    } else if (currentStock <= rop) {
      urgency = "HIGH";
    } else if (currentStock <= rop * 1.5) {
      urgency = "MEDIUM";
    } else {
      urgency = "LOW";
    }

    // Calculate recommended order quantity (Economic Order Quantity simplified)
    // Order enough for 30 days + safety stock
    const recommendedQty = Math.max(
      Math.ceil(avgDailyDemand * 30 + safetyStock - currentStock),
      0
    );

    // Skip if we don't need to order yet
    if (urgency === "LOW" && recommendedQty === 0) continue;

    // Calculate next delivery date
    const nextDeliveryDate = new Date();
    nextDeliveryDate.setDate(nextDeliveryDate.getDate() + leadTimeDays);

    // Generate scenarios
    const scenarios = [0.5, 1.0, 1.5, 2.0].map((multiplier, index) => {
      const qty = Math.ceil(avgDailyDemand * 30 * multiplier);
      const projectedStock = currentStock + qty;
      const duration = projectedStock / avgDailyDemand;

      return {
        label:
          index === 0
            ? "Conservative"
            : index === 1
              ? "Recommended"
              : index === 2
                ? "Bulk"
                : "Extra Bulk",
        orderQty: qty,
        projectedStock,
        projectedDuration: Math.round(duration * 10) / 10,
      };
    });

    suggestions.push({
      productId: product.id,
      sku: product.sku,
      supplierId: primarySupplier?.supplierId,
      currentStock,
      rop,
      recommendedQty,
      urgency,
      daysRemaining: Math.round(daysRemaining * 10) / 10,
      nextDeliveryDate,
      analysisPeriodDays,
      scenarios,
      reason: {
        currentStock,
        meanDemand: Math.round(avgDailyDemand * 100) / 100,
        stdDevDemand: Math.round(stdDev * 100) / 100,
        safetyStock,
        leadTimeDays,
        note: "Calculated using simple ROP formula (no AI)",
      },
    });
  }

  return suggestions;
}
