import { createResourceFromChunks } from '@/lib/actions/resources';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chunks = body?.chunks;

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Provide non-empty "chunks" array' }),
        { status: 400 },
      );
    }

    const message = await createResourceFromChunks(chunks);

    return new Response(
      JSON.stringify({ status: 'ok', message, processed: chunks.length }),
      { status: 200 },
    );
  } catch (err: any) {
    console.error('upload-chunks error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal error' }),
      { status: 500 },
    );
  }
}
