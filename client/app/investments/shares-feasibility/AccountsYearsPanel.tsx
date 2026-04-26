"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import type { Account, Company, ValuesMap } from "@/lib/shares-feasibility/types";

type AccountsYearsPanelProps = {
  companies: Company[];
  accounts: Account[];
  years: number[];
  values: ValuesMap;
  selectedCompanyId: string | null;
  onSelectCompany: (companyId: string) => void;
  onAddAccount: (label: string) => { ok: boolean; message?: string };
  onRemoveAccount: (accountId: string) => void;
  onAddYear: (year: number) => { ok: boolean; message?: string };
  onRemoveYear: (year: number) => void;
  addAccountDialogOpen: boolean;
  onAddAccountDialogOpenChange: (isOpen: boolean) => void;
  viewAccountsDialogOpen: boolean;
  onViewAccountsDialogOpenChange: (isOpen: boolean) => void;
  viewYearsDialogOpen: boolean;
  onViewYearsDialogOpenChange: (isOpen: boolean) => void;
  addYearDialogOpen: boolean;
  onAddYearDialogOpenChange: (isOpen: boolean) => void;
  inputValuesDialogOpen: boolean;
  onInputValuesDialogOpenChange: (isOpen: boolean) => void;
  onCommitCompanyValues: (
    companyId: string,
    byAccount: Record<string, Record<string, number | undefined>>
  ) => void;
};

