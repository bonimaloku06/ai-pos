import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import type {
  GenerateReorderSuggestionsRequest,
  ApproveReorderSuggestionsRequest,
} from "shared-types";

export const reorderSuggestionRoutes: FastifyPluginAsync = async (server) => {
  // List reorder suggestions
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { storeId, status, productId } = request.query as {
      storeId?: string;
      status?: string;
      productId?: string;
    };

    const suggestions = await prisma.reorderSuggestion.findMany({
      where: {
        ...(storeId && { storeId }),
        ...(status && { status }),
        ...(productId && { productId }),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            leadTimeDays: true,
            deliveryDays: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { suggestionDate: "desc" },
    });

    return { suggestions };
  });

  // Get single suggestion
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const suggestion = await prisma.reorderSuggestion.findUnique({
      where: { id },
      include: {
        product: true,
        supplier: true,
        store: true,
      },
    });

    if (!suggestion) {
      return reply.status(404).send({ error: "Suggestion not found" });
    }

    return { suggestion };
  });

  // Generate new suggestions (calls V3 forecast service with ML)
  server.post("/generate", { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as GenerateReorderSuggestionsRequest & {
      coverageDays?: number;
      includeSupplierComparison?: boolean;
    };
    const user = (request as any).user;

    // Validate store
    const store = await prisma.store.findUnique({
      where: { id: body.storeId },
      include: {
        forecastParams: true,
      },
    });

    if (!store) {
      return reply.status(404).send({ error: "Store not found" });
    }

    const serviceLevel = body.serviceLevel || store.forecastParams[0]?.serviceLevel || 0.95;
    const coverageDays = body.coverageDays || 7; // Default 1 week coverage

    // Get all active products with their current stock and supplier info
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        batches: {
          where: { storeId: body.storeId },
          include: {
            supplier: true,
          },
        },
        productSuppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                leadTimeDays: true,
              },
            },
          },
        },
      },
    });

    // Get all suppliers for price comparison
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
    });

    // Prepare V3 request
    const skus = products.map((p) => p.sku);
    const currentStock: Record<string, number> = {};
    const supplierPrices: Record<string, Record<string, number>> = {};
    const productSuppliers: Record<string, string> = {}; // Track primary supplier per product

    for (const product of products) {
      // Calculate current stock from batches
      currentStock[product.sku] = product.batches.reduce((sum, b) => sum + b.qtyOnHand, 0);

      // Get supplier prices for this product
      supplierPrices[product.sku] = {};

      // Primary supplier (from first batch)
      const primarySupplier = product.batches[0]?.supplier;
      if (primarySupplier) {
        productSuppliers[product.sku] = primarySupplier.id;
        supplierPrices[product.sku][primarySupplier.name.toLowerCase()] = Number(
          product.batches[0]?.unitCost || 0
        );
      }

      // Additional suppliers from productSuppliers
      if (product.productSuppliers && product.productSuppliers.length > 0) {
        for (const sp of product.productSuppliers) {
          const supplierName = sp.supplier.name.toLowerCase();
          supplierPrices[product.sku][supplierName] = Number(sp.unitCost || 0);

          // If no primary supplier, use first available
          if (!productSuppliers[product.sku]) {
            productSuppliers[product.sku] = sp.supplier.id;
          }
        }
      }
    }

    // Call V3 forecast service with ML analysis
    const forecastServiceUrl = process.env.FORECAST_SVC_URL || "http://localhost:8000";

    try {
      const response = await fetch(`${forecastServiceUrl}/v3/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: body.storeId,
          skus,
          currentStock,
          supplierPrices,
          coverageDays,
          includeAnalysis: true,
          analysisPeriodDays: 30, // Last 30 days for ML analysis
        }),
      });

      if (!response.ok) {
        throw new Error(`Forecast service error: ${response.statusText}`);
      }

      const data = await response.json();

      // Save suggestions to database with V3 enhanced data
      const savedSuggestions = [];

      for (const rec of data.recommendations) {
        const product = products.find((p) => p.sku === rec.sku);
        if (!product) continue;

        // Get best supplier option
        const bestSupplier = rec.supplierOptions?.[0];
        const supplierId = bestSupplier
          ? suppliers.find((s) => s.name.toLowerCase() === bestSupplier.supplier_name.toLowerCase())
              ?.id
          : productSuppliers[rec.sku];

        // Parse delivery date
        let nextDeliveryDate = null;
        if (bestSupplier?.delivery_date) {
          nextDeliveryDate = new Date(bestSupplier.delivery_date);
        }

        // Create comprehensive suggestion
        const saved = await prisma.reorderSuggestion.create({
          data: {
            productId: product.id,
            storeId: body.storeId,
            supplierId: supplierId || null,
            rop: rec.rop || 0,
            orderQty: rec.recommendedOrderQty,
            reason: {
              // Current Stock (from real inventory)
              currentStock: rec.currentStock,

              // ML Analysis
              pattern: rec.pattern,
              patternConfidence: rec.patternConfidence,
              trend: rec.trend,
              forecastedDemand: rec.forecastedDailyDemand,

              // Urgency
              urgency: rec.urgency,
              daysRemaining: rec.daysRemaining,
              message: rec.recommendation?.message,
              action: rec.recommendation?.action,

              // Supplier Info
              recommendedSupplier: bestSupplier?.supplier_name,
              supplierCost: bestSupplier?.total_cost,
              deliveryDays: bestSupplier?.days_until_delivery,
              savings: bestSupplier?.savings_vs_max,
              savingsPercent: bestSupplier?.savings_percent,

              // Coverage Scenarios
              coverageScenarios: rec.coverageScenarios,
              supplierOptions: rec.supplierOptions,
            },
            analysisPeriodDays: 30,
            stockDuration: rec.daysRemaining,
            urgencyLevel: rec.urgency,
            nextDeliveryDate,
            scenarios: rec.coverageScenarios,
            status: "PENDING",
          },
          include: {
            product: true,
            supplier: true,
          },
        });

        savedSuggestions.push(saved);
      }

      // Audit log (only if user exists)
      try {
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "CREATE",
            entity: "reorder_suggestions",
            entityId: body.storeId,
            diff: {
              generated: savedSuggestions.length,
              summary: data.summary,
              version: "v3-ml",
            },
          },
        });
      } catch (auditError) {
        console.warn("Failed to create audit log:", auditError);
        // Continue without audit log
      }

      return {
        message: `Generated ${savedSuggestions.length} AI-powered reorder suggestions`,
        suggestions: savedSuggestions,
        summary: data.summary,
        mlVersion: "v3",
      };
    } catch (error: any) {
      server.log.error("Forecast service error:", error);
      console.error("Full error details:", {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });

      // Check if it's a connection error
      const isConnectionError =
        error.message?.includes("fetch failed") || error.cause?.code === "ECONNREFUSED";

      if (isConnectionError) {
        return reply.status(503).send({
          error: "Forecast service unavailable",
          message: "The AI forecast service is not running. Please start it with: pnpm dev",
          details:
            "The forecast service must be running on http://localhost:8000 to generate AI-powered reorder suggestions.",
        });
      }

      return reply.status(500).send({
        error: "Failed to generate suggestions",
        details: error.message,
        errorType: error.constructor.name,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  // Approve suggestions
  server.post("/approve", { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as ApproveReorderSuggestionsRequest;
    const user = (request as any).user;

    // Validate suggestions exist
    const suggestions = await prisma.reorderSuggestion.findMany({
      where: {
        id: { in: body.suggestionIds },
        status: "PENDING",
      },
      include: {
        product: true,
        supplier: true,
      },
    });

    if (suggestions.length === 0) {
      return reply.status(404).send({ error: "No pending suggestions found" });
    }

    // Update status
    await prisma.reorderSuggestion.updateMany({
      where: { id: { in: body.suggestionIds } },
      data: { status: "APPROVED" },
    });

    // Optionally generate POs
    let createdPOs: any[] = [];
    if (body.generatePO) {
      // Group suggestions by supplier
      const bySupplier = suggestions.reduce(
        (acc, s) => {
          const supplierId = s.supplierId || "unknown";
          if (!acc[supplierId]) acc[supplierId] = [];
          acc[supplierId].push(s);
          return acc;
        },
        {} as Record<string, typeof suggestions>
      );

      // Create PO for each supplier
      for (const [supplierId, items] of Object.entries(bySupplier)) {
        if (supplierId === "unknown" || !items[0].supplier) continue;

        const supplier = items[0].supplier;
        const expectedAt = new Date();
        expectedAt.setDate(expectedAt.getDate() + supplier.leadTimeDays);

        // Generate PO number
        const poCount = await prisma.purchaseOrder.count();
        const poNumber = `PO-${Date.now()}-${poCount + 1}`;

        // Calculate total
        const totalCost = items.reduce((sum, item) => {
          const unitCost = item.product.batches?.[0]?.unitCost || 0;
          return sum + Number(unitCost) * item.orderQty;
        }, 0);

        const po = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            supplierId,
            status: "DRAFT",
            expectedAt,
            totalCost,
            createdBy: user.id,
            notes: `Auto-generated from reorder suggestions`,
            lines: {
              create: items.map((item) => ({
                productId: item.productId,
                qty: item.orderQty,
                unitCost: item.product.batches?.[0]?.unitCost || 0,
                notes: `ROP: ${item.rop}`,
              })),
            },
          },
          include: {
            lines: {
              include: { product: true },
            },
            supplier: true,
          },
        });

        createdPOs.push(po);

        // Update suggestions with PO reference
        await prisma.reorderSuggestion.updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: { status: "ORDERED" },
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "UPDATE",
        entity: "reorder_suggestions",
        entityId: body.suggestionIds.join(","),
        diff: { approved: body.suggestionIds.length, posCreated: createdPOs.length },
      },
    });

    return {
      message: `Approved ${suggestions.length} suggestions`,
      purchaseOrders: createdPOs,
    };
  });

  // Reject suggestions
  server.post("/reject", { preHandler: authenticate }, async (request, reply) => {
    const { suggestionIds } = request.body as { suggestionIds: string[] };
    const user = (request as any).user;

    await prisma.reorderSuggestion.updateMany({
      where: { id: { in: suggestionIds } },
      data: { status: "REJECTED" },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "UPDATE",
        entity: "reorder_suggestions",
        entityId: suggestionIds.join(","),
        diff: { rejected: suggestionIds.length },
      },
    });

    return { message: `Rejected ${suggestionIds.length} suggestions` };
  });

  // Update suggestion (manual adjustment)
  server.patch("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { orderQty, rop, notes } = request.body as {
      orderQty?: number;
      rop?: number;
      notes?: string;
    };
    const user = (request as any).user;

    const existing = await prisma.reorderSuggestion.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Suggestion not found" });
    }

    const updated = await prisma.reorderSuggestion.update({
      where: { id },
      data: {
        ...(orderQty !== undefined && { orderQty }),
        ...(rop !== undefined && { rop }),
        ...(notes !== undefined && {
          reason: {
            ...((existing.reason as any) || {}),
            manualNote: notes,
          },
        }),
      },
      include: {
        product: true,
        supplier: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "UPDATE",
        entity: "reorder_suggestions",
        entityId: id,
        diff: { before: existing, after: updated },
      },
    });

    return { suggestion: updated };
  });

  // Delete suggestion
  server.delete("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const existing = await prisma.reorderSuggestion.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Suggestion not found" });
    }

    await prisma.reorderSuggestion.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "DELETE",
        entity: "reorder_suggestions",
        entityId: id,
        diff: { deleted: existing },
      },
    });

    return reply.status(204).send();
  });

  // Clear all suggestions for a store
  server.delete("/clear", { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string };
    const user = (request as any).user;

    if (!storeId) {
      return reply.status(400).send({ error: "Store ID is required" });
    }

    // Delete all suggestions for the store
    const deletedCount = await prisma.reorderSuggestion.deleteMany({
      where: { storeId },
    });

    // Audit log (only if user exists)
    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "DELETE",
          entity: "reorder_suggestions",
          entityId: storeId,
          diff: {
            deletedCount: deletedCount.count,
            action: "clear_all_suggestions",
          },
        },
      });
    } catch (auditError) {
      console.warn("Failed to create audit log:", auditError);
      // Continue without audit log
    }

    return {
      message: `Cleared ${deletedCount.count} suggestions for store`,
      deletedCount: deletedCount.count,
    };
  });

  // Calculate stock duration
  server.post("/calculate-duration", { preHandler: authenticate }, async (request, reply) => {
    const {
      productId,
      storeId,
      currentStock,
      orderQty = 0,
      days = 30,
    } = request.body as {
      productId: string;
      storeId: string;
      currentStock: number;
      orderQty?: number;
      days?: number;
    };

    try {
      // Get product to verify it exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { sku: true, name: true },
      });

      if (!product) {
        return reply.status(404).send({ error: "Product not found" });
      }

      // Calculate sales history for the specified period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const sales = await prisma.sale.findMany({
        where: {
          storeId,
          createdAt: { gte: startDate },
        },
        include: {
          lines: {
            where: { productId },
          },
        },
      });

      // Calculate total quantity sold
      let totalQtySold = 0;
      sales.forEach((sale) => {
        sale.lines.forEach((line) => {
          totalQtySold += line.qty;
        });
      });

      // Calculate average daily demand
      const avgDailyDemand = totalQtySold / days;

      // Calculate durations
      const currentDuration = avgDailyDemand > 0 ? currentStock / avgDailyDemand : 999;
      const projectedStock = currentStock + orderQty;
      const projectedDuration = avgDailyDemand > 0 ? projectedStock / avgDailyDemand : 999;

      // Generate multiple scenarios
      const scenarios = [0.5, 1.0, 1.5, 2.0].map((multiplier) => {
        const qty = Math.ceil(avgDailyDemand * days * multiplier);
        const totalStock = currentStock + qty;
        const duration = avgDailyDemand > 0 ? totalStock / avgDailyDemand : 999;

        return {
          label:
            multiplier === 0.5
              ? "Conservative"
              : multiplier === 1.0
                ? "Recommended"
                : multiplier === 1.5
                  ? "Bulk"
                  : "Extra Bulk",
          orderQty: qty,
          projectedStock: totalStock,
          projectedDuration: Math.round(duration * 100) / 100,
        };
      });

      return {
        product: {
          id: productId,
          sku: product.sku,
          name: product.name,
        },
        currentStock,
        currentDuration: Math.round(currentDuration * 100) / 100,
        projectedStock,
        projectedDuration: Math.round(projectedDuration * 100) / 100,
        avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
        analysisPeriodDays: days,
        scenarios,
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to calculate stock duration" });
    }
  });
};
