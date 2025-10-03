import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs'; // ensure Node.js runtime for fs

const UPLOADER_URL = process.env.UPLOADER_URL ?? 'http://uploader:8000';

export async function POST(req: Request) {
  try {
    // 1) Parse multipart form-data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
    }

    // 2) Ensure recipes dir exists in the container
    const recipesDir = path.join(process.cwd(), 'recipes');
    await fs.mkdir(recipesDir, { recursive: true });

    // 3) Save file into shared recipes/
    const filename = file.name;
    const filePath = path.join(recipesDir, filename);

    // FIX: write Uint8Array instead of Buffer to satisfy types
    const arrayBuf = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuf);
    await fs.writeFile(filePath, uint8);

    // 4) Trigger Python FastAPI to process just this file
    const r = await fetch(`${UPLOADER_URL}/process-file`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename }),
    });

    const processJson = await r.json();
    const processed = Array.isArray(processJson?.processed_chunks)
      ? processJson.processed_chunks.length
      : (processJson?.processed ?? 0);

    return new Response(
      JSON.stringify({ status: 'saved+processed', filename, processed }),
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Upload route error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal error' }),
      { status: 500 }
    );
  }
}
