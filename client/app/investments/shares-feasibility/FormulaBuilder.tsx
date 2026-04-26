"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import { parseFormulaExpression } from "@/lib/shares-feasibility/formula-parser";
import {
  buildAccountAliasEntries,
  normalizeText,
} from "@/lib/shares-feasibility/normalization";
import type {
  Account,
  ExpressionNode,
  FormulaMode,
  OverTimeAggregation,
  SharesFormula,
} from "@/lib/shares-feasibility/types";

type FormulaBuilderProps = {
  accounts: Account[];
  formulas: SharesFormula[];
  createDialogOpen: boolean;
  onCreateDialogOpenChange: (isOpen: boolean) => void;
  formulasListDialogOpen: boolean;
  onFormulasListDialogOpenChange: (isOpen: boolean) => void;
  aliasToAccountId: Record<string, string>;
  onAddAccount: (label: string) => { ok: boolean; message?: string };
  onSaveFormula: (
    payload: Omit<SharesFormula, "createdAt" | "updatedAt" | "expressionTree"> & {
      id?: string;
      createdAt?: string;
    }
  ) => { ok: boolean; message?: string };
  onDeleteFormula: (formulaId: string) => void;
  onApplyFormula: (formulaId: string) => void;
};

function evaluatePreviewTree(
  node: ExpressionNode,
  variableValues: Record<string, number>
): number | null {
  if (node.type === "constant") return node.value;
  if (node.type === "account") {
    const value = variableValues[node.accountId];
    return Number.isFinite(value) ? value : null;
  }
  const left = evaluatePreviewTree(node.left, variableValues);
  const right = evaluatePreviewTree(node.right, variableValues);
  if (left == null || right == null) return null;
  if (node.operator === "+") return left + right;
  if (node.operator === "-") return left - right;
  if (node.operator === "*") return left * right;
  if (right === 0) return null;
  return left / right;
}

function getExpressionVariables(expression: string): string[] {
  return Array.from(
    new Set(
      [...expression.matchAll(/@([a-zA-Z0-9_]+)/g)].map((match) =>
        match[1].toLowerCase()
      )
    )
  );
}

/** If cursor is right after `@` or inside `@identifier`, returns @ index and lowercase query fragment. */
function getAtTokenContext(
  value: string,
  cursor: number
): { atIndex: number; query: string } | null {
  let pos = cursor - 1;
  while (pos >= 0 && /[a-zA-Z0-9_]/.test(value[pos])) {
    pos -= 1;
  }
  if (pos < 0 || value[pos] !== "@") return null;
  return {
    atIndex: pos,
    query: value.slice(pos + 1, cursor).toLowerCase(),
  };
}

function filterAccountSuggestions(
  entries: { accountId: string; label: string; alias: string }[],
  query: string
) {
  return entries.filter((entry) => {
    if (!query) return true;
    if (entry.alias.includes(query)) return true;
    return normalizeText(entry.label).includes(query);
  });
}

function stablePreviewValue(seedText: string): number {
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) % 100000;
  }
  return (Math.abs(hash) % 900) + 100;
}

