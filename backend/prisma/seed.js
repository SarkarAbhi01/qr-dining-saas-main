require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // --- Bootstrap Superadmin ---
  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@platform.com';
  const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email: superadminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(superadminPassword, 12);
    await prisma.user.create({
      data: {
        name: 'Platform Superadmin',
        email: superadminEmail,
        passwordHash,
        role: 'SUPERADMIN',
      },
    });
    console.log(`✅ Superadmin created: ${superadminEmail}`);
  } else {
    console.log('ℹ️  Superadmin already exists, skipping');
  }

  // --- Default subscription plans ---
  const plans = [
    {
      name: 'Starter',
      description: 'For single-location cafes just getting started',
      priceMonthly: 999,
      priceYearly: 9999,
      maxTables: 10,
      maxStaff: 5,
      features: { analytics: false, kds: true, splitBill: false },
    },
    {
      name: 'Pro',
      description: 'For growing restaurants with full-service needs',
      priceMonthly: 2499,
      priceYearly: 24999,
      maxTables: 40,
      maxStaff: 25,
      features: { analytics: true, kds: true, splitBill: true },
    },
    {
      name: 'Enterprise',
      description: 'For multi-branch chains and hotels',
      priceMonthly: 5999,
      priceYearly: 59999,
      maxTables: 999,
      maxStaff: 999,
      features: { analytics: true, kds: true, splitBill: true, multiOutlet: true },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log(`✅ Seeded ${plans.length} subscription plans`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
