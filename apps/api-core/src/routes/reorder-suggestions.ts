import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import type { GenerateReorderSuggestionsRequest, ApproveReorderSuggestionsRequest } from "shared-types";

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

  // Generate new suggestions (calls forecast service)
  server.post("/generate", { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as GenerateReorderSuggestionsRequest;
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

    // Calculate year-to-date days (from January 1 to today)
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const analysisPeriodDays = Math.ceil((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

    // Get all active products with their current stock
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        batches: {
          where: { storeId: body.storeId },
        },
      },
    });

    // Get supplier lead times
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
    });

    // Prepare request for forecast service
    const skus = products.map((p) => p.sku);
    const leadTimes: Record<string, number> = {};
    const currentStock: Record<string, number> = {};

    // Map products to suppliers and calculate current stock
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
      // Calculate current stock from batches (REAL INVENTORY DATA)
      currentStock[product.sku] = product.batches.reduce((sum, b) => sum + b.qtyOnHand, 0);
    }

    // Call forecast service (using enhanced v2 endpoint)
    const forecastServiceUrl = process.env.FORECAST_SVC_URL || "http://localhost:8000";

    try {
      const zScore = serviceLevel >= 0.99 ? 2.33 : serviceLevel >= 0.95 ? 1.65 : 1.28;

      const response = await fetch(`${forecastServiceUrl}/recommendations-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: body.storeId,
          asOf: new Date().toISOString(),
          skus,
          leadTimes,
          currentStock, // Pass real stock data to Python service
          serviceLevel: Number(serviceLevel),
          analysisPeriodDays,
          zScore,
        }),
      });

      if (!response.ok) {
        throw new Error(`Forecast service error: ${response.statusText}`);
      }

      const data = await response.json();

      // Save suggestions to database (with enhanced data)
      const savedSuggestions = [];
      for (const suggestion of data.suggestions) {
        const product = products.find((p) => p.sku === suggestion.sku);
        if (!product) continue;

        const currentStock = suggestion.currentStock;

        // Convert nextDeliveryDate to proper Date object if present
        let nextDeliveryDate = null;
        if (suggestion.nextDeliveryDate) {
          // Handle Python datetime string (may be missing timezone indicator)
          const dateStr = suggestion.nextDeliveryDate;
          // If no timezone indicator (Z or +/-), add Z to treat as UTC
          const hasTimezone = dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr);
          nextDeliveryDate = new Date(hasTimezone ? dateStr : dateStr + "Z");
        }

        // Create suggestion for all products (not just below ROP) to show urgency levels
        const saved = await prisma.reorderSuggestion.create({
          data: {
            productId: product.id,
            storeId: body.storeId,
            supplierId: productSuppliers[suggestion.sku] || null,
            rop: suggestion.rop,
            orderQty: suggestion.recommendedQty || suggestion.scenarios?.[1]?.orderQty || 0,
            reason: {
              ...suggestion.reason,
              currentStock,
              meanDemand: suggestion.meanDemand,
              stdDevDemand: suggestion.stdDevDemand,
              safetyStock: suggestion.safetyStock,
            },
            // Enhanced fields from v2 endpoint
            analysisPeriodDays: suggestion.analysisPeriodDays,
            stockDuration: suggestion.daysRemaining,
            urgencyLevel: suggestion.urgency,
            nextDeliveryDate,
            scenarios: suggestion.scenarios,
            status: "PENDING",
          },
          include: {
            product: true,
            supplier: true,
          },
        });
        savedSuggestions.push(saved);
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "CREATE",
          entity: "reorder_suggestions",
          entityId: body.storeId,
          diff: { generated: savedSuggestions.length },
        },
      });

      return {
        message: `Generated ${savedSuggestions.length} reorder suggestions`,
        suggestions: savedSuggestions,
      };
    } catch (error: any) {
      console.error("Forecast service error:", error);
      return reply.status(500).send({
        error: "Failed to generate suggestions",
        details: error.message,
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
