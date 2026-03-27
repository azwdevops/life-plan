"use client";

import { Suspense } from "react";
import { DeveloperGrowthChrome } from "@/components/developer-growth/DeveloperGrowthChrome";
import { ResumesListContent } from "@/components/resume-builder/ResumesListContent";

const fallback = (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
    Loading…
  </div>
);

function ResumesPageInner() {
  return (
    <DeveloperGrowthChrome
      centerContent={
        <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Resumes</h1>
      }
    >
      <ResumesListContent />
    </DeveloperGrowthChrome>
  );
}

export default function DeveloperGrowthResumesPage() {
  return (
    <Suspense fallback={fallback}>
      <ResumesPageInner />
    </Suspense>
  );
}
