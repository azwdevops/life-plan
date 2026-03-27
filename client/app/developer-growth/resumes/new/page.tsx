"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DeveloperGrowthChrome } from "@/components/developer-growth/DeveloperGrowthChrome";
import {
  NEW_RESUME_SESSION_KEY,
  defaultNamedDocument,
  loadResumeBuilderState,
  saveResumeBuilderState,
} from "@/lib/resume-builder-storage";

const fallback = (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
    Loading…
  </div>
);

function NewResumeInner() {
  const router = useRouter();

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const existing = sessionStorage.getItem(NEW_RESUME_SESSION_KEY);
    if (existing) {
      router.replace(existing);
      return;
    }
    const s = loadResumeBuilderState();
    const doc = defaultNamedDocument(`Resume ${s.documents.length + 1}`);
    const path = `/developer-growth/resumes/${doc.id}/edit`;
    sessionStorage.setItem(NEW_RESUME_SESSION_KEY, path);
    const next = {
      ...s,
      documents: [...s.documents, doc],
      activeDocumentId: doc.id,
    };
    saveResumeBuilderState(next);
    router.replace(path);
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
      Creating resume…
    </div>
  );
}

export default function NewResumePage() {
  return (
    <Suspense fallback={fallback}>
      <DeveloperGrowthChrome
        centerContent={
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            New resume
          </h1>
        }
      >
        <NewResumeInner />
      </DeveloperGrowthChrome>
    </Suspense>
  );
}
