"use client";

import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import type { Company } from "@/lib/shares-feasibility/types";

type CompaniesPanelProps = {
  companies: Company[];
  selectedCompanyId: string | null;
  onSelectCompany: (companyId: string) => void;
  onAddCompany: (name: string) => { ok: boolean; message?: string };
  onRenameCompany: (
    companyId: string,
    nextName: string
  ) => { ok: boolean; message?: string };
  onDeleteCompany: (companyId: string) => void;
  addDialogOpen: boolean;
  onAddDialogOpenChange: (isOpen: boolean) => void;
  listDialogOpen: boolean;
  onListDialogOpenChange: (isOpen: boolean) => void;
};

export function CompaniesPanel({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onAddCompany,
  onRenameCompany,
  onDeleteCompany,
  addDialogOpen,
  onAddDialogOpenChange,
  listDialogOpen,
  onListDialogOpenChange,
}: CompaniesPanelProps) {
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const showStatusCard = error != null || companies.length === 0;

  return (
    <>
      {showStatusCard ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          {companies.length === 0 ? (
            <p
              className={
                error ? "mt-3 text-sm text-zinc-500 dark:text-zinc-400" : "text-sm text-zinc-500 dark:text-zinc-400"
              }
            >
              Add at least one company to start entering values.
            </p>
          ) : null}
        </section>
      ) : null}

      <Dialog
        isOpen={addDialogOpen}
        onClose={() => onAddDialogOpenChange(false)}
        title="Add company"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Company name
            </label>
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="e.g. Acme Plc"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onAddDialogOpenChange(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const result = onAddCompany(draftName);
                if (!result.ok) {
                  setError(result.message ?? "Could not add company.");
                  return;
                }
                setDraftName("");
                setError(null);
                onAddDialogOpenChange(false);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Add company
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={listDialogOpen}
        onClose={() => onListDialogOpenChange(false)}
        title="Companies"
        size="md"
      >
        {companies.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No companies yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompanyId;
              const isEditing = editingId === company.id;
              return (
                <li
                  key={company.id}
                  className={`rounded-lg border p-3 ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {isEditing ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const result = onRenameCompany(company.id, editingName);
                          if (!result.ok) {
                            setError(result.message ?? "Could not rename company.");
                            return;
                          }
                          setEditingId(null);
                          setEditingName("");
                          setError(null);
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectCompany(company.id)}
                        className="min-w-0 flex-1 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100"
                      >
                        {company.name}
                      </button>
                      <DropdownMenu
                        overlayOnBody
                        menuButtonAriaLabel={`Actions for ${company.name}`}
                        items={[
                          {
                            label: "Edit",
                            onClick: () => {
                              setEditingId(company.id);
                              setEditingName(company.name);
                            },
                          },
                          {
                            label: "Delete",
                            onClick: () => onDeleteCompany(company.id),
                            danger: true,
                          },
                        ]}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </>
  );
}
