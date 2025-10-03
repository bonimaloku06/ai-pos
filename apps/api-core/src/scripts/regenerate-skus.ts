import { prisma } from "../lib/prisma.js";

/**
 * One-time script to regenerate SKUs for existing products
 * Run with: npx tsx src/scripts/regenerate-skus.ts
 */

function generateSKU(name: string, dosage: string | null): string {
  const namePart = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 6);

  const dosagePart = dosage
    ? dosage.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : "";

  return dosagePart ? `${namePart}-${dosagePart}` : namePart;
}

async function regenerateSKUs() {
  console.log("🔄 Starting SKU regeneration...");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      dosage: true,
    },
  });

  console.log(`Found ${products.length} products`);

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const newSKU = generateSKU(product.name, product.dosage);

    if (product.sku === newSKU) {
      console.log(`✓ ${product.name}: SKU already correct (${product.sku})`);
      skipped++;
      continue;
    }

    // Check if new SKU already exists
    const existing = await prisma.product.findUnique({
      where: { sku: newSKU },
    });

    if (existing) {
      console.log(
        `⚠️  ${product.name}: Cannot update SKU (${newSKU} already exists)`
      );
      skipped++;
      continue;
    }

    // Update SKU
    await prisma.product.update({
      where: { id: product.id },
      data: { sku: newSKU },
    });

    console.log(`✅ ${product.name}: ${product.sku} → ${newSKU}`);
    updated++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${products.length}`);
}

regenerateSKUs()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
