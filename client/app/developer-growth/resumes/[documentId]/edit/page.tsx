"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { DeveloperGrowthChrome } from "@/components/developer-growth/DeveloperGrowthChrome";
import { ResumeCoverLetterEditor } from "@/components/resume-builder/ResumeCoverLetterEditor";

const fallback = (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
    Loading…
  </div>
);

function EditResumeInner() {
  const params = useParams();
  const documentId = typeof params.documentId === "string" ? params.documentId : "";

  if (!documentId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        Invalid resume.
      </div>
    );
  }

  return <ResumeCoverLetterEditor documentId={documentId} />;
}

export default function EditResumePage() {
  return (
    <Suspense fallback={fallback}>
      <DeveloperGrowthChrome
        centerContent={
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Edit resume
          </h1>
        }
      >
        <EditResumeInner />
      </DeveloperGrowthChrome>
    </Suspense>
  );
}
