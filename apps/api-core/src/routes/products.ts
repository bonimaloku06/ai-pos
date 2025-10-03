import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { syncProductToSearch, removeProductFromSearch, searchProducts } from "../lib/meilisearch.js";

export const productRoutes: FastifyPluginAsync = async (server) => {
  // Sync all products to Meilisearch (admin only)
  server.post("/sync-all", { preHandler: authorize("ADMIN") }, async (request, reply) => {
    try {
      const products = await prisma.product.findMany({
        include: {
          activeIngredient: true,
        },
      });

      for (const product of products) {
        await syncProductToSearch(product);
      }

      return { message: `Synced ${products.length} products to search index` };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to sync products" });
    }
  });

  // Get products with search and pagination
  server.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { query, page = 1, limit = 20, categoryId, status } = request.query as {
      query?: string;
      page?: number;
      limit?: number;
      categoryId?: string;
      status?: string;
    };

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      // If there's a search query, use Meilisearch
      if (query && query.trim()) {
        let filter = [];
        if (status) filter.push(`status = ${status}`);
        if (categoryId) filter.push(`categoryId = ${categoryId}`);

        const searchResults = await searchProducts(query, {
          limit: limitNum,
          offset,
          filter: filter.length > 0 ? filter.join(" AND ") : undefined,
        });

        // Get full product details from database
        const productIds = searchResults.hits.map((hit: any) => hit.id);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          include: {
            category: true,
            taxClass: true,
            activeIngredient: true,
            batches: {
              where: { qtyOnHand: { gt: 0 } },
              orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
            },
          },
        });

        // Sort products by search relevance
        const sortedProducts = productIds
          .map(id => products.find(p => p.id === id))
          .filter(Boolean);

        return {
          products: sortedProducts,
          total: searchResults.estimatedTotalHits || 0,
          page: pageNum,
          limit: limitNum,
        };
      }

      // Otherwise, use database query
      const where: any = {};
      if (status) where.status = status;
      if (categoryId) where.categoryId = categoryId;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true,
            taxClass: true,
            activeIngredient: true,
            batches: {
              where: { qtyOnHand: { gt: 0 } },
              orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
            },
          },
          skip: offset,
          take: limitNum,
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.count({ where }),
      ]);

      return {
        products,
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch products" });
    }
  });

  // Get single product
  server.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        taxClass: true,
        activeIngredient: true,
        batches: {
          where: { qtyOnHand: { gt: 0 } },
          orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
        },
      },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    return {
      product: {
        ...product,
        batches: product.batches.map(batch => ({
          ...batch,
          unitCost: Number(batch.unitCost),
        })),
      }
    };
  });

  // Create product
  server.post("/", { preHandler: authorize("ADMIN", "MANAGER") }, async (request, reply) => {
    const data = request.body as {
      name: string;
      sku: string;
      barcode?: string;
      description?: string;
      activeIngredientId?: string;
      dosage?: string;
      unit?: string;
      packSize?: number;
      categoryId?: string;
      taxClassId?: string;
      defaultRetailPrice?: number;
    };

    // Validation
    if (!data.name || !data.sku) {
      return reply.status(400).send({ error: "Name and SKU are required" });
    }

    // Check for duplicate SKU
    const existing = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existing) {
      return reply.status(409).send({ error: "Product with this SKU already exists" });
    }

    // Check for duplicate barcode
    if (data.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: data.barcode },
      });

      if (existingBarcode) {
        return reply.status(409).send({ error: "Product with this barcode already exists" });
      }
    }

    try {
      const product = await prisma.product.create({
        data: {
          name: data.name,
          sku: data.sku,
          barcode: data.barcode || null,
          description: data.description || null,
          activeIngredientId: data.activeIngredientId || null,
          dosage: data.dosage || null,
          unit: data.unit || "unit",
          packSize: data.packSize || 1,
          categoryId: data.categoryId || null,
          taxClassId: data.taxClassId || null,
          defaultRetailPrice: data.defaultRetailPrice || null,
          status: "ACTIVE",
        },
        include: {
          category: true,
          taxClass: true,
          activeIngredient: true,
        },
      });

      // Sync to Meilisearch
      await syncProductToSearch(product);

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "CREATE",
          entity: "products",
          entityId: product.id,
          diff: { new: product },
        },
      });

      return reply.status(201).send({ product });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to create product" });
    }
  });

  // Update product
  // Update product (PATCH)
  server.patch("/:id", { preHandler: authorize("ADMIN", "MANAGER") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as {
      name?: string;
      sku?: string;
      barcode?: string;
      description?: string;
      activeIngredientId?: string;
      dosage?: string;
      unit?: string;
      packSize?: number;
      categoryId?: string;
      taxClassId?: string;
      defaultRetailPrice?: number;
      status?: string;
    };

    const existing = await prisma.product.findUnique({ where: { id } });

    if (!existing) {
      return reply.status(404).send({ error: "Product not found" });
    }

    // Check for duplicate SKU if changing
    if (data.sku && data.sku !== existing.sku) {
      const duplicate = await prisma.product.findUnique({
        where: { sku: data.sku },
      });

      if (duplicate) {
        return reply.status(409).send({ error: "Product with this SKU already exists" });
      }
    }

    // Check for duplicate barcode if changing
    if (data.barcode && data.barcode !== existing.barcode) {
      const duplicate = await prisma.product.findUnique({
        where: { barcode: data.barcode },
      });

      if (duplicate) {
        return reply.status(409).send({ error: "Product with this barcode already exists" });
      }
    }

    try {
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.sku !== undefined && { sku: data.sku }),
          ...(data.barcode !== undefined && { barcode: data.barcode }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.activeIngredientId !== undefined && { activeIngredientId: data.activeIngredientId }),
          ...(data.dosage !== undefined && { dosage: data.dosage }),
          ...(data.unit !== undefined && { unit: data.unit }),
          ...(data.packSize !== undefined && { packSize: data.packSize }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.taxClassId !== undefined && { taxClassId: data.taxClassId }),
          ...(data.defaultRetailPrice !== undefined && { defaultRetailPrice: data.defaultRetailPrice }),
          ...(data.status !== undefined && { status: data.status as any }),
        },
        include: {
          category: true,
          taxClass: true,
          activeIngredient: true,
        },
      });

      // Sync to Meilisearch
      await syncProductToSearch(product);

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "UPDATE",
          entity: "products",
          entityId: product.id,
          diff: { old: existing, new: product },
        },
      });

      return { product };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to update product" });
    }
  });

  // Delete product (soft delete by setting status to DISCONTINUED)
  server.delete("/:id", { preHandler: authorize("ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.product.findUnique({ where: { id } });

    if (!existing) {
      return reply.status(404).send({ error: "Product not found" });
    }

    try {
      const product = await prisma.product.update({
        where: { id },
        data: { status: "DISCONTINUED" },
      });

      // Remove from search or update status
      await syncProductToSearch(product);

      // Log audit
      const user = request.user as { id: string };
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "DELETE",
          entity: "products",
          entityId: product.id,
          diff: { old: existing, new: product },
        },
      });

      return { success: true, product };
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: "Failed to delete product" });
    }
  });

  // Get batches for a product (FEFO ordered)
  server.get("/:id/batches", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const batches = await prisma.batch.findMany({
      where: {
        productId: id,
        qtyOnHand: { gt: 0 },
      },
      include: {
        supplier: true,
        store: true,
      },
      orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
    });

    return {
      batches: batches.map(batch => ({
        ...batch,
        unitCost: Number(batch.unitCost),
      }))
    };
  });
};