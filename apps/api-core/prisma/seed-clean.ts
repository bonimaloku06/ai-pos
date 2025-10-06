import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("🌱 Seeding database with clean data (no sales history)...");

  // Note: Database is already reset by db:fresh command, no need to delete data manually

  // Store
  const store = await prisma.store.create({
    data: {
      id: "default-store",
      name: "Main Pharmacy",
      address: "123 Main Street",
      phone: "+1234567890",
      isActive: true,
    },
  });

  // Users
  const admin = await prisma.user.create({
    data: {
      email: "admin@pharmacy.com",
      passwordHash: await hashPassword("admin123"),
      role: "ADMIN",
      storeId: store.id,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      email: "manager@pharmacy.com",
      passwordHash: await hashPassword("manager123"),
      role: "MANAGER",
      storeId: store.id,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      email: "cashier@pharmacy.com",
      passwordHash: await hashPassword("cashier123"),
      role: "CASHIER",
      storeId: store.id,
      isActive: true,
    },
  });

  console.log("✓ Created users");

  // Tax Class
  const taxClass = await prisma.taxClass.create({
    data: {
      id: "standard-tax",
      name: "Standard VAT",
      rate: 0.2,
    },
  });

  // Categories
  const painRelief = await prisma.category.create({ data: { name: "Pain Relief" } });
  const coldFlu = await prisma.category.create({ data: { name: "Cold & Flu" } });
  const vitamins = await prisma.category.create({ data: { name: "Vitamins & Supplements" } });
  const antibiotics = await prisma.category.create({ data: { name: "Antibiotics" } });
  const firstAid = await prisma.category.create({ data: { name: "First Aid" } });
  const skinCare = await prisma.category.create({ data: { name: "Skin Care" } });
  const digestive = await prisma.category.create({ data: { name: "Digestive Health" } });

  console.log("✓ Created 7 categories");

  // Suppliers with delivery schedules
  const pharmaDistributors = await prisma.supplier.create({
    data: {
      name: "Pharma Distributors Ltd",
      contactPerson: "John Smith",
      email: "john@pharmadist.com",
      phone: "+1234567890",
      leadTimeDays: 2,
      deliveryDays: ["MON", "TUE", "WED", "THU", "FRI"],
      deliverySchedule: {
        type: "daily",
        cutoffTime: "14:00",
        note: "Order before 2 PM for next-day delivery",
      },
      moq: 10,
      currency: "USD",
      paymentTerms: "NET 30",
      isActive: true,
    },
  });

  const medSupply = await prisma.supplier.create({
    data: {
      name: "MedSupply Inc",
      contactPerson: "Sarah Johnson",
      email: "sarah@medsupply.com",
      phone: "+1234567891",
      leadTimeDays: 3,
      deliveryDays: ["WED", "FRI"],
      deliverySchedule: {
        type: "specific_days",
        days: ["wednesday", "friday"],
        cutoffTime: "10:00",
      },
      moq: 20,
      currency: "USD",
      paymentTerms: "NET 45",
      isActive: true,
    },
  });

  const healthcareWholesale = await prisma.supplier.create({
    data: {
      name: "Healthcare Wholesale Co",
      contactPerson: "Mike Brown",
      email: "mike@healthcare.com",
      phone: "+1234567892",
      leadTimeDays: 7,
      deliveryDays: ["MON"],
      deliverySchedule: {
        type: "weekly",
        day: "monday",
        cutoffTime: "16:00",
      },
      moq: 50,
      currency: "USD",
      paymentTerms: "NET 60",
      isActive: true,
    },
  });

  console.log("✓ Created 3 suppliers with delivery schedules");

  // Products - comprehensive list
  const productsData = [
    // Pain Relief
    {
      name: "Paracetamol 500mg",
      sku: "PARA500",
      barcode: "1001",
      category: painRelief.id,
      unit: "tablet",
      packSize: 20,
      cost: 0.5,
    },
    {
      name: "Paracetamol 1000mg",
      sku: "PARA1000",
      barcode: "1002",
      category: painRelief.id,
      unit: "tablet",
      packSize: 20,
      cost: 0.75,
    },
    {
      name: "Ibuprofen 200mg",
      sku: "IBU200",
      barcode: "1003",
      category: painRelief.id,
      unit: "tablet",
      packSize: 24,
      cost: 0.6,
    },
    {
      name: "Ibuprofen 400mg",
      sku: "IBU400",
      barcode: "1004",
      category: painRelief.id,
      unit: "tablet",
      packSize: 24,
      cost: 0.85,
    },
    {
      name: "Aspirin 75mg",
      sku: "ASP75",
      barcode: "1005",
      category: painRelief.id,
      unit: "tablet",
      packSize: 28,
      cost: 0.4,
    },

    // Cold & Flu
    {
      name: "Cough Syrup 100ml",
      sku: "COUGH100",
      barcode: "2001",
      category: coldFlu.id,
      unit: "bottle",
      packSize: 1,
      cost: 8.0,
    },
    {
      name: "Cold Relief Tablets",
      sku: "COLD-TAB",
      barcode: "2002",
      category: coldFlu.id,
      unit: "tablet",
      packSize: 16,
      cost: 1.2,
    },
    {
      name: "Throat Lozenges",
      sku: "THROAT-LOZ",
      barcode: "2003",
      category: coldFlu.id,
      unit: "lozenge",
      packSize: 24,
      cost: 0.3,
    },
    {
      name: "Nasal Spray",
      sku: "NASAL-SPR",
      barcode: "2004",
      category: coldFlu.id,
      unit: "bottle",
      packSize: 1,
      cost: 6.5,
    },
    {
      name: "Flu Relief Powder",
      sku: "FLU-POW",
      barcode: "2005",
      category: coldFlu.id,
      unit: "sachet",
      packSize: 10,
      cost: 1.5,
    },

    // Vitamins & Supplements
    {
      name: "Vitamin C 1000mg",
      sku: "VITC1000",
      barcode: "3001",
      category: vitamins.id,
      unit: "tablet",
      packSize: 30,
      cost: 0.7,
    },
    {
      name: "Vitamin D 1000IU",
      sku: "VITD1000",
      barcode: "3002",
      category: vitamins.id,
      unit: "tablet",
      packSize: 30,
      cost: 0.8,
    },
    {
      name: "Multivitamin",
      sku: "MULTI-VIT",
      barcode: "3003",
      category: vitamins.id,
      unit: "tablet",
      packSize: 60,
      cost: 0.9,
    },
    {
      name: "Omega-3 Fish Oil",
      sku: "OMEGA3",
      barcode: "3004",
      category: vitamins.id,
      unit: "capsule",
      packSize: 60,
      cost: 1.2,
    },
    {
      name: "Calcium 600mg",
      sku: "CALC600",
      barcode: "3005",
      category: vitamins.id,
      unit: "tablet",
      packSize: 60,
      cost: 0.65,
    },

    // Antibiotics
    {
      name: "Amoxicillin 500mg",
      sku: "AMOX500",
      barcode: "4001",
      category: antibiotics.id,
      unit: "capsule",
      packSize: 21,
      cost: 2.5,
    },
    {
      name: "Azithromycin 250mg",
      sku: "AZI250",
      barcode: "4002",
      category: antibiotics.id,
      unit: "tablet",
      packSize: 6,
      cost: 3.0,
    },
    {
      name: "Ciprofloxacin 500mg",
      sku: "CIPRO500",
      barcode: "4003",
      category: antibiotics.id,
      unit: "tablet",
      packSize: 10,
      cost: 2.8,
    },

    // First Aid
    {
      name: "Bandages 10-Pack",
      sku: "BAND-10",
      barcode: "5001",
      category: firstAid.id,
      unit: "pack",
      packSize: 1,
      cost: 3.5,
    },
    {
      name: "Antiseptic Cream 30g",
      sku: "ANTI-30",
      barcode: "5002",
      category: firstAid.id,
      unit: "tube",
      packSize: 1,
      cost: 4.0,
    },
    {
      name: "Gauze Pads 20-Pack",
      sku: "GAUZE-20",
      barcode: "5003",
      category: firstAid.id,
      unit: "pack",
      packSize: 1,
      cost: 5.0,
    },
    {
      name: "Medical Tape",
      sku: "MED-TAPE",
      barcode: "5004",
      category: firstAid.id,
      unit: "roll",
      packSize: 1,
      cost: 2.5,
    },

    // Skin Care
    {
      name: "Moisturizer 100ml",
      sku: "MOIST-100",
      barcode: "6001",
      category: skinCare.id,
      unit: "bottle",
      packSize: 1,
      cost: 8.5,
    },
    {
      name: "Sunscreen SPF50",
      sku: "SUN-SPF50",
      barcode: "6002",
      category: skinCare.id,
      unit: "bottle",
      packSize: 1,
      cost: 12.0,
    },
    {
      name: "Anti-Acne Gel",
      sku: "ACNE-GEL",
      barcode: "6003",
      category: skinCare.id,
      unit: "tube",
      packSize: 1,
      cost: 9.0,
    },

    // Digestive Health
    {
      name: "Antacid Tablets",
      sku: "ANTACID",
      barcode: "7001",
      category: digestive.id,
      unit: "tablet",
      packSize: 24,
      cost: 0.45,
    },
    {
      name: "Probiotic Capsules",
      sku: "PROBIO",
      barcode: "7002",
      category: digestive.id,
      unit: "capsule",
      packSize: 30,
      cost: 1.8,
    },
    {
      name: "Laxative Tablets",
      sku: "LAX-TAB",
      barcode: "7003",
      category: digestive.id,
      unit: "tablet",
      packSize: 20,
      cost: 0.9,
    },
  ];

  const products = [];
  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        description: `Pharmaceutical product: ${p.name}`,
        unit: p.unit,
        packSize: p.packSize,
        categoryId: p.category,
        taxClassId: taxClass.id,
        status: "ACTIVE",
      },
    });
    products.push({ ...product, cost: p.cost });
  }

  console.log(`✓ Created ${products.length} products`);

  // Create batches with varying stock levels (NO SALES HISTORY)
  const suppliers = [pharmaDistributors, medSupply, healthcareWholesale];
  const batches = [];

  for (const product of products) {
    const supplier = suppliers[randomInt(0, suppliers.length - 1)];
    // Generate realistic stock levels for testing
    const qtyOnHand = randomInt(15, 150);

    const batch = await prisma.batch.create({
      data: {
        productId: product.id,
        supplierId: supplier.id,
        storeId: store.id,
        batchNumber: `BATCH-${product.sku}-${Date.now().toString().slice(-6)}`,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * randomInt(1, 3)), // 1-3 years
        unitCost: product.cost,
        qtyOnHand: qtyOnHand,
        receivedAt: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000), // 1-30 days ago
      },
    });
    batches.push(batch);

    // Create product-supplier relationship
    await prisma.productSupplier.create({
      data: {
        productId: product.id,
        supplierId: supplier.id,
        unitCost: product.cost,
        moq: supplier.moq || 10,
        isPrimary: true,
      },
    });
  }

  console.log(`✓ Created ${batches.length} batches with stock (NO SALES HISTORY)`);

  // Create forecast params
  await prisma.forecastParam.create({
    data: {
      storeId: store.id,
      serviceLevel: 0.95,
      holidayCalendar: [],
      horizonDays: 30,
    },
  });

  console.log("\n🎉 Clean seeding complete!\n");
  console.log("📝 Default users:");
  console.log("   Admin:    admin@pharmacy.com / admin123");
  console.log("   Manager:  manager@pharmacy.com / manager123");
  console.log("   Cashier:  cashier@pharmacy.com / cashier123");
  console.log(`\n📦 Created ${products.length} products`);
  console.log(`🏢 Created ${suppliers.length} suppliers with delivery schedules`);
  console.log(`📊 NO historical sales - clean slate for testing!\n`);
  console.log("💡 You can now test sales manually to see how AI replenishment works!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
