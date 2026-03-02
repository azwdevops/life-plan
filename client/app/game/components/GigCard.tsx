"use client";

import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import type { Gig } from "../types";

interface GigCardProps {
  gig: Gig;
  hoursAvailable?: number;
  onTakeGig: (gig: Gig) => void;
}

const CATEGORY_LABELS: Record<Gig["category"], string> = {
  software: "Software",
  accounting: "Accounting / Audit / Tax",
};

const CATEGORY_STYLES: Record<Gig["category"], string> = {
  software: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  accounting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export function GigCard({ gig, hoursAvailable = 300, onTakeGig }: GigCardProps) {
  const [showDescription, setShowDescription] = useState(false);
  const canTake = hoursAvailable >= gig.estimatedHours;

  return (
    <>
      <div className={`flex h-full min-w-0 flex-col rounded-xl border-2 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900 ${gig.category === "software" ? "border-blue-400 dark:border-blue-500" : "border-amber-400 dark:border-amber-500"}`}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {gig.title}
          </h3>
          <span
            className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[gig.category]}`}
          >
            {CATEGORY_LABELS[gig.category]}
          </span>
        </div>
        <p className="mb-3 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
          {gig.shortDescription}
        </p>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            {gig.amount.toLocaleString()}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">KSh</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">· ~{gig.estimatedHours} h</span>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowDescription(true)}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            View description
          </button>
          <button
            type="button"
            onClick={() => onTakeGig(gig)}
            disabled={!canTake}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {canTake ? "Take gig" : "Not enough hours"}
          </button>
        </div>
      </div>

      <Dialog
        isOpen={showDescription}
        onClose={() => setShowDescription(false)}
        title={gig.title}
        size="md"
      >
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {CATEGORY_LABELS[gig.category]} · {gig.amount.toLocaleString()} KSh · ~{gig.estimatedHours} h
          </p>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {gig.fullDescription}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setShowDescription(false);
                if (canTake) onTakeGig(gig);
              }}
              disabled={!canTake}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {canTake ? "Take gig" : "Not enough hours"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
