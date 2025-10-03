import { PrismaClient } from "@prisma/client";
import { meiliClient } from "../src/lib/meilisearch.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Syncing products to Meilisearch...");

  const products = await prisma.product.findMany({
    include: {
      category: true,
      taxClass: true,
    },
  });

  console.log(`Found ${products.length} products to sync`);

  const index = meiliClient.index("products");

  const documents = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    unit: product.unit,
    packSize: product.packSize,
    categoryId: product.categoryId,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
  }));

  // Add all documents at once with explicit primary key
  const task = await index.addDocuments(documents, { primaryKey: "id" });
  console.log(`⏳ Indexing task created: ${task.taskUid}`);

  // Wait for the task to complete
  await index.waitForTask(task.taskUid);
  console.log(`✅ All ${products.length} products synced to Meilisearch!`);
}

main()
  .catch((e) => {
    console.error("❌ Error syncing products:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });