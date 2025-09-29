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


import { nanoid } from '@/lib/utils';
import { index, pgTable, text, varchar, vector } from 'drizzle-orm/pg-core';
import { resources } from './resources';

// Define the "embeddings" table in Postgres using Drizzle ORM
// export here is like from schema import my_table in python
export const embeddings = pgTable(
  'embeddings', // Table name in the database
  {
    // Primary key column "id"
    // - varchar with max length 191
    // - automatically generated using nanoid() if not provided
    id: varchar('id', { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // Foreign key to the "resources" table
    // - resourceId links each embedding row to a resource
    // - if the referenced resource is deleted,
    //   all related embeddings will also be deleted (onDelete: 'cascade')
    resourceId: varchar('resource_id', { length: 191 }).references(
      () => resources.id,
      { onDelete: 'cascade' },
    ),

    // The actual text content for this embedding
    // - stores the chunk of text that was vectorized
    // - cannot be NULL
    content: text('content').notNull(),

    // The vector representation (embedding) of the content
    // - stored as a pgvector column
    // - must always contain a value
    // - dimensions: 1536 (the size of OpenAI embedding models like ada-002)
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  },

  // Index definitions for the table
  table => ({
    // Create an approximate nearest neighbor (ANN) index
    // - "hnsw" is a graph-based algorithm for fast vector similarity search
    // - "vector_cosine_ops" tells Postgres to use cosine similarity
    //   when comparing vectors
    // - this allows fast "find similar embeddings" queries
    embeddingIndex: index('embeddingIndex').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  }),
);
