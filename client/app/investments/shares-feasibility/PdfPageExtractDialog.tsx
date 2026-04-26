"use client";

import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Dialog } from "@/components/Dialog";

type PdfPageExtractDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

/** 1-based page spec → sorted unique 0-based indices, or null if invalid. */
function parsePageIndices(spec: string, pageCount: number): number[] | null {
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const seen = new Set<number>();
  const parts = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (part.includes("-")) {
      const dashParts = part.split("-").map((x) => x.trim());
      if (dashParts.length !== 2) return null;
      const start = Number(dashParts[0]);
      const end = Number(dashParts[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
      if (start < 1 || end < start || end > pageCount) return null;
      for (let p = start; p <= end; p++) seen.add(p - 1);
    } else {
      const p = Number(part);
      if (!Number.isInteger(p) || p < 1 || p > pageCount) return null;
      seen.add(p - 1);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}

function triggerPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PdfPageExtractDialog({ isOpen, onClose }: PdfPageExtractDialogProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageSpec, setPageSpec] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPdfFile(null);
    setPageCount(null);
    setPageSpec("");
    setError(null);
    setBusy(false);
  }, [isOpen]);

  useEffect(() => {
    if (!pdfFile) {
      setPageCount(null);
      return;
    }
    let cancelled = false;
    setPageCount(null);
    setError(null);
    void (async () => {
      try {
        const buf = await pdfFile.arrayBuffer();
        const doc = await PDFDocument.load(buf);
        if (!cancelled) setPageCount(doc.getPageCount());
      } catch {
        if (!cancelled) {
          setPageCount(null);
          setError("Could not read this PDF. Try another file.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfFile]);

  const handleExtract = async () => {
    if (!pdfFile || pageCount == null) return;
    const indices = parsePageIndices(pageSpec, pageCount);
    if (indices === null) {
      setError(
        `Invalid page list. Use numbers from 1 to ${pageCount}, separated by commas, or ranges like 2-5.`
      );
      return;
    }
    if (indices.length === 0) {
      setError("Enter at least one page.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const buf = await pdfFile.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, indices);
      for (const page of copied) {
        out.addPage(page);
      }
      const bytes = await out.save();
      const base = pdfFile.name.replace(/\.pdf$/i, "") || "document";
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      triggerPdfDownload(blob, `${base}-extracted.pdf`);
    } catch {
      setError("Could not extract pages. The PDF may be encrypted or damaged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Extract PDF pages" size="md">
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Choose a PDF, then list which pages to keep (processed in your browser only). Download
          starts after extraction.
        </p>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            PDF file
          </label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setPdfFile(f);
            }}
            className="block w-full text-sm text-zinc-900 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200 dark:text-zinc-100 dark:file:bg-zinc-800 dark:file:text-zinc-200 dark:hover:file:bg-zinc-700"
          />
          {pageCount != null ? (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              {pageCount} page{pageCount === 1 ? "" : "s"} detected
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="pdf-page-spec"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Pages to extract
          </label>
          <input
            id="pdf-page-spec"
            type="text"
            value={pageSpec}
            onChange={(e) => setPageSpec(e.target.value)}
            disabled={busy || pageCount == null}
            placeholder="e.g. 1 or 1,3,5-8"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Comma-separated page numbers (first page is 1). Use a hyphen for a range.
          </p>
        </div>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Close
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !pdfFile ||
              pageCount == null ||
              pageSpec.trim().length === 0
            }
            onClick={() => void handleExtract()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {busy ? "Extracting…" : "Extract & download"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
