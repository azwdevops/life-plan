"use client";

import { Suspense, useState } from "react";
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
  const [resumeNameHeaderEl, setResumeNameHeaderEl] = useState<HTMLDivElement | null>(
    null
  );

  const centerContent = documentId ? (
    <div className="flex min-w-0 max-w-full items-center justify-center gap-2 sm:gap-3">
      <h1 className="shrink-0 text-base font-bold text-zinc-900 dark:text-zinc-100">
        Edit resume
      </h1>
      <div
        ref={setResumeNameHeaderEl}
        className="flex shrink-0 items-center gap-1.5 sm:gap-2"
      />
    </div>
  ) : (
    <div className="flex justify-center">
      <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Edit resume</h1>
    </div>
  );

  return (
    <DeveloperGrowthChrome centerContent={centerContent}>
      {!documentId ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          Invalid resume.
        </div>
      ) : (
        <ResumeCoverLetterEditor
          documentId={documentId}
          resumeNameHeaderContainer={resumeNameHeaderEl}
        />
      )}
    </DeveloperGrowthChrome>
  );
}

export default function EditResumePage() {
  return (
    <Suspense fallback={fallback}>
      <EditResumeInner />
    </Suspense>
  );
}
