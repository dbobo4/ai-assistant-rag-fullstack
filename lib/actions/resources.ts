'use server'; 
// This file contains Server Actions (Node-only). It must not run in the browser.

import {
  NewResourceParams,
  insertResourceSchema,
  resources,
} from '@/lib/db/schema/resources'; // Drizzle table + zod schema

import { db } from '../db'; // Drizzle DB client

import {
  generateEmbeddingsFromChat,     // raw text → chunk + embed
  generateEmbeddingsForChunks,    // pre-chunked text[] → embed (no re-chunk)
} from '../ai/embedding';

import { embeddings as embeddingsTable } from '../db/schema/embeddings'; // Drizzle embeddings table

// ---------------------------------------------------------------------------
// (A) RAW TEXT PATH (from chat/tool): validate → insert resource → chunk+embed
// ---------------------------------------------------------------------------
export const createResourceRaw = async (input: NewResourceParams) => {
  try {
    // 1) Validate input (zod)
    const { content } = insertResourceSchema.parse(input);

    // 2) Insert base resource row (we store original content here)
    const [resource] = await db
      .insert(resources)
      .values({ content })
      .returning();

    // 3) Chunk + embed the raw content
    const embeds = await generateEmbeddingsFromChat(content);

    // 4) Bulk insert embeddings linked to the resource
    await db.insert(embeddingsTable).values(
      embeds.map(e => ({
        resourceId: resource.id,
        ...e, // { content, embedding }
      })),
    );

    return 'Resource successfully created and embedded (chat).';
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error, please try again.';
  }
};

// ---------------------------------------------------------------------------
// (B) PRE-CHUNKED PATH (from Python uploader): insert resource → embed chunks
// No additional chunking here; we embed exactly the provided chunks.
// ---------------------------------------------------------------------------
export const createResourceFromChunks = async (chunks: string[]) => {
  try {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error('chunks must be a non-empty array');
    }

    // Store a small preview (or join first few chunks) as the resource "content".
    // You can later extend the schema with a "title/source" column if needed.
    const preview = chunks.slice(0, 3).join('\n\n').slice(0, 2000);

    // 1) Insert base resource row
    const [resource] = await db
      .insert(resources)
      .values({ content: preview })
      .returning();

    // 2) Embed exactly these pre-chunked strings
    const embeds = await generateEmbeddingsForChunks(chunks);

    // 3) Bulk insert embeddings linked to the same resource
    await db.insert(embeddingsTable).values(
      embeds.map(e => ({
        resourceId: resource.id,
        ...e, // { content, embedding }
      })),
    );

    return `Resource created with ${chunks.length} pre-chunked embeddings.`;
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error, please try again.';
  }
};

// Backward compatibility: keep the old name used by the chat route
export { createResourceRaw as createResource };
