import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

/**
 * Nightly job to generate forecast-based reorder suggestions
 * This runs at 2 AM daily to prepare suggestions for the day
 */
export async function generateForecastSuggestions() {
  logger.info("Starting nightly forecast generation...");

  try {
    // Get all active stores
    const stores = await prisma.store.findMany({
      where: { isActive: true },
      include: {
        forecastParams: true,
      },
    });

    logger.info(`Found ${stores.length} active stores`);

    for (const store of stores) {
      try {
        logger.info(`Generating forecasts for store: ${store.name}`);

        // Get all active products
        const products = await prisma.product.findMany({
          where: { status: "ACTIVE" },
          include: {
            batches: {
              where: { storeId: store.id },
            },
          },
        });

        // Get suppliers
        const suppliers = await prisma.supplier.findMany({
          where: { isActive: true },
        });

        // Prepare data for forecast service
        const skus = products.map((p) => p.sku);
        const leadTimes: Record<string, number> = {};
        const productSuppliers: Record<string, string> = {};

        for (const product of products) {
          const supplierId = product.batches[0]?.supplierId;
          if (supplierId) {
            productSuppliers[product.sku] = supplierId;
            const supplier = suppliers.find((s) => s.id === supplierId);
            if (supplier) {
              leadTimes[product.sku] = supplier.leadTimeDays;
            }
          }
        }

        // Call forecast service
        const forecastServiceUrl = process.env.FORECAST_SVC_URL || "http://localhost:8000";
        const serviceLevel =
          store.forecastParams[0]?.serviceLevel || 0.95;

        const response = await fetch(`${forecastServiceUrl}/recommendations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: store.id,
            asOf: new Date().toISOString(),
            skus,
            leadTimes,
            serviceLevel: Number(serviceLevel),
          }),
        });

        if (!response.ok) {
          throw new Error(`Forecast service error: ${response.statusText}`);
        }

        const data = await response.json();

        // Clear old pending suggestions for this store (older than 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        await prisma.reorderSuggestion.deleteMany({
          where: {
            storeId: store.id,
            status: "PENDING",
            createdAt: { lt: sevenDaysAgo },
          },
        });

        // Save new suggestions
        let savedCount = 0;
        for (const suggestion of data.suggestions) {
          const product = products.find((p) => p.sku === suggestion.sku);
          if (!product) continue;

          const currentStock = product.batches.reduce((sum, b) => sum + b.qtyOnHand, 0);

          // Only create suggestion if we should reorder
          if (currentStock <= suggestion.rop) {
            await prisma.reorderSuggestion.create({
              data: {
                productId: product.id,
                storeId: store.id,
                supplierId: productSuppliers[suggestion.sku] || null,
                rop: suggestion.rop,
                orderQty: suggestion.orderQty,
                reason: {
                  ...suggestion.reason,
                  currentStock,
                  meanDemand: suggestion.meanDemand,
                  stdDevDemand: suggestion.stdDevDemand,
                  safetyStock: suggestion.safetyStock,
                  generatedBy: "nightly-job",
                },
                status: "PENDING",
              },
            });
            savedCount++;
          }
        }

        logger.info(
          `Generated ${savedCount} reorder suggestions for store: ${store.name}`
        );

        // Audit log
        await prisma.auditLog.create({
          data: {
            actorId: "system", // System-generated
            action: "CREATE",
            entity: "reorder_suggestions",
            entityId: store.id,
            diff: { generated: savedCount, source: "nightly-job" },
          },
        });
      } catch (storeError) {
        logger.error(`Failed to generate forecast for store ${store.name}:`, storeError);
      }
    }

    logger.info("Nightly forecast generation completed successfully");
  } catch (error) {
    logger.error("Nightly forecast generation failed:", error);
    throw error;
  }
}