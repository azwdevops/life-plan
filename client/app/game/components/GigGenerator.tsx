"use client";

import { useState, useRef } from "react";
import type { Gig } from "../types";
import {
  GIG_TEMPLATES,
  createGigFromTemplate,
  pickGigPoolIndices,
  RECENTLY_USED_GIG_MAX,
} from "../data/gigPool";

interface GigGeneratorProps {
  onGenerate: (gigs: Gig[]) => void;
}

export function GigGenerator({ onGenerate }: GigGeneratorProps) {
  const [count, setCount] = useState(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const recentlyUsedRef = useRef<number[]>([]);

  const handleGenerate = () => {
    if (count < 1 || count > 20) {
      alert("Please enter a number between 1 and 20");
      return;
    }

    setIsGenerating(true);
    setGeneratedCount(0);

    const poolIndices = pickGigPoolIndices(count, recentlyUsedRef.current);
    recentlyUsedRef.current = [...recentlyUsedRef.current, ...poolIndices].slice(
      -RECENTLY_USED_GIG_MAX
    );

    const gigs: Gig[] = [];
    const baseId = Date.now();

    const generateWithDelay = (index: number) => {
      setTimeout(() => {
        const template = GIG_TEMPLATES[poolIndices[index]];
        const gig = createGigFromTemplate(template, baseId + index);
        gigs.push(gig);
        setGeneratedCount(index + 1);

        if (index === count - 1) {
          setTimeout(() => {
            setIsGenerating(false);
            onGenerate(gigs);
            setGeneratedCount(0);
          }, 300);
        }
      }, index * 150);
    };

    for (let i = 0; i < count; i++) {
      generateWithDelay(i);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Generate Gigs
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create a new set of random gigs from a pool of 100+ options
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Number of Gigs
          </label>
          <input
            type="number"
            value={count}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= 20) {
                setCount(val);
              }
            }}
            min="1"
            max="20"
            disabled={isGenerating}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2 font-semibold text-white transition-all hover:from-amber-700 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50 dark:from-amber-500 dark:to-orange-500 dark:hover:from-amber-600 dark:hover:to-orange-600"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating... ({generatedCount}/{count})
            </span>
          ) : (
            "🎲 Generate Gigs"
          )}
        </button>
      </div>

      {isGenerating && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Generating gigs...
            </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {generatedCount} / {count}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-orange-600 transition-all duration-300 dark:from-amber-500 dark:to-orange-500"
              style={{ width: `${(generatedCount / count) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
