"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSharesFeasibilityWorkspace,
  putSharesFeasibilityWorkspace,
} from "@/lib/api/investments";
import { useAuth } from "@/lib/hooks/use-auth";
import { CompaniesPanel } from "./shares-feasibility/CompaniesPanel";
import { AccountsYearsPanel } from "./shares-feasibility/AccountsYearsPanel";
import { FormulaBuilder } from "./shares-feasibility/FormulaBuilder";
import { ResultsPanel } from "./shares-feasibility/ResultsPanel";
import {
  applyAllFormulas,
  applyFormulaToAllCompanies,
} from "@/lib/shares-feasibility/evaluator";
import {
  accountAliasToAccountIdMap,
  isAccountLabelUnique,
  isCompanyNameUnique,
  isFormulaNameUnique,
  isYearUnique,
  normalizeAccountLabel,
  normalizeText,
} from "@/lib/shares-feasibility/normalization";
import { parseFormulaExpression } from "@/lib/shares-feasibility/formula-parser";
import {
  createDefaultSharesFeasibilityState,
  parseSharesFeasibilityStatePayload,
} from "@/lib/shares-feasibility/storage";
import type {
  OverTimeAggregation,
  SharesFeasibilityState,
  SharesFormula,
} from "@/lib/shares-feasibility/types";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function SharesFeasibilityTab() {
  const { token } = useAuth();
  const [state, setState] = useState<SharesFeasibilityState>(createDefaultSharesFeasibilityState);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [workspaceLoadComplete, setWorkspaceLoadComplete] = useState(false);
  const skipNextPersistRef = useRef(true);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [addCompanyDialogOpen, setAddCompanyDialogOpen] = useState(false);
  const [viewCompaniesDialogOpen, setViewCompaniesDialogOpen] = useState(false);
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState(false);
  const [viewAccountsDialogOpen, setViewAccountsDialogOpen] = useState(false);
  const [addYearDialogOpen, setAddYearDialogOpen] = useState(false);
  const [viewYearsDialogOpen, setViewYearsDialogOpen] = useState(false);
  const [inputValuesDialogOpen, setInputValuesDialogOpen] = useState(false);
  const [createFormulaDialogOpen, setCreateFormulaDialogOpen] = useState(false);
  const [viewFormulasDialogOpen, setViewFormulasDialogOpen] = useState(false);

  const accountAliasMap = useMemo(
    () => accountAliasToAccountIdMap(state.accounts),
    [state.accounts]
  );

  useEffect(() => {
    if (!token) {
      setWorkspaceLoadComplete(false);
      return;
    }
    let cancelled = false;
    skipNextPersistRef.current = true;
    setWorkspaceLoadComplete(false);
    void (async () => {
      try {
        const { state: raw } = await getSharesFeasibilityWorkspace(token);
        if (cancelled) return;
        const next = parseSharesFeasibilityStatePayload(raw);
        if (cancelled) return;
        setState(next);
        setSelectedCompanyId(next.companies[0]?.id ?? null);
      } catch {
        if (cancelled) return;
        const empty = createDefaultSharesFeasibilityState();
        setState(empty);
        setSelectedCompanyId(null);
        setBannerMessage("Could not load shares feasibility data.");
      } finally {
        if (!cancelled) {
          setWorkspaceLoadComplete(true);
          skipNextPersistRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !workspaceLoadComplete) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      void putSharesFeasibilityWorkspace(token, state).catch(() => {
        setBannerMessage("Could not save shares feasibility data.");
      });
    }, 900);
    return () => window.clearTimeout(id);
  }, [state, token, workspaceLoadComplete]);

  useEffect(() => {
    if (bannerMessage == null) return;
    const id = window.setTimeout(() => setBannerMessage(null), 4000);
    return () => window.clearTimeout(id);
  }, [bannerMessage]);

  const sortedYears = useMemo(() => [...state.years].sort((a, b) => a - b), [state.years]);

  const addCompany = (name: string): { ok: boolean; message?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, message: "Company name is required." };
    if (!isCompanyNameUnique(state.companies, trimmed)) {
      return { ok: false, message: "Company already exists (case-insensitive)." };
    }
    const nextCompany = {
      id: newId(),
      name: trimmed,
      normalizedName: normalizeText(trimmed),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      companies: [...prev.companies, nextCompany],
    }));
    setSelectedCompanyId(nextCompany.id);
    return { ok: true };
  };

  const renameCompany = (
    companyId: string,
    nextName: string
  ): { ok: boolean; message?: string } => {
    const trimmed = nextName.trim();
    if (!trimmed) return { ok: false, message: "Company name is required." };
    if (!isCompanyNameUnique(state.companies, trimmed, companyId)) {
      return { ok: false, message: "Company already exists (case-insensitive)." };
    }
    setState((prev) => ({
      ...prev,
      companies: prev.companies.map((company) =>
        company.id === companyId
          ? {
              ...company,
              name: trimmed,
              normalizedName: normalizeText(trimmed),
            }
          : company
      ),
    }));
    return { ok: true };
  };

  const deleteCompany = (companyId: string): void => {
    setState((prev) => {
      const values = { ...prev.values };
      delete values[companyId];
      const computedResults = Object.fromEntries(
        Object.entries(prev.computedResults).map(([formulaId, byCompany]) => {
          const nextByCompany = { ...byCompany };
          delete nextByCompany[companyId];
          return [formulaId, nextByCompany];
        })
      );
      return {
        ...prev,
        companies: prev.companies.filter((company) => company.id !== companyId),
        values,
        computedResults,
      };
    });
    setSelectedCompanyId((prev) => (prev === companyId ? null : prev));
  };

  const addAccount = (label: string): { ok: boolean; message?: string } => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return { ok: false, message: "Account label is required." };
    }
    if (!isAccountLabelUnique(state.accounts, trimmedLabel)) {
      return { ok: false, message: "Account label already exists." };
    }
    setState((prev) => ({
      ...prev,
      accounts: [
        ...prev.accounts,
        {
          id: newId(),
          label: trimmedLabel,
          normalizedLabel: normalizeAccountLabel(trimmedLabel),
        },
      ],
      computedResults: {},
    }));
    return { ok: true };
  };

  const removeAccount = (accountId: string): void => {
    setState((prev) => {
      const nextValues: SharesFeasibilityState["values"] = {};
      for (const [companyId, byAccount] of Object.entries(prev.values)) {
        const filtered = { ...byAccount };
        delete filtered[accountId];
        nextValues[companyId] = filtered;
      }
      return {
        ...prev,
        accounts: prev.accounts.filter((account) => account.id !== accountId),
        values: nextValues,
        computedResults: {},
      };
    });
  };

  const addYear = (year: number): { ok: boolean; message?: string } => {
    if (!Number.isInteger(year)) return { ok: false, message: "Year must be an integer." };
    if (!isYearUnique(state.years, year)) {
      return { ok: false, message: "Year already exists." };
    }
    setState((prev) => ({
      ...prev,
      years: [...prev.years, year].sort((a, b) => a - b),
      computedResults: {},
    }));
    return { ok: true };
  };

  const removeYear = (year: number): void => {
    setState((prev) => {
      const nextValues: SharesFeasibilityState["values"] = {};
      for (const [companyId, byAccount] of Object.entries(prev.values)) {
        nextValues[companyId] = Object.fromEntries(
          Object.entries(byAccount).map(([accountId, byYear]) => {
            const nextByYear = { ...byYear };
            delete nextByYear[String(year)];
            return [accountId, nextByYear];
          })
        );
      }
      return {
        ...prev,
        years: prev.years.filter((item) => item !== year),
        values: nextValues,
        computedResults: {},
      };
    });
  };

  const commitCompanyValues = (
    companyId: string,
    nextByAccount: Record<string, Record<string, number | undefined>>
  ): void => {
    setState((prev) => {
      const normalized: Record<string, Record<string, number>> = {};
      for (const [accountId, byYearRaw] of Object.entries(nextByAccount)) {
        const byYear: Record<string, number> = {};
        for (const [yearKey, val] of Object.entries(byYearRaw)) {
          if (val != null && Number.isFinite(val)) {
            byYear[yearKey] = val;
          }
        }
        normalized[accountId] = byYear;
      }
      return {
        ...prev,
        values: {
          ...prev.values,
          [companyId]: {
            ...(prev.values[companyId] ?? {}),
            ...normalized,
          },
        },
        computedResults: {},
      };
    });
  };

  const saveFormula = (
    payload: Omit<
      SharesFormula,
      "createdAt" | "updatedAt" | "expressionTree" | "id"
    > & {
      id?: string;
      createdAt?: string;
    }
  ): { ok: boolean; message?: string } => {
    const trimmedName = payload.name.trim();
    if (!trimmedName) return { ok: false, message: "Formula name is required." };
    if (!isFormulaNameUnique(state.formulas, trimmedName, payload.id)) {
      return { ok: false, message: "Formula name already exists." };
    }
    const parsed = parseFormulaExpression(payload.expression, accountAliasMap);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    setState((prev) => {
      const now = new Date().toISOString();
      const formula: SharesFormula = {
        id: payload.id ?? newId(),
        name: trimmedName,
        mode: payload.mode,
        expression: payload.expression,
        overTimeAggregation: payload.overTimeAggregation as OverTimeAggregation,
        expressionTree: parsed.tree,
        createdAt: payload.createdAt ?? now,
        updatedAt: now,
      };
      const formulas = payload.id
        ? prev.formulas.map((item) => (item.id === payload.id ? formula : item))
        : [...prev.formulas, formula];

      const computedResults = { ...prev.computedResults };
      if (formula.id in computedResults) {
        delete computedResults[formula.id];
      }

      return {
        ...prev,
        formulas,
        computedResults,
      };
    });
    return { ok: true };
  };

  const deleteFormula = (formulaId: string): void => {
    setState((prev) => {
      const computedResults = { ...prev.computedResults };
      delete computedResults[formulaId];
      return {
        ...prev,
        formulas: prev.formulas.filter((formula) => formula.id !== formulaId),
        computedResults,
      };
    });
  };

  const applyFormula = (formulaId: string): void => {
    setState((prev) => applyFormulaToAllCompanies(formulaId, prev));
    setBannerMessage("Formula applied. Existing computations were overwritten.");
  };

  const applyAll = (): void => {
    setState((prev) => applyAllFormulas(prev));
    setBannerMessage("All formulas applied. Existing computations were overwritten.");
  };

  const resetAllWorkspaceData = async (): Promise<void> => {
    if (!window.confirm("Reset all shares feasibility data? This cannot be undone.")) return;
    const fresh = createDefaultSharesFeasibilityState();
    try {
      if (token) {
        await putSharesFeasibilityWorkspace(token, fresh);
      }
    } catch {
      setBannerMessage("Could not reset data on the server.");
      return;
    }
    setState(fresh);
    setSelectedCompanyId(null);
    setBannerMessage("Shares feasibility data has been reset.");
    skipNextPersistRef.current = true;
  };

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-8 md:px-6 md:py-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Sign in to load shares feasibility.</p>
      </div>
    );
  }

  if (!workspaceLoadComplete) {
    return (
      <div className="container mx-auto px-4 py-8 md:px-6 md:py-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading shares feasibility…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:px-6 md:py-10">
      <div className="w-full space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Shares feasibility
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAddCompanyDialogOpen(true)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Add company
                </button>
                <button
                  type="button"
                  onClick={() => setViewCompaniesDialogOpen(true)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  View companies
                </button>
                <button
                  type="button"
                  onClick={() => setAddAccountDialogOpen(true)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Add account
                </button>
                <button
                  type="button"
                  onClick={() => setViewAccountsDialogOpen(true)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  View accounts
                </button>
                <button
                  type="button"
                  onClick={() => setAddYearDialogOpen(true)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Add year
                </button>
                <button
                  type="button"
                  onClick={() => setViewYearsDialogOpen(true)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  View years
                </button>
                <button
                  type="button"
                  onClick={() => setInputValuesDialogOpen(true)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Enter account values
                </button>
                <button
                  type="button"
                  onClick={() => setCreateFormulaDialogOpen(true)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Create formula
                </button>
                <button
                  type="button"
                  onClick={() => setViewFormulasDialogOpen(true)}
                  disabled={state.formulas.length === 0}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  View formulas
                  {state.formulas.length > 0 ? (
                    <span className="ml-1.5 tabular-nums text-zinc-500 dark:text-zinc-400">
                      ({state.formulas.length})
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={applyAll}
                  disabled={state.formulas.length === 0}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Apply all formulas
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void resetAllWorkspaceData()}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Reset all data
            </button>
          </div>
          {bannerMessage ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              {bannerMessage}
            </p>
          ) : null}
        </div>

        <CompaniesPanel
          companies={state.companies}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          onAddCompany={addCompany}
          onRenameCompany={renameCompany}
          onDeleteCompany={deleteCompany}
          addDialogOpen={addCompanyDialogOpen}
          onAddDialogOpenChange={setAddCompanyDialogOpen}
          listDialogOpen={viewCompaniesDialogOpen}
          onListDialogOpenChange={setViewCompaniesDialogOpen}
        />

        <AccountsYearsPanel
          companies={state.companies}
          accounts={state.accounts}
          years={sortedYears}
          values={state.values}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          onAddAccount={addAccount}
          onRemoveAccount={removeAccount}
          onAddYear={addYear}
          onRemoveYear={removeYear}
          addAccountDialogOpen={addAccountDialogOpen}
          onAddAccountDialogOpenChange={setAddAccountDialogOpen}
          viewAccountsDialogOpen={viewAccountsDialogOpen}
          onViewAccountsDialogOpenChange={setViewAccountsDialogOpen}
          viewYearsDialogOpen={viewYearsDialogOpen}
          onViewYearsDialogOpenChange={setViewYearsDialogOpen}
          addYearDialogOpen={addYearDialogOpen}
          onAddYearDialogOpenChange={setAddYearDialogOpen}
          inputValuesDialogOpen={inputValuesDialogOpen}
          onInputValuesDialogOpenChange={setInputValuesDialogOpen}
          onCommitCompanyValues={commitCompanyValues}
        />

        <FormulaBuilder
          accounts={state.accounts}
          formulas={state.formulas}
          createDialogOpen={createFormulaDialogOpen}
          onCreateDialogOpenChange={setCreateFormulaDialogOpen}
          formulasListDialogOpen={viewFormulasDialogOpen}
          onFormulasListDialogOpenChange={setViewFormulasDialogOpen}
          aliasToAccountId={accountAliasMap}
          onAddAccount={addAccount}
          onSaveFormula={saveFormula}
          onDeleteFormula={deleteFormula}
          onApplyFormula={applyFormula}
        />

        <ResultsPanel
          formulas={state.formulas}
          companies={state.companies}
          years={sortedYears}
          computedResults={state.computedResults}
        />
      </div>
    </div>
  );
}
