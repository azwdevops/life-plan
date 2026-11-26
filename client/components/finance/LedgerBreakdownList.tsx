"use client";

export const LEDGER_BREAKDOWN_COLORS = [
  "#1d4ed8",
  "#15803d",
  "#b45309",
  "#b91c1c",
  "#6d28d9",
  "#be185d",
  "#0e7490",
  "#c2410c",
  "#4d7c0f",
  "#4338ca",
];

export type LedgerBreakdownRow = {
  ledgerId: number;
  name: string;
  value: number;
  percentage: number;
};

export type LedgerItemBreakdownRow = {
  key: string;
  name: string;
  value: number;
};

/** Sums DEBIT transaction items by ledger (and, within each ledger, by
 * item) - shared by every "breakdown by ledger, expandable to items"
 * section in the app so they all stay in sync with one implementation. */
export function buildLedgerBreakdown<
  T extends {
    items?: {
      entry_type: string;
      ledger_id: number;
      item_id: number | null;
      amount: number | string;
    }[];
  }
>(
  transactions: T[],
  ledgerIds: Set<number>,
  ledgers: { id: number; name: string }[],
  ledgerItems: { id: number; name: string }[],
  /** Which side of the entry counts as "this ledger's activity" - DEBIT for
   * expense/asset ledgers, CREDIT for income ledgers (a MONEY_RECEIVED
   * transaction credits the income ledger and debits the receiving
   * account). Defaults to DEBIT. */
  entryType: "DEBIT" | "CREDIT" = "DEBIT"
): { rows: LedgerBreakdownRow[]; itemsByLedgerId: Map<number, LedgerItemBreakdownRow[]> } {
  const ledgerTotals = new Map<number, number>();
  const itemTotals = new Map<number, Map<string, { name: string; value: number }>>();

  transactions.forEach((transaction) => {
    (transaction.items ?? []).forEach((item) => {
      if (item.entry_type !== entryType || !ledgerIds.has(item.ledger_id)) return;
      const amount =
        typeof item.amount === "string" ? parseFloat(item.amount) : Number(item.amount) || 0;
      if (amount <= 0) return;

      ledgerTotals.set(item.ledger_id, (ledgerTotals.get(item.ledger_id) || 0) + amount);

      const itemKey = item.item_id != null ? String(item.item_id) : "none";
      const itemName =
        item.item_id != null
          ? ledgerItems.find((li) => li.id === item.item_id)?.name ?? `Unknown item (ID: ${item.item_id})`
          : "No item";
      let ledgerItemMap = itemTotals.get(item.ledger_id);
      if (!ledgerItemMap) {
        ledgerItemMap = new Map();
        itemTotals.set(item.ledger_id, ledgerItemMap);
      }
      const existing = ledgerItemMap.get(itemKey);
      if (existing) existing.value += amount;
      else ledgerItemMap.set(itemKey, { name: itemName, value: amount });
    });
  });

  const total = Array.from(ledgerTotals.values()).reduce((sum, v) => sum + v, 0);

  const rows = Array.from(ledgerTotals.entries())
    .map(([ledgerId, value]) => {
      const ledger = ledgers.find((l) => l.id === ledgerId);
      return {
        ledgerId,
        name: ledger?.name || `Unknown (ID: ${ledgerId})`,
        value: Number(value.toFixed(2)),
        percentage: total > 0 ? (value / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const itemsByLedgerId = new Map<number, LedgerItemBreakdownRow[]>();
  itemTotals.forEach((map, ledgerId) => {
    itemsByLedgerId.set(
      ledgerId,
      Array.from(map.entries())
        .map(([key, v]) => ({ key, name: v.name, value: Number(v.value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value)
    );
  });

  return { rows, itemsByLedgerId };
}

/** Horizontal color-bar breakdown, each row expandable to show the items
 * that make it up - same pattern used for time-tracking category/project
 * breakdowns. */
export function LedgerBreakdownList({
  rows,
  itemsByLedgerId,
  expandedIds,
  onToggle,
  formatValue,
}: {
  rows: LedgerBreakdownRow[];
  itemsByLedgerId: Map<number, LedgerItemBreakdownRow[]>;
  expandedIds: Record<number, boolean>;
  onToggle: (ledgerId: number) => void;
  formatValue: (value: number) => string;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row, index) => {
        const pct = Math.max(Math.min(row.percentage, 100), 3);
        const color = LEDGER_BREAKDOWN_COLORS[index % LEDGER_BREAKDOWN_COLORS.length];
        const isOpen = expandedIds[row.ledgerId] ?? false;
        const items = itemsByLedgerId.get(row.ledgerId) ?? [];
        return (
          <li
            key={row.ledgerId}
            className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
          >
            <button
              type="button"
              onClick={() => onToggle(row.ledgerId)}
              aria-expanded={isOpen}
              className="relative flex w-full items-center gap-2 overflow-hidden px-3 py-2 text-left text-sm"
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
              <svg
                className={`relative h-3.5 w-3.5 shrink-0 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="relative flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate font-bold text-zinc-900 dark:text-white">
                  {row.name}
                </span>
                <span className="shrink-0 font-mono text-xs font-bold text-zinc-800 dark:text-zinc-100">
                  {formatValue(row.value)} ·{" "}
                  <span style={{ color }}>{row.percentage.toFixed(1)}%</span>
                </span>
              </span>
            </button>
            {isOpen ? (
              <ul className="flex flex-col divide-y divide-zinc-100 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
                {items.length === 0 ? (
                  <li className="px-3 py-2 pl-9 text-xs text-zinc-500 dark:text-zinc-400">
                    No items recorded.
                  </li>
                ) : (
                  items.map((it) => (
                    <li
                      key={it.key}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 pl-9 text-xs"
                    >
                      <span className="truncate text-zinc-700 dark:text-zinc-300">{it.name}</span>
                      <span className="shrink-0 font-mono text-zinc-500 dark:text-zinc-400">
                        {formatValue(it.value)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
