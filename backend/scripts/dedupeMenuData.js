/**
 * One-off cleanup for restaurants that already have duplicate
 * categories and/or menu items (case/whitespace variants of the same
 * name) from before this fix — run this ONCE, before running
 * `npx prisma migrate dev` (or `migrate deploy`) for the migration that
 * adds the new @@unique([restaurantId, name]) / @@unique([categoryId, name])
 * constraints, otherwise that migration will fail on the existing dupes.
 *
 * What it does, per restaurant:
 *   1. Groups categories by trimmed/lower-cased name. For every group
 *      with more than one row, keeps the OLDEST category (so its id —
 *      and therefore any QR/menu links referencing it — survives),
 *      re-points every menu item from the newer duplicate(s) onto it,
 *      and deletes the now-empty duplicate categories.
 *   2. Within each surviving category, groups menu items the same way.
 *      Keeps the oldest item of each group and deletes the newer
 *      duplicate(s) — duplicate items don't carry order history the
 *      way categories might carry differently-priced items, so unlike
 *      categories we simply drop the dupe rather than merge fields.
 *
 * Usage:
 *   node scripts/dedupeMenuData.js            # apply for every restaurant
 *   node scripts/dedupeMenuData.js --dry-run  # report only, change nothing
 */
const prisma = require('../src/config/prisma');

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(name) {
  return String(name).trim().toLowerCase();
}

function groupByNormalizedName(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

async function dedupeCategoriesForRestaurant(restaurantId) {
  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'asc' },
  });

  let mergedCategories = 0;
  for (const group of groupByNormalizedName(categories)) {
    const [keep, ...duplicates] = group;
    console.log(
      `  [category] "${keep.name}" (${keep.id}) keeps; merging ${duplicates.length} duplicate(s): ${duplicates
        .map((d) => d.name)
        .join(', ')}`
    );
    if (!DRY_RUN) {
      for (const dup of duplicates) {
        await prisma.menuItem.updateMany({
          where: { categoryId: dup.id },
          data: { categoryId: keep.id },
        });
        await prisma.category.delete({ where: { id: dup.id } });
      }
    }
    mergedCategories += duplicates.length;
  }
  return mergedCategories;
}

async function dedupeItemsForRestaurant(restaurantId) {
  const categories = await prisma.category.findMany({ where: { restaurantId }, select: { id: true } });

  let removedItems = 0;
  for (const category of categories) {
    const items = await prisma.menuItem.findMany({
      where: { categoryId: category.id },
      orderBy: { createdAt: 'asc' },
    });

    for (const group of groupByNormalizedName(items)) {
      const [keep, ...duplicates] = group;
      console.log(
        `  [item] "${keep.name}" (${keep.id}) keeps; removing ${duplicates.length} duplicate(s): ${duplicates
          .map((d) => d.name)
          .join(', ')}`
      );
      if (!DRY_RUN) {
        for (const dup of duplicates) {
          // Order history references OrderItem.menuItemId directly (not
          // cascaded), so past orders keep pointing at the now-deleted
          // duplicate's snapshot data (unitPrice etc. are already
          // captured on OrderItem) — safe to remove the menu item row.
          await prisma.menuItem.delete({ where: { id: dup.id } });
        }
      }
      removedItems += duplicates.length;
    }
  }
  return removedItems;
}

async function main() {
  console.log(DRY_RUN ? 'Running in --dry-run mode — no changes will be made.\n' : 'Applying fixes...\n');

  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true } });

  let totalCategoriesMerged = 0;
  let totalItemsRemoved = 0;

  for (const restaurant of restaurants) {
    console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);
    const categoriesMerged = await dedupeCategoriesForRestaurant(restaurant.id);
    const itemsRemoved = await dedupeItemsForRestaurant(restaurant.id);
    if (categoriesMerged === 0 && itemsRemoved === 0) {
      console.log('  No duplicates found.');
    }
    totalCategoriesMerged += categoriesMerged;
    totalItemsRemoved += itemsRemoved;
    console.log('');
  }

  console.log(
    `Done. ${totalCategoriesMerged} duplicate categor${totalCategoriesMerged === 1 ? 'y' : 'ies'} merged, ` +
      `${totalItemsRemoved} duplicate item${totalItemsRemoved === 1 ? '' : 's'} removed.`
  );
  if (DRY_RUN) console.log('(dry run — nothing was actually changed)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
