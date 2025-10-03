from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import glob
import requests

from unstructured.partition.md import partition_md
from unstructured.partition.text import partition_text
from unstructured.partition.html import partition_html
from unstructured.partition.pdf import partition_pdf
from unstructured.partition.docx import partition_docx

from unstructured.chunking.basic import chunk_elements

API_URL = "http://app:3000/api/upload-chunks"  # Next.js service inside docker network
RECIPES_DIR = "/app/recipes"

app = FastAPI()

class FileReq(BaseModel):
    filename: str  # e.g. "myfile.md"

def process_file(path: str) -> list[str]:
    """
    Partition + chunk a document based on file extension, return list of text chunks.
    """
    ext = os.path.splitext(path.lower())[1]

    # 1) Partition by extension
    if ext == ".md":
        elements = partition_md(filename=path)
    elif ext == ".txt":
        elements = partition_text(filename=path)  # plain text
    elif ext in (".html", ".htm"):
        elements = partition_html(filename=path)
    elif ext == ".pdf":
        elements = partition_pdf(filename=path)   # requires pdf deps, see env below
    elif ext == ".docx":
        elements = partition_docx(filename=path)  # requires python-docx
    else:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {ext}")

    # 2) Chunk (char-based with overlap)
    chunks = chunk_elements(elements, max_characters=500, overlap=50)

    # 3) Clean & return plain text list
    texts = [str(ch) for ch in chunks if str(ch).strip()]
    return texts

@app.post("/process-file")
def process_single_file(req: FileReq):
    """
    Process exactly one file from the shared recipes folder and POST chunks to Next.js.
    """
    path = os.path.join(RECIPES_DIR, req.filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"File not found: {req.filename}")

    texts = process_file(path)
    if not texts:
        return {"processed_chunks": []}

    res = requests.post(API_URL, json={"chunks": texts})
    try:
        payload = res.json()
    except Exception:
        payload = {"status_code": res.status_code, "text": res.text}

    return {"processed_chunks": texts, "next_response": payload}

@app.post("/process")
def process_all_files():
    """
    Process all supported files in /app/recipes (batch mode) and POST chunks for each.
    """
    patterns = ["*.md", "*.txt", "*.html", "*.htm", "*.pdf", "*.docx"]
    files = []
    for p in patterns:
        files.extend(glob.glob(os.path.join(RECIPES_DIR, p)))

    summary = []
    for f in files:
        fname = os.path.basename(f)
        try:
            texts = process_file(f)
            processed = len(texts)
            if processed:
                res = requests.post(API_URL, json={"chunks": texts})
                try:
                    payload = res.json()
                except Exception:
                    payload = {"status_code": res.status_code, "text": res.text}
            else:
                payload = {"note": "no chunks"}
            summary.append({"file": fname, "processed": processed, "next_response": payload})
        except HTTPException as he:
            summary.append({"file": fname, "error": he.detail})
        except Exception as e:
            summary.append({"file": fname, "error": str(e)})

    return {"processed": summary}