export function AccountsYearsPanel({
  companies,
  accounts,
  years,
  values,
  selectedCompanyId,
  onSelectCompany,
  onAddAccount,
  onRemoveAccount,
  onAddYear,
  onRemoveYear,
  addAccountDialogOpen,
  onAddAccountDialogOpenChange,
  viewAccountsDialogOpen,
  onViewAccountsDialogOpenChange,
  viewYearsDialogOpen,
  onViewYearsDialogOpenChange,
  addYearDialogOpen,
  onAddYearDialogOpenChange,
  inputValuesDialogOpen,
  onInputValuesDialogOpenChange,
  onCommitCompanyValues,
}: AccountsYearsPanelProps) {
  const [draftAccountLabel, setDraftAccountLabel] = useState("");
  const [draftYear, setDraftYear] = useState<number | "">("");
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [addYearError, setAddYearError] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [companyValuesPickerOpen, setCompanyValuesPickerOpen] = useState(false);
  const companyPickerRootRef = useRef<HTMLDivElement>(null);
  const companyFilterInputRef = useRef<HTMLInputElement>(null);
  const [draftValuesByAccount, setDraftValuesByAccount] = useState<
    Record<string, Record<string, number | undefined>>
  >({});
  const [valuesDirty, setValuesDirty] = useState(false);

  useEffect(() => {
    if (!inputValuesDialogOpen) {
      setCompanyFilter("");
      setCompanyValuesPickerOpen(false);
      setDraftValuesByAccount({});
      setValuesDirty(false);
    }
  }, [inputValuesDialogOpen]);

  useLayoutEffect(() => {
    if (!inputValuesDialogOpen || !selectedCompanyId) return;
    const byCompany = values[selectedCompanyId] ?? {};
    const next: Record<string, Record<string, number | undefined>> = {};
    for (const acc of accounts) {
      const row: Record<string, number | undefined> = {};
      for (const year of years) {
        row[String(year)] = byCompany[acc.id]?.[String(year)];
      }
      next[acc.id] = row;
    }
    setDraftValuesByAccount(next);
    setValuesDirty(false);
  }, [inputValuesDialogOpen, selectedCompanyId, accounts, years, values]);

  const requestCloseInputValuesDialog = () => {
    if (valuesDirty) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    onInputValuesDialogOpenChange(false);
  };

  useLayoutEffect(() => {
    if (companyValuesPickerOpen) {
      companyFilterInputRef.current?.focus();
    }
  }, [companyValuesPickerOpen]);

  useEffect(() => {
    if (!companyValuesPickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const root = companyPickerRootRef.current;
      if (!root?.contains(event.target as Node)) {
        setCompanyValuesPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [companyValuesPickerOpen]);

  useEffect(() => {
    if (!companyValuesPickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setCompanyValuesPickerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [companyValuesPickerOpen]);

  const filteredCompaniesForValues = useMemo(() => {
    const q = companyFilter.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((company) => company.name.toLowerCase().includes(q));
  }, [companies, companyFilter]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  return (
    <>
      <Dialog
        isOpen={inputValuesDialogOpen}
        onClose={requestCloseInputValuesDialog}
        title="Account values by year"
        size="lg"
      >
        <div className="space-y-4">
          <div ref={companyPickerRootRef} className="relative">
            <label
              htmlFor="account-values-company-trigger"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Company
            </label>
            <button
              type="button"
              id="account-values-company-trigger"
              aria-expanded={companyValuesPickerOpen}
              aria-haspopup="listbox"
              aria-controls="account-values-company-listbox"
              disabled={companies.length === 0}
              onClick={() => {
                if (companies.length === 0) return;
                setCompanyValuesPickerOpen((open) => {
                  if (!open) setCompanyFilter("");
                  return !open;
                });
              }}
              className="flex w-full min-w-52 items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="min-w-0 truncate">
                {selectedCompany
                  ? selectedCompany.name
                  : companies.length === 0
                    ? "No companies"
                    : "Select company"}
              </span>
              <svg
                className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${
                  companyValuesPickerOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {companyValuesPickerOpen ? (
              <div
                className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-zinc-200 bg-white py-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
                role="presentation"
              >
                <div className="px-2 pb-2">
                  <input
                    ref={companyFilterInputRef}
                    type="search"
                    value={companyFilter}
                    onChange={(event) => setCompanyFilter(event.target.value)}
                    placeholder="Type to filter…"
                    autoComplete="off"
                    className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    aria-label="Filter companies by name"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border-t border-zinc-100 px-0 dark:border-zinc-800">
                  {filteredCompaniesForValues.length === 0 ? (
                    <p className="px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                      No matching companies.
                    </p>
                  ) : (
                    <ul
                      id="account-values-company-listbox"
                      role="listbox"
                      aria-label="Companies"
                      className="divide-y divide-zinc-100 dark:divide-zinc-800"
                    >
                      {filteredCompaniesForValues.map((company) => {
                        const isSelected = company.id === selectedCompanyId;
                        return (
                          <li key={company.id} role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                onSelectCompany(company.id);
                                setCompanyValuesPickerOpen(false);
                              }}
                              className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                                isSelected
                                  ? "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                                  : "text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                              }`}
                            >
                              {company.name}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          {!selectedCompany ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Select a company to enter account values by year.
            </p>
          ) : accounts.length === 0 || years.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Add accounts and years (use the top buttons) before entering values.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left dark:border-zinc-700 dark:bg-zinc-800">
                      Account
                    </th>
                    {years.map((year) => (
                      <th
                        key={year}
                        className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-right dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        {year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td className="border border-zinc-300 px-3 py-2 font-medium dark:border-zinc-700">
                        {account.label}
                      </td>
                      {years.map((year) => {
                        const raw = draftValuesByAccount[account.id]?.[String(year)];
                        return (
                          <td
                            key={`${account.id}-${year}`}
                            className="border border-zinc-300 px-2 py-1 dark:border-zinc-700"
                          >
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={raw ?? ""}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                const cell =
                                  Number.isFinite(next) ? next : undefined;
                                setDraftValuesByAccount((prev) => ({
                                  ...prev,
                                  [account.id]: {
                                    ...(prev[account.id] ?? {}),
                                    [String(year)]: cell,
                                  },
                                }));
                                setValuesDirty(true);
                              }}
                              className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              disabled={
                !selectedCompany ||
                accounts.length === 0 ||
                years.length === 0 ||
                !valuesDirty
              }
              onClick={() => {
                if (!selectedCompany) return;
                onCommitCompanyValues(selectedCompany.id, draftValuesByAccount);
                setValuesDirty(false);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Save
            </button>
            <button
              type="button"
              onClick={requestCloseInputValuesDialog}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={addAccountDialogOpen}
        onClose={() => onAddAccountDialogOpenChange(false)}
        title="Add account"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Account label
            </label>
            <input
              type="text"
              value={draftAccountLabel}
              onChange={(event) => setDraftAccountLabel(event.target.value)}
              placeholder="e.g. Total Assets"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>
          {addAccountError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{addAccountError}</p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onAddAccountDialogOpenChange(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const result = onAddAccount(draftAccountLabel);
                if (!result.ok) {
                  setAddAccountError(result.message ?? "Could not add account.");
                  return;
                }
                setDraftAccountLabel("");
                setAddAccountError(null);
                onAddAccountDialogOpenChange(false);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Add account
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={viewAccountsDialogOpen}
        onClose={() => onViewAccountsDialogOpenChange(false)}
        title="Accounts"
        size="md"
      >
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No accounts yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1.5 dark:border-zinc-700"
              >
                <p className="min-w-0 text-sm text-zinc-800 dark:text-zinc-200">
                  {account.label}
                </p>
                <DropdownMenu
                  overlayOnBody
                  menuButtonAriaLabel={`Actions for ${account.label}`}
                  items={[
                    {
                      label: "Remove",
                      onClick: () => onRemoveAccount(account.id),
                      danger: true,
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        isOpen={viewYearsDialogOpen}
        onClose={() => onViewYearsDialogOpenChange(false)}
        title="Years"
        size="sm"
      >
        {years.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No years yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {years.map((year) => (
              <li
                key={year}
                className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1.5 dark:border-zinc-700"
              >
                <p className="text-sm text-zinc-800 dark:text-zinc-200">{year}</p>
                <DropdownMenu
                  overlayOnBody
                  menuButtonAriaLabel={`Actions for ${year}`}
                  items={[
                    {
                      label: "Remove",
                      onClick: () => onRemoveYear(year),
                      danger: true,
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        isOpen={addYearDialogOpen}
        onClose={() => onAddYearDialogOpenChange(false)}
        title="Add year"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Year
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={draftYear}
              onChange={(event) => {
                const next = Number(event.target.value);
                setDraftYear(Number.isFinite(next) ? next : "");
              }}
              placeholder="e.g. 2012"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>
          {addYearError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{addYearError}</p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onAddYearDialogOpenChange(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const result = onAddYear(Number(draftYear));
                if (!result.ok) {
                  setAddYearError(result.message ?? "Could not add year.");
                  return;
                }
                setDraftYear("");
                setAddYearError(null);
                onAddYearDialogOpenChange(false);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Add year
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
