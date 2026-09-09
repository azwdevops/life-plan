import type { AzwBook, AzwBookChapter } from "@/lib/api/azw-books";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Downloads the book as a PDF via the browser's native print-to-PDF (choose
 * "Save as PDF" in the print dialog) — there's no HTML-rendering PDF library
 * in this project (pdf-lib only manipulates existing PDF bytes/pages), so this
 * is the standard no-new-dependency way to get a real, correctly formatted
 * PDF out of rich-text HTML content.
 */
export function downloadBook(book: AzwBook, chapters: AzwBookChapter[]) {
  const chaptersHtml = chapters.map((c) => `<div class="chapter">${c.content || ""}</div>`).join("\n");
  const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(book.title)}</title>
<style>
  @page { margin: 0; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.6; padding: 2rem; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  .chapter { page-break-before: always; }
  .chapter:first-of-type { page-break-before: avoid; }
  img { max-width: 100%; }
</style>
</head>
<body>
<h1>${escapeHtml(book.title)}</h1>
${book.summary ? `<div>${book.summary}</div>` : ""}
${chaptersHtml}
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(doc);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
