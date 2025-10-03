'use client';
import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus('No file selected');
      return;
    }

    setStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);

    // Only call our Next.js API. The server route will save the file
    // and trigger the Python service internally (server-to-server).
    const res = await fetch('/api/upload', { method: 'POST', body: formData });

    const data = await res.json();
    if (!res.ok) {
      setStatus(`Failed: ${data?.error || 'unknown error'}`);
      return;
    }
    setStatus(`Done: saved "${data.filename}", processed: ${data.processed} chunk(s).`);
  }

  return (
    <div className="flex flex-col items-center py-20">
      <h1 className="text-xl font-bold mb-4">Upload a Document</h1>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="file"
          accept=".md,.txt"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
          Upload
        </button>
      </form>
      {status && <p className="mt-4">{status}</p>}
    </div>
  );
}
