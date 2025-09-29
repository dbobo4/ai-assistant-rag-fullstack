// In the created ragdb database there are two schemas by default: drizzle and public.
//
// drizzle schema:
// - Contains the __drizzle_migrations table.
// - This table is used internally by Drizzle ORM to track which migrations
//   have already been applied (id, hash, created_at columns).
// - It is only for migration bookkeeping, not for application data.
//
// public schema:
// - Contains the application tables defined in your schema files.
// - Example: resources (id, content, created_at, updated_at)
// - Example: embeddings (id, resource_id, content, embedding[vector])
// - This is where the actual application data is stored and queried.


import { env } from "@/lib/env.mjs";
  
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";


const runMigrate = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  
const connection = postgres(env.DATABASE_URL, { max: 1 });

const db = drizzle(connection);


  console.log("⏳ Running migrations...");

  const start = Date.now();

  await migrate(db, { migrationsFolder: 'lib/db/migrations' });

  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");

  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});