import { createResource } from '@/lib/actions/resources';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool, UIMessage, stepCountIs, } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/ai/embedding';
import { createResourceRaw } from '@/lib/actions/resources';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `You are a domain-specialized Recipes Assistant.
          Rules:
          - Always call "getInformation" FIRST to retrieve relevant chunks from the knowledge base.
          - Answer ONLY using information returned by tools. If nothing is relevant, say "Sorry, I don't know."
          - Prefer step-by-step instructions. If ingredients are present in context, list them first, then steps.
          - If multiple relevant chunks exist, synthesize them into one coherent answer. Avoid hallucination.
          - If "source" or metadata is available, mention the recipe name or file in one line at the end.
          Style: concise, practical, no fluff.`,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      addResource: tool({
        description: `add a resource to your knowledge base.
          If the user provides a random piece of knowledge unprompted, use this tool without asking for confirmation.`,
        inputSchema: z.object({
          content: z
            .string()
            .describe('the content or resource to add to the knowledge base'),
        }),
        execute: async ({ content }) => createResourceRaw({ content }),
      }),
            getInformation: tool({
        description: `get information from your knowledge base to answer questions.`,
        inputSchema: z.object({
          question: z.string().describe('the users question'),
        }),
        execute: async ({ question }) => findRelevantContent(question),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}