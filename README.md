# AI SDK RAG Chatbot — Extended Starter (File Uploads + Python Chunking + pgvector)

> Based on the Vercel AI SDK RAG Chatbot starter: https://ai-sdk.dev/cookbook/guides/rag-chatbot
> This repository extends the original guide with **file uploads**, a **Python FastAPI uploader** using **unstructured** for chunking, and a **Dockerized full stack** (Postgres/pgvector + pgAdmin + Next.js + Python).

---

## What this project is

This is for building a **Retrieval-Augmented Generation (RAG)** webapp with a clean, reproducible infrastructure.
It is based on the official [Vercel AI SDK RAG Chatbot Guide](https://ai-sdk.dev/cookbook/guides/rag-chatbot), but extended to handle custom document ingestion and a Python-based processing pipeline.

At its core, I deliberately designed the application to work as a **domain-specialized Recipes Assistant**.The assistant follows strict rules defined in its system prompt:

- It always calls the `getInformation` tool first to retrieve relevant chunks from the knowledge base.
- It only answers using the information returned by tools. If nothing is relevant, it replies with: *"Sorry, I don't know."*
- It prefers step-by-step instructions. If ingredients are found in the context, they are listed first, followed by preparation steps.
- When multiple relevant chunks exist, it synthesizes them into a single coherent answer (avoiding hallucination).
- If metadata or source information is available, the assistant mentions the recipe name or file at the end.
- The style is concise, practical, and avoids unnecessary filler text.

In short: **upload your recipe documents, and the assistant will answer cooking-related queries by grounding responses in your own data.**

### Stack

- **Next.js 14 (App Router)**
- **Vercel AI SDK** (React hooks + server tools)
- **OpenAI** embeddings (`text-embedding-3-small`)
- **Drizzle ORM** (+ drizzle-kit migrations)
- **Postgres** with **pgvector**
- **FastAPI (Python)** + **unstructured** for Markdown/text chunking
- **Docker Compose** (db, pgadmin, app, uploader)
- **TailwindCSS** (+ optional shadcn-ui)

---

## What was added beyond the original guide?

1. **File Upload UI** (`/upload`) — users can upload their own recipe documents.Currently supported formats:
   - **Markdown (`.md`)**
   - **Plain text (`.txt`)**
   - **HTML (`.html`, `.htm`)**
   - **PDF (`.pdf`)** *(requires extra pdf dependencies in the environment)*
   - **Word Documents (`.docx`)** *(requires `python-docx`)*
2. **Next.js file-receive endpoint** (`POST /api/upload`) — saves files under a shared `recipes/` directory and triggers Python ingestion.
3. **Python FastAPI service** (`uploader`) — uses **unstructured** to partition documents based on file type, then applies **chunk_elements** to create overlapping chunks.
4. **Chunk ingestion endpoint** in Next.js (`POST /api/upload-chunks`) — receives `{ chunks: string[] }` and stores embeddings in pgvector.
5. **Two embedding flows** to avoid double chunking:
   - `createResourceRaw` + `generateEmbeddingsFromChat` — for raw text coming from chat/tool calls (does its own simple chunking).
   - `createResourceFromChunks` + `generateEmbeddingsForChunks` — for **pre-chunked** text from Python (no re-chunking).
6. **Dockerized multi-service dev** with a **shared volume** for `recipes/` (host ↔ app ↔ uploader).

---

## Repository Layout (key parts)

```
app/
  upload/page.tsx               # File upload UI
  api/upload/route.ts           # Save file to recipes/ + trigger Python /process-file
  api/upload-chunks/route.ts    # Receive chunk list from Python and store embeddings
  api/chat/route.ts             # Chat endpoint using AI SDK tools (RAG)
lib/
  ai/embedding.ts               # generateEmbeddingsFromChat / generateEmbeddingsForChunks / search
  actions/resources.ts          # createResourceRaw / createResourceFromChunks
  db/                           # drizzle schema, migrations, migrate script
uploader/
  dockerfile                    # Python image (FastAPI + uvicorn)
  environment.yml               # conda env: fastapi, uvicorn, unstructured[md], markdown, etc.
  upload_docs.py                # FastAPI app: /process-file, /process
recipes/                        # shared volume for uploaded files
dockerfile                      # Next.js app image
docker-compose.yml              # services: db, pgadmin, app, uploader
```

---

## End‑to‑End Flow

1. User opens **`/upload`** and selects a `.md`/`.txt` file.
2. Browser sends **multipart/form-data** → `POST /api/upload` (Next.js).
3. `/api/upload` writes the file into **`recipes/`** (bind mount shared by app & uploader).
4. `/api/upload` calls Python **`POST uploader:8000/process-file`** with `{ filename }`.
5. **FastAPI** reads `recipes/<filename>`, partitions with `unstructured.partition.md`, chunks with `chunk_elements`.
6. Python posts **`{ chunks }`** to **`POST app:3000/api/upload-chunks`**.
7. Next.js calls `createResourceFromChunks(chunks)` → generates embeddings and stores them in Postgres/pgvector.
8. The **Chat UI** uses `findRelevantContent` (cosine similarity) to answer questions grounded in your uploaded data.

---

## Services (docker-compose)

- **db**: `ankane/pgvector` on `5432`, volume `pgdata`
- **pgadmin**: `dpage/pgadmin4` on `8080`
- **app**: Next.js on `3000`, volume `./recipes:/app/recipes`
- **uploader**: FastAPI on `8000`, volume `./recipes:/app/recipes`

The shared **`recipes/`** bind mount is what lets the Next.js service save files and the Python service read them immediately.

---

## Quickstart

```bash
# 1) Clone
git clone https://github.com/dbobo4/ai-assistant-rag-fullstack.git
cd ai-assistant-rag-fullstack

# 2) Prepare env files
cp app.env.example app.env   # or create app.env from the snippet above
cp db.env.example db.env     # or create db.env from the snippet above

# 3) Start everything
docker-compose up -d --build

# 4) Open
# App:      http://localhost:3000
# Upload:   http://localhost:3000/upload
# Python:   http://localhost:8000/  (should return {"status":"ok"})
# Swagger:  http://localhost:8000/docs
# pgAdmin:  http://localhost:8080
```

---

## Using the App

- You can upload your own recipe documents on `/upload`.Currently supported formats:

  - **Markdown (`.md`)** – e.g., `aloo-matar.md`
  - **Plain text (`.txt`)** – e.g., `pancakes.txt`
  - **HTML (`.html`, `.htm`)** – e.g., `lasagna.html`
  - **PDF (`.pdf`)** – e.g., `cookies.pdf`
  - **Word Documents (`.docx`)** – e.g., `brownies.docx`
- After upload, the page confirms:

```bash
saved "<file>", processed: <n> chunk(s).
```

- Verify the database in **pgAdmin**:Inside `public.embeddings`, you should see one row per chunk, all linked by the same `resource_id`.
- Open the chat UI and ask about your uploaded content.
  The assistant always calls the `getInformation` tool first to retrieve relevant chunks and then answers **grounded in your data**.

---

## API Contracts (summary)

### POST `/api/upload` (Next.js)

- **Body**: multipart/form-data with `file`
- **Action**: save file under `recipes/` and call Python `/process-file`

### POST `/api/upload-chunks` (Next.js)

- **Body**: `{ "chunks": string[] }` (prechunked texts)
- **Action**: store embeddings under one new `resource`

### POST `/process-file` (Python FastAPI)

- **Body**: `{ "filename": string }`
- **Action**: read `recipes/<filename>`, chunk with unstructured, POST chunks to Next.js

### POST `/process` (Python FastAPI)

- **Action**: batch-process all `.md` in `recipes/` (debug/utility)

---

## Notable Implementation Details

- **Two embedding functions**:
  - `generateEmbeddingsFromChat(value)` — splits by simple sentence rule and embeds (chat path).
  - `generateEmbeddingsForChunks(chunks[])` — embeds as-is (Python pre-chunked path).
- **Two server actions**:
  - `createResourceRaw({ content })`
  - `createResourceFromChunks(chunks[])`
- **Similarity search**: cosine similarity via `1 - cosineDistance()` (Drizzle SQL), threshold `> 0.5`, top 4.

---

## Common Pitfalls I Hit & Fixes (very short)

- **Google Fonts timeouts during Next.js build** → Avoid at build time / use local fonts or `display: "swap"`.
- **Missing `styled-jsx`** in Next.js build → add `styled-jsx` as a dependency.
- **Zod/env validation complaining about `DATABASE_URL`** → ensure correct env loading and scope (build vs runtime).
- **Edge runtime + `fs`** errors in API route → set `export const runtime = 'nodejs'` and use `Uint8Array` for `fs.writeFile`.
- **Uploader unreachable from app** → use Docker DNS (`http://uploader:8000`) and expose ports; add fallback to `http://localhost:8000` in dev.
- **FastAPI `/docs` missing** (server crashed) → install missing deps (`unstructured[md]`, `markdown`, `libmagic`, `python-magic`).
- **Double chunking** (Python + Next) → split flows: `fromChat` vs `forChunks` to avoid re-chunking.

---

## Roadmap Ideas

- Add `title`/`source` columns to `resources` and store filename/source metadata.

---

## License & Credits

- Starter and original guide by **Vercel AI SDK** — https://ai-sdk.dev/cookbook/guides/rag-chatbot
- This repo extends that starter; see commit history for authorship.
