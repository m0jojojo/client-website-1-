import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../src/generated/prisma/client";
import { assertSafeToSeed } from "./guard";

config({ path: ".env.local" });
config();

type Snapshot = {
  collections: { handle: string; title: string; position: number }[];
  products: {
    handle: string;
    title: string;
    description: string;
    tags: string[];
    productType: string | null;
    createdAt: string;
    variants: {
      title: string;
      sku: string | null;
      pricePaise: number;
      compareAtPricePaise: number | null;
      inStock: boolean;
      position: number;
    }[];
    collections: { collection: string; position: number }[];
  }[];
};

const PLACEHOLDER = "/images/placeholder.svg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  const data: Snapshot = JSON.parse(readFileSync("prisma/seed/catalog.json", "utf8"));

  const [orders, wishlistItems, cartItems, users] = await Promise.all([
    db.order.count(),
    db.wishlistItem.count(),
    db.cartItem.count(),
    db.user.count(),
  ]);
  assertSafeToSeed({ orders, wishlistItems, cartItems, users }, process.env.FORCE_SEED === "true");

  // Idempotent: wipe catalog tables then reload from the snapshot.
  await db.$transaction([
    db.collectionProduct.deleteMany(),
    db.productImage.deleteMany(),
    db.variant.deleteMany(),
    db.product.deleteMany(),
    db.collection.deleteMany(),
  ]);

  await db.collection.createMany({ data: data.collections });
  const collections = await db.collection.findMany();
  const collectionId = new Map(collections.map((c) => [c.handle, c.id]));

  for (const p of data.products) {
    await db.product.create({
      data: {
        handle: p.handle,
        title: p.title,
        description: p.description,
        tags: p.tags,
        productType: p.productType,
        createdAt: new Date(p.createdAt),
        variants: { create: p.variants },
        images: { create: [{ url: PLACEHOLDER, alt: p.title, position: 0 }] },
        collections: {
          create: p.collections
            .filter((c) => collectionId.has(c.collection))
            .map((c) => ({ collectionId: collectionId.get(c.collection)!, position: c.position })),
        },
      },
    });
  }

  console.log(`Seeded ${data.collections.length} collections, ${data.products.length} products`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
