"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocalDictation } from "@/lib/hooks/use-local-dictation";
import { Dialog } from "@/components/Dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  useCreateLedger,
  useCreateLedgerGroup,
  useLedgerGroups,
  useLedgers,
  useParentLedgerGroups,
} from "@/lib/hooks/use-accounts";
import { useCreateTransaction } from "@/lib/hooks/use-transactions";
import { suggestPosting, type GameApiProvider } from "@/lib/api/game";
import type { LedgerCreate, LedgerGroupCreate } from "@/lib/api/accounts";
import type { TransactionType } from "@/lib/api/transactions";
import { API_OPTIONS, MODELS_BY_PROVIDER } from "@/app/game/self-discovery/constants";

type ProposedRow = {
  ledger_id: number;
  debit: string;
  credit: string;
};

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function AIPostingTab() {
  const { data: ledgers = [], isLoading: ledgersLoading, refetch: refetchLedgers } = useLedgers();
  const { data: groups = [] } = useLedgerGroups();
  const { data: parentGroups = [] } = useParentLedgerGroups();
  const createTransactionMutation = useCreateTransaction();
  const createLedgerMutation = useCreateLedger();
  const createLedgerGroupMutation = useCreateLedgerGroup();

  const [description, setDescription] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const appendFinalTranscript = useCallback((text: string) => {
    setDescription((prev) => {
      if (!text) return prev;
      if (!prev) return text;
      return /\s$/.test(prev) ? prev + text : `${prev} ${text}`;
    });
  }, []);

  const {
    listening: voiceListening,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
    supported: voiceSupported,
    starting: voiceStarting,
  } = useLocalDictation({
    onFinal: appendFinalTranscript,
    onInterim: setInterimTranscript,
  });

  const commitInterimToDescription = useCallback(() => {
    setInterimTranscript((interim) => {
      if (interim) {
        setDescription((prev) => {
          if (!prev) return interim;
          return /\s$/.test(prev) ? prev + interim : `${prev} ${interim}`;
        });
      }
      return "";
    });
  }, []);

  const toggleVoiceInput = () => {
    if (voiceListening) {
      commitInterimToDescription();
      stopVoice();
    } else {
      startVoice();
    }
  };

  const descriptionDisplay =
    interimTranscript === ""
      ? description
      : `${description}${description && !/\s$/.test(description) ? " " : ""}${interimTranscript}`;
  const [api, setApi] = useState<GameApiProvider>("openrouter");
  const [model, setModel] = useState<string>(() => MODELS_BY_PROVIDER.openrouter[0].value);
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("JOURNAL");
  const [rows, setRows] = useState<ProposedRow[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postSuccessDialogOpen, setPostSuccessDialogOpen] = useState(false);

  const resetPostingForm = () => {
    stopVoice();
    setDescription("");
    setInterimTranscript("");
    setApi("openrouter");
    setModel(MODELS_BY_PROVIDER.openrouter[0].value);
    setDate(todayISO());
    setReference("");
    setTransactionType("JOURNAL");
    setRows([]);
    setHasGenerated(false);
    setError(null);
  };

  const [showCreateLedgerDialog, setShowCreateLedgerDialog] = useState(false);
  const [showLedgerGroupForm, setShowLedgerGroupForm] = useState(false);
  const [createLedgerRowIndex, setCreateLedgerRowIndex] = useState<number | null>(null);
  const [ledgerFormData, setLedgerFormData] = useState<LedgerCreate>({
    name: "",
    ledger_group_id: 0,
    spending_type_id: null,
  });
  const [ledgerGroupFormData, setLedgerGroupFormData] = useState<LedgerGroupCreate>({
    name: "",
    parent_ledger_group_id: 0,
    category: "other",
  });

  const debitTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (Number.parseFloat(row.debit) || 0), 0),
    [rows]
  );
  const creditTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (Number.parseFloat(row.credit) || 0), 0),
    [rows]
  );
  const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01 && debitTotal > 0;

  const handleGenerate = async () => {
    setError(null);
    setHasGenerated(false);
    if (!description.trim()) {
      setError("Please describe what happened.");
      return;
    }
    if (!ledgers.length) {
      setError("No ledgers available. Please create ledgers first.");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await suggestPosting(
        description.trim(),
        ledgers.map((l) => ({ id: l.id, name: l.name })),
        api,
        model || undefined
      );
      setTransactionType(result.transaction_type);
      if (result.transaction_date) setDate(result.transaction_date);
      if (result.reference) setReference(result.reference);
      setRows(
        result.entries.map((entry) => ({
          ledger_id: entry.ledger_id,
          debit: entry.entry_type === "DEBIT" ? String(entry.amount) : "",
          credit: entry.entry_type === "CREDIT" ? String(entry.amount) : "",
        }))
      );
      setHasGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate posting suggestion.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { ledger_id: 0, debit: "", credit: "" }]);
  };

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateNewLedger = (rowIndex: number) => (searchTerm: string) => {
    setCreateLedgerRowIndex(rowIndex);
    setLedgerFormData({
      name: searchTerm,
      ledger_group_id: groups[0]?.id || 0,
      spending_type_id: null,
    });
    setShowCreateLedgerDialog(true);
  };

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ledgerFormData.name.trim()) {
      setError("Ledger name is required");
      return;
    }

    if (!ledgerFormData.ledger_group_id) {
      setError("Please select a ledger group");
      return;
    }

    try {
      const newLedger = await createLedgerMutation.mutateAsync(ledgerFormData);
      setLedgerFormData({
        name: "",
        ledger_group_id: groups[0]?.id || 0,
        spending_type_id: null,
      });
      setShowCreateLedgerDialog(false);
      if (createLedgerRowIndex !== null) {
        const rowIdx = createLedgerRowIndex;
        setRows((prev) =>
          prev.map((r, i) => (i === rowIdx ? { ...r, ledger_id: newLedger.id } : r))
        );
        setCreateLedgerRowIndex(null);
      }
      await refetchLedgers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ledger");
    }
  };

  const handleLedgerGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ledgerGroupFormData.name.trim()) {
      setError("Ledger group name is required");
      return;
    }

    if (!ledgerGroupFormData.parent_ledger_group_id) {
      setError("Please select a parent ledger group");
      return;
    }

    try {
      const newLedgerGroup = await createLedgerGroupMutation.mutateAsync(ledgerGroupFormData);
      setLedgerFormData({
        ...ledgerFormData,
        ledger_group_id: newLedgerGroup.id,
      });
      setShowLedgerGroupForm(false);
      setLedgerGroupFormData({
        name: "",
        parent_ledger_group_id: 0,
        category: "other",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ledger group");
    }
  };

  const handlePost = async () => {
    setError(null);
    if (!date) {
      setError("Transaction date is required.");
      return;
    }
    if (!rows.length) {
      setError("Add at least one entry row.");
      return;
    }

    const items: Array<{ ledger_id: number; entry_type: "DEBIT" | "CREDIT"; amount: number }> = [];
    for (const row of rows) {
      if (!row.ledger_id) {
        setError("Each row must have a selected ledger.");
        return;
      }
      const debit = Number.parseFloat(row.debit) || 0;
      const credit = Number.parseFloat(row.credit) || 0;
      if (debit > 0 && credit > 0) {
        setError("A row cannot have both DR and CR amounts.");
        return;
      }
      if (debit <= 0 && credit <= 0) {
        setError("Each row must have either DR or CR amount.");
        return;
      }
      if (debit > 0) {
        items.push({ ledger_id: row.ledger_id, entry_type: "DEBIT", amount: debit });
      } else {
        items.push({ ledger_id: row.ledger_id, entry_type: "CREDIT", amount: credit });
      }
    }

    const totalDebits = items
      .filter((item) => item.entry_type === "DEBIT")
      .reduce((sum, item) => sum + item.amount, 0);
    const totalCredits = items
      .filter((item) => item.entry_type === "CREDIT")
      .reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(totalDebits - totalCredits) >= 0.01) {
      setError("Debits and credits must balance before posting.");
      return;
    }

    try {
      await createTransactionMutation.mutateAsync({
        transaction_date: date,
        reference: reference.trim() ? reference.trim() : null,
        transaction_type: transactionType,
        total_amount: totalDebits,
        items,
      });
      resetPostingForm();
      setPostSuccessDialogOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post transaction.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:px-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">AI Assisted Posting</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Describe what happened (type or dictate with your microphone) and generate editable posting entries.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="ai-posting-description">
                What happened?
              </label>
              <button
                type="button"
                id="ai-posting-voice-toggle"
                onClick={toggleVoiceInput}
                disabled={!voiceSupported || isGenerating}
                title={
                  !voiceSupported
                    ? "Voice input is not supported in this browser (try Chrome or Edge)."
                    : voiceListening
                      ? "Stop dictation"
                      : "Dictate with microphone"
                }
                aria-pressed={voiceListening}
                aria-label={voiceListening ? "Stop voice dictation" : "Start voice dictation"}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  voiceListening
                    ? "border-red-300 bg-red-50 text-red-800 ring-2 ring-red-400/40 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-500/30"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {voiceListening ? (
                    <rect x="8" y="5" width="8" height="14" rx="1" />
                  ) : (
                    <>
                      <path d="M12 14c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v5c0 1.66 1.34 3 3 3z" />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" />
                    </>
                  )}
                </svg>
                {voiceStarting ? "…" : voiceListening ? "Stop" : "Dictate"}
              </button>
            </div>
            <textarea
              id="ai-posting-description"
              value={descriptionDisplay}
              onChange={(e) => {
                setInterimTranscript("");
                setDescription(e.target.value);
              }}
              rows={4}
              placeholder="e.g. Paid KSh 5,000 for internet from Equity Bank account plus KSh 30 transaction fee."
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {voiceListening ? (
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                Listening… speak clearly. Stop when you are done. If you added a Vosk model under{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">public/</code>, the mic stays open until
                Stop; otherwise the browser speech engine is used.
              </p>
            ) : null}
            {voiceError ? (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400" role="status">
                {voiceError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-0 flex-col gap-1.5 sm:w-52">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">API</span>
              <SearchableSelect
                options={API_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                  searchText: `${opt.value} ${opt.label}`,
                }))}
                value={api}
                onChange={(v) => {
                  const next = v as GameApiProvider;
                  setApi(next);
                  const models = MODELS_BY_PROVIDER[next];
                  if (models?.length && !models.some((m) => m.value === model)) {
                    setModel(models[0].value);
                  }
                }}
                placeholder="Select API"
                searchPlaceholder="Type to search API..."
                className="w-full"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:w-72">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</span>
              <SearchableSelect
                options={MODELS_BY_PROVIDER[api].map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                  searchText: `${opt.value} ${opt.label}`,
                }))}
                value={model}
                onChange={(v) => setModel(String(v))}
                placeholder="Select model"
                searchPlaceholder="Type to search or filter model..."
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || ledgersLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isGenerating ? "Generating..." : "Generate suggestions"}
            </button>
          </div>
        </div>

        {hasGenerated && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Transaction Type
                </label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="MONEY_PAID">Money Paid</option>
                  <option value="MONEY_RECEIVED">Money Received</option>
                  <option value="JOURNAL">Journal</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Narration (notes)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Short description"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <th className="px-3 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ledger</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">DR</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">CR</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">Amount</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const dr = Number.parseFloat(row.debit) || 0;
                    const cr = Number.parseFloat(row.credit) || 0;
                    return (
                      <tr key={`${idx}-${row.ledger_id}`} className="border-b border-zinc-200 dark:border-zinc-700">
                        <td className="px-3 py-3 min-w-[260px]">
                          <SearchableSelect
                            options={ledgers.map((ledger) => ({
                              value: ledger.id,
                              label: ledger.name,
                              searchText: `${ledger.name} ${ledger.id}`,
                            }))}
                            value={row.ledger_id || 0}
                            onChange={(value) =>
                              setRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        ledger_id:
                                          typeof value === "number" ? value : Number.parseInt(value as string, 10),
                                      }
                                    : r
                                )
                              )
                            }
                            placeholder="Select ledger"
                            searchPlaceholder="Type to search ledgers..."
                            className="w-full"
                            allowClear
                            onCreateNew={handleCreateNewLedger(idx)}
                            createNewLabel={(searchTerm) => `Create "${searchTerm}" ledger`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.debit}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, debit: e.target.value, credit: "" } : r))
                              )
                            }
                            className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.credit}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, debit: "", credit: e.target.value } : r))
                              )
                            }
                            className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                          {(dr > 0 ? dr : cr).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="rounded border border-red-300 px-2 py-1 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                        No entries yet. Generate suggestions or add rows manually.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <td className="px-3 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Totals</td>
                    <td className="px-3 py-3 text-sm font-semibold text-green-700 dark:text-green-300">
                      {debitTotal.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
                      {creditTotal.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {isBalanced ? "Balanced" : "Out of balance"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        + Add row
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={!rows.length || !isBalanced || createTransactionMutation.isPending}
                onClick={() => void handlePost()}
                className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {createTransactionMutation.isPending ? "Posting..." : "Post transaction"}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <Dialog
        isOpen={postSuccessDialogOpen}
        onClose={() => setPostSuccessDialogOpen(false)}
        title="Transaction posted"
        size="sm"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your transaction was saved successfully.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setPostSuccessDialogOpen(false)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            OK
          </button>
        </div>
      </Dialog>

      <Dialog
        isOpen={showCreateLedgerDialog}
        onClose={() => {
          setShowCreateLedgerDialog(false);
          setError(null);
          setCreateLedgerRowIndex(null);
        }}
        title="Create Ledger"
        size="lg"
      >
        <form onSubmit={handleCreateLedger} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ledger Name *
            </label>
            <input
              type="text"
              value={ledgerFormData.name}
              onChange={(e) =>
                setLedgerFormData({ ...ledgerFormData, name: e.target.value })
              }
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="e.g., Office Supplies, Rent Expense"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ledger Group *
            </label>
            <SearchableSelect
              options={groups.map((group) => ({
                value: group.id,
                label: group.name,
                searchText: group.parent_ledger_group
                  ? `${group.name} ${group.parent_ledger_group.name}`
                  : group.name,
              }))}
              value={ledgerFormData.ledger_group_id || 0}
              onChange={(value) =>
                setLedgerFormData({
                  ...ledgerFormData,
                  ledger_group_id:
                    typeof value === "number" ? value : parseInt(value as string, 10),
                })
              }
              placeholder="Select a ledger group"
              searchPlaceholder="Type to search ledger groups..."
              required
              className="w-full"
              onCreateNew={(searchTerm) => {
                setLedgerGroupFormData({
                  name: searchTerm,
                  parent_ledger_group_id: 0,
                  category: "other",
                });
                setShowLedgerGroupForm(true);
              }}
              createNewLabel={(searchTerm) => `Create "${searchTerm}" ledger group`}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateLedgerDialog(false);
                setError(null);
                setCreateLedgerRowIndex(null);
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLedgerMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createLedgerMutation.isPending ? "Creating..." : "Create Ledger"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        isOpen={showLedgerGroupForm}
        onClose={() => {
          setShowLedgerGroupForm(false);
          setLedgerGroupFormData({
            name: "",
            parent_ledger_group_id: 0,
            category: "other",
          });
        }}
        title="Create Ledger Group"
        size="lg"
      >
        <form onSubmit={handleLedgerGroupSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Name *
              </label>
              <input
                type="text"
                value={ledgerGroupFormData.name}
                onChange={(e) =>
                  setLedgerGroupFormData({
                    ...ledgerGroupFormData,
                    name: e.target.value,
                  })
                }
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="e.g., Bank Accounts, Cash Accounts"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Parent Ledger Group *
              </label>
              <SearchableSelect
                options={parentGroups.map((group) => ({
                  value: group.id,
                  label: group.name,
                  searchText: group.name,
                }))}
                value={ledgerGroupFormData.parent_ledger_group_id || 0}
                onChange={(value) =>
                  setLedgerGroupFormData({
                    ...ledgerGroupFormData,
                    parent_ledger_group_id:
                      typeof value === "number" ? value : parseInt(value as string, 10),
                  })
                }
                placeholder="Select a parent ledger group"
                searchPlaceholder="Type to search parent groups..."
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Category *
              </label>
              <select
                value={ledgerGroupFormData.category}
                onChange={(e) =>
                  setLedgerGroupFormData({
                    ...ledgerGroupFormData,
                    category: e.target.value as LedgerGroupCreate["category"],
                  })
                }
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="incomes">Incomes</option>
                <option value="expenses">Expenses</option>
                <option value="bank_accounts">Bank Accounts</option>
                <option value="cash_accounts">Cash Accounts</option>
                <option value="bank_charges">Bank Charges</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setShowLedgerGroupForm(false);
                setLedgerGroupFormData({
                  name: "",
                  parent_ledger_group_id: 0,
                  category: "other",
                });
              }}
              className="rounded-lg border border-zinc-300 px-6 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLedgerGroupMutation.isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {createLedgerGroupMutation.isPending ? "Creating..." : "Create Ledger Group"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
