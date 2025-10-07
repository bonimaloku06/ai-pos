import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedVatRates() {
  console.log("🌱 Seeding VAT rates...");

  // Create default VAT rates
  const vatRates = [
    {
      name: "Standard VAT - 8%",
      rate: 8.0,
      isDefault: true,
      isActive: true,
      description: "Standard VAT rate for most goods",
    },
    {
      name: "Reduced VAT - 5%",
      rate: 5.0,
      isDefault: false,
      isActive: true,
      description: "Reduced VAT rate for essential medicines",
    },
    {
      name: "Zero VAT - 0%",
      rate: 0.0,
      isDefault: false,
      isActive: true,
      description: "Zero-rated items (no VAT)",
    },
    {
      name: "Higher VAT - 18%",
      rate: 18.0,
      isDefault: false,
      isActive: false,
      description: "Higher VAT rate for luxury items",
    },
  ];

  for (const vatRate of vatRates) {
    const existing = await prisma.vatRate.findFirst({
      where: { name: vatRate.name },
    });

    if (!existing) {
      await prisma.vatRate.create({
        data: vatRate,
      });
      console.log(`✓ Created VAT rate: ${vatRate.name}`);
    } else {
      console.log(`⊘ Skipped (exists): ${vatRate.name}`);
    }
  }

  console.log("✅ VAT rates seeded successfully!");
}

seedVatRates()
  .catch((error) => {
    console.error("❌ Error seeding VAT rates:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
