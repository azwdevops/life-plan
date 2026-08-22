"use client";

import { usePwaInstall } from "@/lib/hooks/use-pwa-install";

/** Sidebar footer button offering to install the app as a PWA. Renders nothing when install isn't available or the app is already installed. */
export function InstallAppButton() {
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
      <button
        type="button"
        onClick={promptInstall}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <span className="text-lg" aria-hidden>
          ⬇️
        </span>
        Install App
      </button>
    </div>
  );
}
