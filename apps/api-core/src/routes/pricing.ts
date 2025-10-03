import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { Decimal } from "@prisma/client/runtime/library";
import type { CreatePriceRuleRequest, UpdatePriceRuleRequest } from "shared-types";

export const pricingRoutes: FastifyPluginAsync = async (server) => {
  // List price rules
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { scope, scopeId, isActive } = request.query as {
      scope?: string;
      scopeId?: string;
      isActive?: string;
    };

    const rules = await prisma.priceRule.findMany({
      where: {
        ...(scope && { scope: scope as any }),
        ...(scopeId && { scopeId }),
        ...(isActive !== undefined && { isActive: isActive === "true" }),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return {
      rules: rules.map(rule => ({
        ...rule,
        value: Number(rule.value),
      }))
    };
  });

  // Get single price rule
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const rule = await prisma.priceRule.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    if (!rule) {
      return reply.status(404).send({ error: "Price rule not found" });
    }

    return {
      rule: {
        ...rule,
        value: Number(rule.value),
      }
    };
  });

  // Create price rule
  server.post("/", { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as CreatePriceRuleRequest;
    const user = (request as any).user;

    // Validate scope and scopeId
    if (body.scope === "PRODUCT" && !body.scopeId) {
      return reply.status(400).send({ error: "scopeId required for PRODUCT scope" });
    }

    if (body.scope === "PRODUCT") {
      const product = await prisma.product.findUnique({
        where: { id: body.scopeId },
      });
      if (!product) {
        return reply.status(404).send({ error: "Product not found" });
      }
    }

    const rule = await prisma.priceRule.create({
      data: {
        scope: body.scope,
        scopeId: body.scopeId,
        ruleType: body.ruleType,
        value: new Decimal(body.value),
        roundingMode: body.roundingMode || "NEAREST_99",
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        priority: body.priority || 0,
        isActive: true,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "CREATE",
        entity: "price_rules",
        entityId: rule.id,
        diff: { created: rule },
      },
    });

    return reply.status(201).send({
      rule: {
        ...rule,
        value: Number(rule.value),
      }
    });
  });

  // Update price rule
  server.patch("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdatePriceRuleRequest;
    const user = (request as any).user;

    const existing = await prisma.priceRule.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Price rule not found" });
    }

    // Validate product if scopeId is being updated
    if (body.scopeId && body.scope === "PRODUCT") {
      const product = await prisma.product.findUnique({
        where: { id: body.scopeId },
      });
      if (!product) {
        return reply.status(404).send({ error: "Product not found" });
      }
    }

    const rule = await prisma.priceRule.update({
      where: { id },
      data: {
        ...(body.scope && { scope: body.scope }),
        ...(body.scopeId !== undefined && { scopeId: body.scopeId }),
        ...(body.ruleType && { ruleType: body.ruleType }),
        ...(body.value !== undefined && { value: new Decimal(body.value) }),
        ...(body.roundingMode && { roundingMode: body.roundingMode }),
        ...(body.startDate !== undefined && {
          startDate: body.startDate ? new Date(body.startDate) : null,
        }),
        ...(body.endDate !== undefined && {
          endDate: body.endDate ? new Date(body.endDate) : null,
        }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "UPDATE",
        entity: "price_rules",
        entityId: rule.id,
        diff: { before: existing, after: rule },
      },
    });

    return {
      rule: {
        ...rule,
        value: Number(rule.value),
      }
    };
  });

  // Delete price rule
  server.delete("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const existing = await prisma.priceRule.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Price rule not found" });
    }

    await prisma.priceRule.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "DELETE",
        entity: "price_rules",
        entityId: id,
        diff: { deleted: existing },
      },
    });

    return reply.status(204).send();
  });

  // Calculate price for a product based on cost
  server.post("/calculate", { preHandler: authenticate }, async (request, reply) => {
    const { productId, unitCost } = request.body as {
      productId: string;
      unitCost: number;
    };

    if (!productId || unitCost === undefined) {
      return reply.status(400).send({ error: "productId and unitCost required" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        priceRules: {
          where: {
            isActive: true,
            OR: [
              { startDate: null, endDate: null },
              { startDate: { lte: new Date() }, endDate: { gte: new Date() } },
              { startDate: { lte: new Date() }, endDate: null },
            ],
          },
          orderBy: { priority: "desc" },
        },
        category: true,
      },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    // Find applicable rule (product-specific > category > global)
    let applicableRule = product.priceRules.find((r) => r.scope === "PRODUCT");

    if (!applicableRule && product.categoryId) {
      // Check category rules
      const categoryRules = await prisma.priceRule.findMany({
        where: {
          scope: "CATEGORY",
          scopeId: product.categoryId,
          isActive: true,
        },
        orderBy: { priority: "desc" },
      });
      applicableRule = categoryRules[0];
    }

    if (!applicableRule) {
      // Check global rules
      const globalRules = await prisma.priceRule.findMany({
        where: {
          scope: "GLOBAL",
          isActive: true,
        },
        orderBy: { priority: "desc" },
      });
      applicableRule = globalRules[0];
    }

    if (!applicableRule) {
      return {
        suggestedPrice: unitCost,
        appliedRule: null,
        calculation: "No pricing rule found",
      };
    }

    // Calculate price
    let price = unitCost;
    if (applicableRule.ruleType === "MARKUP_PERCENT") {
      const markup = Number(applicableRule.value);
      price = unitCost * (1 + markup / 100);
    } else if (applicableRule.ruleType === "FIXED_PRICE") {
      price = Number(applicableRule.value);
    } else if (applicableRule.ruleType === "DISCOUNT") {
      const discount = Number(applicableRule.value);
      price = unitCost * (1 - discount / 100);
    }

    // Apply rounding
    const roundedPrice = applyRounding(price, applicableRule.roundingMode);

    return {
      suggestedPrice: roundedPrice,
      appliedRule: {
        id: applicableRule.id,
        scope: applicableRule.scope,
        ruleType: applicableRule.ruleType,
        value: Number(applicableRule.value),
        roundingMode: applicableRule.roundingMode,
      },
      calculation: {
        unitCost,
        beforeRounding: price,
        afterRounding: roundedPrice,
      },
    };
  });
};

// Helper function for rounding
function applyRounding(price: number, mode: string): number {
  switch (mode) {
    case "NEAREST_99":
      return Math.floor(price) + 0.99;
    case "NEAREST_95":
      return Math.floor(price) + 0.95;
    case "NEAREST_50":
      return Math.round(price * 2) / 2;
    case "ROUND_UP":
      return Math.ceil(price);
    case "ROUND_DOWN":
      return Math.floor(price);
    case "NONE":
    default:
      return Math.round(price * 100) / 100; // 2 decimal places
  }
}