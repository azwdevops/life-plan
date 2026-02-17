"use client";

import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import { Dialog } from "@/components/Dialog";

// Dialog context for managing dialogs globally
interface DialogContextType {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string, title?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
    resolve: () => void;
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
    defaultValue: string;
    resolve: (value: string | null) => void;
  } | null>(null);

  const [promptValue, setPromptValue] = useState("");

  const alert = useCallback((message: string, title: string = "Alert") => {
    return new Promise<void>((resolve) => {
      setAlertState({
        isOpen: true,
        message,
        title,
        resolve: () => {
          setAlertState(null);
          resolve();
        },
      });
    });
  }, []);

  const confirm = useCallback((message: string, title: string = "Confirm") => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title,
        resolve: (value: boolean) => {
          setConfirmState(null);
          resolve(value);
        },
      });
    });
  }, []);

  const prompt = useCallback(
    (message: string, defaultValue: string = "", title: string = "Input") => {
      return new Promise<string | null>((resolve) => {
        setPromptValue(defaultValue);
        setPromptState({
          isOpen: true,
          message,
          title,
          defaultValue,
          resolve: (value: string | null) => {
            setPromptState(null);
            setPromptValue("");
            resolve(value);
          },
        });
      });
    },
    []
  );

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}

      {/* Alert Dialog */}
      {alertState && (
        <Dialog
          isOpen={alertState.isOpen}
          onClose={alertState.resolve}
          title={alertState.title}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
              {alertState.message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={alertState.resolve}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                OK
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Confirm Dialog */}
      {confirmState && (
        <Dialog
          isOpen={confirmState.isOpen}
          onClose={() => confirmState.resolve(false)}
          title={confirmState.title}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
              {confirmState.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => confirmState.resolve(false)}
                className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmState.resolve(true)}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Prompt Dialog */}
      {promptState && (
        <Dialog
          isOpen={promptState.isOpen}
          onClose={() => promptState.resolve(null)}
          title={promptState.title}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
              {promptState.message}
            </p>
            <div>
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    promptState.resolve(promptValue);
                  } else if (e.key === "Escape") {
                    promptState.resolve(null);
                  }
                }}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-400"
                placeholder="Enter value..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => promptState.resolve(null)}
                className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => promptState.resolve(promptValue)}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                OK
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialogs must be used within DialogProvider");
  }
  return context;
}

