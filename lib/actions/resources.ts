'use server'; 
// Next.js directive → marks this file for server-only execution (Server Actions).
// Cannot run in the browser, only on the server side.

import {
  NewResourceParams,
  insertResourceSchema,
  resources,
} from '@/lib/db/schema/resources';
// - `NewResourceParams`: TypeScript type for new resource inputs.
// - `insertResourceSchema`: Zod schema to validate resource input.
// - `resources`: Drizzle ORM table definition for the "resources" table.

import { db } from '../db';
// Database client instance (Drizzle ORM + Postgres).

import { generateEmbeddings } from '../ai/embedding';
// Function that takes text content, splits it into chunks, 
// and generates embeddings using the AI SDK (OpenAI model).

import { embeddings as embeddingsTable } from '../db/schema/embeddings';
// Drizzle ORM table definition for the "embeddings" table.

// ----------------------------------------------------------
// PROCESS FLOW (data pipeline):
// ----------------------------------------------------------
// 1. Input comes into the function: `input` (NewResourceParams object).
//    Example: { content: "This is some text." }
//
// 2. Input validation with Zod (`insertResourceSchema.parse`).
//    Ensures the `content` field exists and is valid.
//
// 3. Insert the validated content into the `resources` table.
//    Database generates an `id` for the new resource.
//
// 4. Generate embeddings from the content text using OpenAI (AI SDK).
//    Each sentence/chunk becomes a vector representation.
//
// 5. Insert all generated embeddings into the `embeddings` table.
//    Each embedding is linked back to the resource with `resourceId`.
//
// 6. Return a success message.
// ----------------------------------------------------------

export const createResource = async (input: NewResourceParams) => {
  try {
    // 1. Validate input against schema
    const { content } = insertResourceSchema.parse(input);

    // 2. Insert new resource into "resources" table
    //    - `values({ content })`: insert only the content column
    //    - `.returning()`: return the inserted row, including generated `id`
    const [resource] = await db
      .insert(resources)
      .values({ content })
      .returning();

    // 3. Generate embeddings for the resource's content
    //    - Splits the text into chunks (sentences)
    //    - Creates a vector embedding for each chunk
    const embeddings = await generateEmbeddings(content);

    // 4. Insert embeddings into the "embeddings" table
    //    - Each embedding is linked to the resource by `resourceId`
    //    - Spread operator `...embedding` includes { content, embedding }
    await db.insert(embeddingsTable).values(
      embeddings.map(embedding => ({
        resourceId: resource.id,  // foreign key link to resources table
        ...embedding,             // { content, embedding }
      })),
    );

    // 5. Return success message
    return 'Resource successfully created and embedded.';
  } catch (error) {
    // 6. Error handling: return a meaningful error message if possible
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error, please try again.';
  }
};
