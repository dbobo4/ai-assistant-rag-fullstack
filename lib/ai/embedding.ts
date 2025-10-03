import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '../db';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { embeddings as embeddingsTable } from '../db/schema/embeddings';

const embeddingModel = openai.embedding('text-embedding-3-small');

/**
 * Very simple sentence-based chunker used for raw text coming from the chat.
 * If you want a char-based strategy with overlap, swap this implementation.
 */
const generateChunks = (input: string): string[] => {
  return input.trim().split('.').filter(i => i !== '');
};

/**
 * For RAW text coming from the chat.
 * - Splits the text into chunks (generateChunks)
 * - Calls embedMany on those chunks
 * - Returns [{ content, embedding }]
 */
export const generateEmbeddingsFromChat = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings: vectors } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return vectors.map((e, i) => ({ content: chunks[i], embedding: e }));
};

/**
 * For PRE-CHUNKED content (e.g., produced by Python + unstructured).
 * - Does NOT re-chunk
 * - Calls embedMany directly on the provided chunks
 * - Returns [{ content, embedding }]
 */
export const generateEmbeddingsForChunks = async (
  chunks: string[],
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const clean = chunks.map(c => c.replaceAll('\\n', ' '));
  const { embeddings: vectors } = await embedMany({
    model: embeddingModel,
    values: clean,
  });
  return vectors.map((e, i) => ({ content: chunks[i], embedding: e }));
};

/**
 * Single embedding for a short string (e.g., user query) used in similarity search.
 */
export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll('\\n', ' ');
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

/**
 * Vector similarity search (cosine) over the embeddings table.
 * Returns top matches above a similarity threshold.
 */
export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);

  // similarity = 1 - cosineDistance
  const similarity = sql<number>`1 - (${cosineDistance(
    embeddingsTable.embedding,
    userQueryEmbedded,
  )})`;

  const similar = await db
    .select({ name: embeddingsTable.content, similarity })
    .from(embeddingsTable)
    .where(gt(similarity, 0.5))
    .orderBy(t => desc(t.similarity))
    .limit(4);

  return similar;
};
