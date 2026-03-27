import type { ResumeData } from "@/lib/resume-builder-storage";

export function resumeListDisplayName(doc: {
  name: string;
  resume: ResumeData;
}): string {
  const n = doc.name.trim();
  return n || "Untitled resume";
}

export function resumeListSecondaryLine(doc: {
  name: string;
  resume: ResumeData;
}): string | null {
  if (doc.name.trim()) return null;
  const full = doc.resume.fullName.trim();
  const head = doc.resume.headline.trim();
  if (full) return full;
  if (head) return head;
  return null;
}
