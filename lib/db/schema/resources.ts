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


import { sql } from "drizzle-orm";
import { text, varchar, timestamp, pgTable } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@/lib/utils";

export const resources = pgTable("resources", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  content: text("content").notNull(),

  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Schema for resources - used to validate API requests
export const insertResourceSchema = createSelectSchema(resources)
  .extend({})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Type for resources - used to type API request params and within Components
export type NewResourceParams = z.infer<typeof insertResourceSchema>;