export function FormulaBuilder({
  accounts,
  formulas,
  createDialogOpen,
  onCreateDialogOpenChange,
  formulasListDialogOpen,
  onFormulasListDialogOpenChange,
  aliasToAccountId,
  onAddAccount,
  onSaveFormula,
  onDeleteFormula,
  onApplyFormula,
}: FormulaBuilderProps) {
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftMode, setDraftMode] = useState<FormulaMode>("yearly");
  const [draftExpression, setDraftExpression] = useState("");
  const [draftOverTimeAggregation, setDraftOverTimeAggregation] =
    useState<OverTimeAggregation>("sum");
  const [error, setError] = useState<string | null>(null);
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [expressionCursor, setExpressionCursor] = useState(0);
  const [expressionFocused, setExpressionFocused] = useState(false);
  const [suppressSuggest, setSuppressSuggest] = useState(false);
  const [suggestHighlight, setSuggestHighlight] = useState(0);
  const [newAccountLabel, setNewAccountLabel] = useState("");
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const expressionRef = useRef<HTMLTextAreaElement>(null);

  const canBuild = accounts.length > 0;
  const isDialogOpen = createDialogOpen || formulaDialogOpen;

  const accountReferences = useMemo(
    () =>
      [...buildAccountAliasEntries(accounts)].sort((a, b) =>
        a.alias.localeCompare(b.alias)
      ),
    [accounts]
  );

  const atContext = useMemo(
    () => getAtTokenContext(draftExpression, expressionCursor),
    [draftExpression, expressionCursor]
  );

  const expressionSuggestions = useMemo(() => {
    if (!atContext) return [];
    return filterAccountSuggestions(accountReferences, atContext.query);
  }, [accountReferences, atContext]);

  const showSuggestionList = Boolean(
    isDialogOpen &&
      expressionFocused &&
      !suppressSuggest &&
      atContext &&
      expressionSuggestions.length > 0
  );

  useEffect(() => {
    if (!showSuggestionList) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const root = expressionRef.current?.closest(".formula-expression-field");
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      setSuppressSuggest(true);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [showSuggestionList]);

  const clampedSuggestHighlight = Math.min(
    suggestHighlight,
    Math.max(0, expressionSuggestions.length - 1)
  );

  const applySuggestion = (alias: string) => {
    const el = expressionRef.current;
    const cursor = el?.selectionStart ?? expressionCursor;
    const ctx = getAtTokenContext(draftExpression, cursor);
    if (!ctx) return;
    const next =
      draftExpression.slice(0, ctx.atIndex) +
      `@${alias}` +
      draftExpression.slice(cursor);
    const nextCursor = ctx.atIndex + 1 + alias.length;
    setDraftExpression(next);
    setExpressionCursor(nextCursor);
    setSuppressSuggest(false);
    requestAnimationFrame(() => {
      const ta = expressionRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const preview = useMemo(() => {
    const expression = draftExpression.trim();
    if (!expression) {
      return {
        parsed: false,
        message: "Type a formula expression to preview.",
        variables: [] as Array<{ name: string; value: number }>,
        result: null as number | null,
      };
    }
    const parsed = parseFormulaExpression(expression, aliasToAccountId);
    if (!parsed.ok) {
      return {
        parsed: false,
        message: parsed.message,
        variables: [] as Array<{ name: string; value: number }>,
        result: null as number | null,
      };
    }
    const expressionVars = getExpressionVariables(expression);
    const varValues: Record<string, number> = {};
    const used = expressionVars.map((name) => {
      const value = stablePreviewValue(name);
      varValues[aliasToAccountId[name]] = value;
      return { name: `@${name}`, value };
    });
    return {
      parsed: true,
      message: null,
      variables: used,
      result: evaluatePreviewTree(parsed.tree, varValues),
    };
  }, [aliasToAccountId, draftExpression]);

  const resetToCreateMode = () => {
    setEditingFormulaId(null);
    setDraftName("");
    setDraftMode("yearly");
    setDraftExpression("");
    setDraftOverTimeAggregation("sum");
    setError(null);
    setExpressionCursor(0);
    setExpressionFocused(false);
    setSuppressSuggest(false);
  };

  const closeDialog = () => {
    setFormulaDialogOpen(false);
    onCreateDialogOpenChange(false);
    setAddAccountError(null);
    setNewAccountLabel("");
    resetToCreateMode();
  };

  return (
    <>
      {!canBuild ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add at least one account before creating formulas.
        </p>
      ) : null}

      <Dialog
        isOpen={formulasListDialogOpen}
        onClose={() => onFormulasListDialogOpenChange(false)}
        title="Formulas"
        size="lg"
      >
        <div className="space-y-4">
          {formulas.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No formulas yet.</p>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] space-y-2 overflow-y-auto pr-1">
              {formulas.map((formula) => (
                <li
                  key={formula.id}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {formula.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {formula.expression}
                      </p>
                    </div>
                    <DropdownMenu
                      overlayOnBody
                      menuButtonAriaLabel={`Actions for ${formula.name}`}
                      items={[
                        {
                          label: "Edit",
                          onClick: () => {
                            onFormulasListDialogOpenChange(false);
                            setEditingFormulaId(formula.id);
                            setDraftName(formula.name);
                            setDraftMode(formula.mode);
                            setDraftExpression(formula.expression);
                            setDraftOverTimeAggregation(formula.overTimeAggregation);
                            setError(null);
                            onCreateDialogOpenChange(false);
                            setFormulaDialogOpen(true);
                          },
                        },
                        {
                          label: "Apply",
                          onClick: () => onApplyFormula(formula.id),
                        },
                        {
                          label: "Delete",
                          danger: true,
                          onClick: () => onDeleteFormula(formula.id),
                        },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onFormulasListDialogOpenChange(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        title={editingFormulaId ? "Edit formula" : "Create formula"}
        size="xl"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Formula name (e.g. Debt ratio)"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <select
                value={draftMode}
                onChange={(event) =>
                  setDraftMode(event.target.value as FormulaMode)
                }
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="yearly">Yearly</option>
                <option value="over_time">Over time</option>
              </select>
            </div>

            {draftMode === "over_time" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Over-time aggregation
                </label>
                <select
                  value={draftOverTimeAggregation}
                  onChange={(event) =>
                    setDraftOverTimeAggregation(
                      event.target.value as OverTimeAggregation
                    )
                  }
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="sum">sum</option>
                  <option value="avg">avg</option>
                  <option value="first">first</option>
                  <option value="last">last</option>
                </select>
              </div>
            ) : null}

            <div className="formula-expression-field relative">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Formula expression
              </label>
              <textarea
                ref={expressionRef}
                value={draftExpression}
                onChange={(event) => {
                  setSuppressSuggest(false);
                  setSuggestHighlight(0);
                  setDraftExpression(event.target.value);
                  setExpressionCursor(event.target.selectionStart);
                }}
                onFocus={() => {
                  setExpressionFocused(true);
                  setSuppressSuggest(false);
                }}
                onBlur={() => {
                  window.setTimeout(() => setExpressionFocused(false), 180);
                }}
                onSelect={(event) => {
                  const target = event.target as HTMLTextAreaElement;
                  setExpressionCursor(target.selectionStart);
                }}
                onClick={(event) => {
                  const target = event.target as HTMLTextAreaElement;
                  setExpressionCursor(target.selectionStart);
                  setSuppressSuggest(false);
                }}
                onKeyUp={(event) => {
                  const target = event.target as HTMLTextAreaElement;
                  setExpressionCursor(target.selectionStart);
                }}
                onKeyDown={(event) => {
                  const target = event.target as HTMLTextAreaElement;
                  const cursor = target.selectionStart;
                  const ctx = getAtTokenContext(draftExpression, cursor);
                  const matches = ctx
                    ? filterAccountSuggestions(accountReferences, ctx.query)
                    : [];
                  const listOpen =
                    isDialogOpen &&
                    expressionFocused &&
                    !suppressSuggest &&
                    matches.length > 0;

                  if (event.key === "Escape" && matches.length > 0) {
                    event.preventDefault();
                    setSuppressSuggest(true);
                    return;
                  }
                  if (!listOpen) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSuggestHighlight((h) => Math.min(h + 1, matches.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSuggestHighlight((h) => Math.max(h - 1, 0));
                  } else if (event.key === "Enter" || event.key === "Tab") {
                    event.preventDefault();
                    const hi = Math.min(
                      suggestHighlight,
                      Math.max(0, matches.length - 1)
                    );
                    const pick = matches[hi];
                    if (pick) applySuggestion(pick.alias);
                  }
                }}
                placeholder="@total_revenue / @total_expenses"
                rows={6}
                className="w-full min-h-32 rounded border border-zinc-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                autoComplete="off"
                spellCheck={false}
              />
              {showSuggestionList ? (
                <ul
                  className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
                  role="listbox"
                >
                  {expressionSuggestions.map((item, index) => (
                    <li
                      key={item.accountId}
                      role="option"
                      aria-selected={index === clampedSuggestHighlight}
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestion(item.alias)}
                        className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                          index === clampedSuggestHighlight
                            ? "bg-blue-50 dark:bg-blue-950/50"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span className="truncate text-zinc-800 dark:text-zinc-200">
                          {item.label}
                        </span>
                        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          @{item.alias}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex flex-wrap items-end gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-700">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    New account
                  </label>
                  <input
                    type="text"
                    value={newAccountLabel}
                    onChange={(event) => {
                      setNewAccountLabel(event.target.value);
                      setAddAccountError(null);
                    }}
                    placeholder="Account name"
                    className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const result = onAddAccount(newAccountLabel);
                    if (!result.ok) {
                      setAddAccountError(result.message ?? "Could not add account.");
                      return;
                    }
                    setNewAccountLabel("");
                    setAddAccountError(null);
                  }}
                  className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Add account
                </button>
              </div>
              {addAccountError ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{addAccountError}</p>
              ) : null}

              {accountReferences.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  No accounts yet. Add one above.
                </p>
              ) : (
                <ul
                  className="mt-3 flex max-h-28 flex-wrap content-start gap-1.5 overflow-y-auto"
                  role="list"
                >
                  {accountReferences.map((item) => (
                    <li
                      key={item.accountId}
                      className="flex min-w-0 max-w-42 shrink-0 flex-col rounded-md border border-zinc-200 px-1.5 py-1 dark:border-zinc-700"
                    >
                      <span className="truncate text-xs font-medium leading-tight text-zinc-800 dark:text-zinc-200">
                        {item.label}
                      </span>
                      <span className="truncate font-mono text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                        @{item.alias}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = onSaveFormula({
                    id: editingFormulaId ?? undefined,
                    name: draftName,
                    mode: draftMode,
                    expression: draftExpression,
                    overTimeAggregation: draftOverTimeAggregation,
                  });
                  if (!result.ok) {
                    setError(result.message ?? "Could not save formula.");
                    return;
                  }
                  closeDialog();
                }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {editingFormulaId ? "Save formula" : "Create formula"}
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Preview
            </h4>
            {preview.message ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {preview.message}
              </p>
            ) : (
              <>
                <div className="mt-2 space-y-1">
                  {preview.variables.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono text-zinc-700 dark:text-zinc-200">
                        {item.name}
                      </span>
                      <span className="text-zinc-900 dark:text-zinc-100">
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Final computed value
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {preview.result == null
                      ? "-"
                      : preview.result.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 4,
                        })}
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      </Dialog>
    </>
  );
}
