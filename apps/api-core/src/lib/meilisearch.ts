import { MeiliSearch } from "meilisearch";
import { config } from "../config.js";

if (!config.meilisearch.apiKey) {
  throw new Error("MEILI_MASTER_KEY is not set in environment variables");
}

export const meiliClient = new MeiliSearch({
  host: config.meilisearch.host,
  apiKey: config.meilisearch.apiKey,
});

// Initialize product index
export async function initializeProductIndex() {
  try {
    const index = meiliClient.index("products");

    // Set searchable attributes
    await index.updateSearchableAttributes([
      "name",
      "sku",
      "barcode",
      "description",
      "activeIngredientName",
      "dosage",
    ]);

    // Set filterable attributes
    await index.updateFilterableAttributes(["status", "categoryId"]);

    // Set sortable attributes
    await index.updateSortableAttributes(["name", "createdAt"]);

    console.log("✓ Meilisearch product index initialized");
  } catch (error) {
    console.error("Failed to initialize Meilisearch:", error);
  }
}

// Sync product to Meilisearch
export async function syncProductToSearch(product: any) {
  const index = meiliClient.index("products");
  const result = await index.addDocuments(
    [
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        description: product.description,
        activeIngredientName: product.activeIngredient?.name || null,
        dosage: product.dosage,
        unit: product.unit,
        packSize: product.packSize,
        categoryId: product.categoryId,
        status: product.status,
        createdAt: typeof product.createdAt === 'string' ? product.createdAt : product.createdAt.toISOString(),
      },
    ],
    { primaryKey: "id" }
  );
  return result;
}

// Remove product from search
export async function removeProductFromSearch(productId: string) {
  try {
    const index = meiliClient.index("products");
    await index.deleteDocument(productId);
  } catch (error) {
    console.error("Failed to remove product from search:", error);
  }
}

// Search products
export async function searchProducts(
  query: string,
  options: { limit?: number; offset?: number; filter?: string } = {}
) {
  try {
    const index = meiliClient.index("products");

    const results = await index.search(query, {
      limit: options.limit || 20,
      offset: options.offset || 0,
      filter: options.filter,
    });

    return results;
  } catch (error) {
    console.error("Failed to search products:", error);
    return { hits: [], estimatedTotalHits: 0 };
  }
}
