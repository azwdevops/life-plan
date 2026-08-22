"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import { RightDrawer } from "@/components/RightDrawer";
import { usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  disconnectYoutubeAccount,
  getYoutubeAccounts,
  getYoutubeChannelStats,
  getYoutubeOAuthUrl,
  syncYoutubeChannel,
  updateYoutubeAccount,
  updateYoutubeChannel,
  type YoutubeAccount,
  type YoutubeChannel,
} from "@/lib/api/youtube";

const TABLE_COLUMN_COUNT = 9;

// Always-on earnings estimate, independent of the per-channel `is_monetized`
// toggle/custom RPM above - this content is Kikuyu-language Kenyan music
// videos with a ~90% Kenya-based audience, so it uses a fixed blended RPM
// researched for that specific mix rather than the user-entered one:
//   - Kenya's country-level CPM sits around $3.20 (vs. $10+ for the US/UK/CA/AU
//     tier), and entertainment/music is itself a lower-paying content niche
//     ($2-8 CPM vs. $10-25 for finance/education).
//   - Creator RPM (what actually gets paid out, after YouTube's ~45% cut) runs
//     roughly 45-55% of CPM.
//   - Combining a low-CPM country with a low-CPM niche, then blending in the
//     ~10% non-Kenya views (assumed closer to a $2-4 CPM mix), lands on
//     roughly $1.00 per 1,000 views as a defensible blended RPM estimate.
// Source: Lenostube & SMM Africa YouTube CPM/RPM country + niche breakdowns
// (2026), which put Kenya CPM at ~$3.20 and entertainment niche CPM at $2-8.
const ASSUMED_RPM_USD = 1.0;
const USD_TO_KES = 127;

function formatUsd(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toFixed(2)}`;
}

function formatKes(n: number | null): string {
  if (n === null) return "—";
  return `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Same blended-RPM math as useChannelController's per-channel estimate, but
// treating a channel with no synced views yet as $0 rather than "—" - correct
// for summing into an account/grand total, where an unsynced channel should
// just not contribute rather than making the whole total unknown.
function estimateEarningsFromViews(mtdViews: number | null | undefined): { usd: number; kes: number } {
  const usd = mtdViews != null ? (mtdViews / 1000) * ASSUMED_RPM_USD : 0;
  return { usd, kes: usd * USD_TO_KES };
}

function sumEarnings(channels: YoutubeChannel[]): { usd: number; kes: number } {
  return channels.reduce(
    (acc, channel) => {
      const { usd, kes } = estimateEarningsFromViews(channel.latest_stat?.month_to_date_views);
      return { usd: acc.usd + usd, kes: acc.kes + kes };
    },
    { usd: 0, kes: 0 }
  );
}

interface AccountDisplayGroup {
  key: string;
  label: string | null;
  accounts: YoutubeAccount[];
}

// Google reports a personal Gmail login and each Brand Account channel it
// manages as separate identities, with no reliable shared id - so grouping
// here is purely display-driven, keyed off the user-set `group_label`.
function groupAccounts(accounts: YoutubeAccount[]): AccountDisplayGroup[] {
  const groups: AccountDisplayGroup[] = [];
  const byLabel = new Map<string, AccountDisplayGroup>();
  for (const account of accounts) {
    const label = account.group_label?.trim() || null;
    if (label) {
      let group = byLabel.get(label);
      if (!group) {
        group = { key: `group-${label}`, label, accounts: [] };
        byLabel.set(label, group);
        groups.push(group);
      }
      group.accounts.push(account);
    } else {
      groups.push({ key: `account-${account.id}`, label: null, accounts: [account] });
    }
  }
  return groups;
}

function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function IconSync({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M3 3v18h18M7 15l4-5 3 3 5-7" />
    </svg>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-mono font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

function ChannelGrowthChart({ channelId, token }: { channelId: number; token: string }) {
  const historyQuery = useQuery({
    queryKey: ["youtube-channel-stats", channelId, token],
    queryFn: () => getYoutubeChannelStats(token, channelId),
    enabled: !!token,
  });

  const data = useMemo(
    () =>
      (historyQuery.data ?? []).map((s) => ({
        label: new Date(s.synced_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        subscribers: s.subscriber_count,
      })),
    [historyQuery.data]
  );

  if (historyQuery.isLoading) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading history…</p>;
  }
  if (data.length < 2) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Sync at least twice to see subscriber growth over time.
      </p>
    );
  }
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" className="dark:opacity-30" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#71717a" }} width={32} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="subscribers"
            name="Subscribers"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Shared state/logic behind one channel's stats, sync, monetize toggle and RPM
// input - both the mobile card and the desktop table row render their own
// instance of this hook so each keeps independent local UI state (syncing
// spinner, draft RPM value, etc.) while sharing the same behavior.
function useChannelController(channel: YoutubeChannel, token: string) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [monetizeConfirm, setMonetizeConfirm] = useState<boolean | null>(null);
  const [rpmDraft, setRpmDraft] = useState(channel.estimated_rpm != null ? String(channel.estimated_rpm) : "");
  const [savingRpm, setSavingRpm] = useState(false);

  const stat = channel.latest_stat;
  const mtdViews = stat?.month_to_date_views ?? null;
  const rpm = channel.estimated_rpm;
  const estimatedRevenue =
    channel.is_monetized && mtdViews != null && rpm != null ? (mtdViews / 1000) * rpm : null;

  // Blended-RPM earnings estimate - always shown, regardless of the
  // is_monetized toggle above (that one reflects the user's own real RPM once
  // a channel is actually monetized; this one is a rough "what could this be
  // worth" figure for every channel, monetized or not).
  const estimatedEarningsUsd = mtdViews != null ? (mtdViews / 1000) * ASSUMED_RPM_USD : null;
  const estimatedEarningsKes = estimatedEarningsUsd != null ? estimatedEarningsUsd * USD_TO_KES : null;

  const refreshAccounts = () => queryClient.invalidateQueries({ queryKey: ["youtube-accounts", token] });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncYoutubeChannel(token, channel.id);
      await refreshAccounts();
      void queryClient.invalidateQueries({ queryKey: ["youtube-channel-stats", channel.id, token] });
    } catch {
      // Best-effort; keeps previous stats on failure.
    } finally {
      setSyncing(false);
    }
  };

  const confirmMonetizeToggle = async () => {
    if (monetizeConfirm === null) return;
    try {
      await updateYoutubeChannel(token, channel.id, { is_monetized: monetizeConfirm });
      await refreshAccounts();
    } finally {
      setMonetizeConfirm(null);
    }
  };

  const saveRpm = async () => {
    const trimmed = rpmDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    if (value === rpm) return;
    setSavingRpm(true);
    try {
      await updateYoutubeChannel(token, channel.id, { estimated_rpm: value });
      await refreshAccounts();
    } finally {
      setSavingRpm(false);
    }
  };

  return {
    stat,
    mtdViews,
    estimatedRevenue,
    estimatedEarningsUsd,
    estimatedEarningsKes,
    syncing,
    handleSync,
    monetizeConfirm,
    setMonetizeConfirm,
    confirmMonetizeToggle,
    rpmDraft,
    setRpmDraft,
    savingRpm,
    saveRpm,
  };
}

function ChannelMonetizeDialog({
  monetizeConfirm,
  setMonetizeConfirm,
  confirmMonetizeToggle,
}: {
  monetizeConfirm: boolean | null;
  setMonetizeConfirm: (v: boolean | null) => void;
  confirmMonetizeToggle: () => void;
}) {
  return (
    <Dialog
      isOpen={monetizeConfirm !== null}
      onClose={() => setMonetizeConfirm(null)}
      title={monetizeConfirm ? "Mark channel as monetized?" : "Mark channel as not monetized?"}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {monetizeConfirm
            ? "This only affects the revenue estimate shown here - YouTube's actual monetization status isn't available through the API."
            : "This will stop showing a revenue estimate for this channel."}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setMonetizeConfirm(null)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmMonetizeToggle()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function MonetizedSwitch({ isMonetized, onToggle }: { isMonetized: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isMonetized}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        isMonetized ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          isMonetized ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Mobile (< md): one bordered label/value card per channel, per the project's
// mobile-first table rule - the actual <table> only renders at md: and up.
function ChannelCardMobile({
  channel,
  token,
  account,
  allAccounts,
}: {
  channel: YoutubeChannel;
  token: string;
  account: YoutubeAccount;
  allAccounts: YoutubeAccount[];
}) {
  const c = useChannelController(channel, token);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        {channel.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            📺
          </div>
        )}
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {channel.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={channel.studio_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open YouTube Studio"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <IconExternalLink />
          </a>
          <button
            type="button"
            onClick={() => void c.handleSync()}
            disabled={c.syncing}
            title="Sync stats"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            <IconSync spinning={c.syncing} />
          </button>
          <AccountActionsMenu account={account} token={token} allAccounts={allAccounts} />
        </div>
      </div>

      <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        <StatRow label="Subscribers" value={formatCount(c.stat?.subscriber_count)} />
        <StatRow label="Total views" value={formatCount(c.stat?.view_count)} />
        <StatRow label="Watch time (hrs)" value={formatCount(c.stat?.watch_time_hours ?? null)} />
        <StatRow label="Views this month" value={formatCount(c.mtdViews)} />
        <StatRow label="Est. earnings (USD)" value={formatUsd(c.estimatedEarningsUsd)} />
        <StatRow label="Est. earnings (KES)" value={formatKes(c.estimatedEarningsKes)} />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Monetized</span>
        <MonetizedSwitch isMonetized={channel.is_monetized} onToggle={() => c.setMonetizeConfirm(!channel.is_monetized)} />
      </div>

      {channel.is_monetized && (
        <div className="mt-2 space-y-2 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`rpm-mobile-${channel.id}`} className="text-sm text-zinc-600 dark:text-zinc-300">
              Estimated RPM ($/1000 views)
            </label>
            <input
              id={`rpm-mobile-${channel.id}`}
              type="number"
              min="0"
              step="0.1"
              value={c.rpmDraft}
              onChange={(e) => c.setRpmDraft(e.target.value)}
              onBlur={() => void c.saveRpm()}
              disabled={c.savingRpm}
              placeholder="e.g. 2.5"
              className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <StatRow
            label="Estimated revenue this month"
            value={c.estimatedRevenue != null ? `$${c.estimatedRevenue.toFixed(2)}` : "—"}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex w-full items-center justify-between text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {expanded ? "Hide subscriber growth" : "View subscriber growth"}
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
      </button>
      {expanded && (
        <div className="mt-3">
          <ChannelGrowthChart channelId={channel.id} token={token} />
        </div>
      )}

      <ChannelMonetizeDialog
        monetizeConfirm={c.monetizeConfirm}
        setMonetizeConfirm={c.setMonetizeConfirm}
        confirmMonetizeToggle={c.confirmMonetizeToggle}
      />
    </div>
  );
}

// Desktop (md: and up): one row per channel inside the shared account/channel
// table, with an optional expand row below it for the growth chart.
function ChannelTableRow({
  channel,
  token,
  account,
  allAccounts,
}: {
  channel: YoutubeChannel;
  token: string;
  account: YoutubeAccount;
  allAccounts: YoutubeAccount[];
}) {
  const c = useChannelController(channel, token);
  const [expanded, setExpanded] = useState(false);

  return (
    <Fragment>
      <tr className="border-t border-zinc-100 dark:border-zinc-800">
        <td className="px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {channel.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={channel.thumbnail_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
                📺
              </div>
            )}
            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{channel.title}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatCount(c.stat?.subscriber_count)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatCount(c.stat?.view_count)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatCount(c.stat?.watch_time_hours ?? null)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatCount(c.mtdViews)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatUsd(c.estimatedEarningsUsd)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {formatKes(c.estimatedEarningsKes)}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col items-start gap-1.5">
            <MonetizedSwitch isMonetized={channel.is_monetized} onToggle={() => c.setMonetizeConfirm(!channel.is_monetized)} />
            {channel.is_monetized && (
              <div className="flex items-center gap-1">
                <input
                  aria-label="Estimated RPM ($/1000 views)"
                  type="number"
                  min="0"
                  step="0.1"
                  value={c.rpmDraft}
                  onChange={(e) => c.setRpmDraft(e.target.value)}
                  onBlur={() => void c.saveRpm()}
                  disabled={c.savingRpm}
                  placeholder="RPM"
                  className="w-16 rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-right text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <span className="whitespace-nowrap font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {c.estimatedRevenue != null ? `$${c.estimatedRevenue.toFixed(2)}` : "—"}
                </span>
              </div>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-1">
            <a
              href={channel.studio_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open YouTube Studio"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <IconExternalLink />
            </a>
            <button
              type="button"
              onClick={() => void c.handleSync()}
              disabled={c.syncing}
              title="Sync stats"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              <IconSync spinning={c.syncing} />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Hide subscriber growth" : "View subscriber growth"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                expanded ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <IconChart />
            </button>
            <AccountActionsMenu account={account} token={token} allAccounts={allAccounts} />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-zinc-100 dark:border-zinc-800">
          <td colSpan={TABLE_COLUMN_COUNT} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900/40">
            <ChannelGrowthChart channelId={channel.id} token={token} />
          </td>
        </tr>
      )}
      <ChannelMonetizeDialog
        monetizeConfirm={c.monetizeConfirm}
        setMonetizeConfirm={c.setMonetizeConfirm}
        confirmMonetizeToggle={c.confirmMonetizeToggle}
      />
    </Fragment>
  );
}

// Right sidebar for setting/editing the shared label that groups this account
// with others (a personal Gmail + its Brand Account channels, reported by
// Google as separate identities) for display purposes only.
function GroupAccountsDrawer({
  open,
  onClose,
  token,
  allAccounts,
  initialAccountIds,
  initialLabel,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  allAccounts: YoutubeAccount[];
  initialAccountIds: number[];
  initialLabel: string;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(initialLabel);
  const [selected, setSelected] = useState<Set<number>>(new Set(initialAccountIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  // Reset to this account/group's current state each time the drawer opens.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setLabel(initialLabel);
      setSelected(new Set(initialAccountIds));
      setError(null);
    }
    wasOpen.current = open;
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmedLabel = label.trim();
    if (selected.size > 0 && !trimmedLabel) {
      setError("Enter a name for the group.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const toGroup = [...selected];
      const toUngroup = initialAccountIds.filter((id) => !selected.has(id));
      await Promise.all([
        ...toGroup.map((id) => updateYoutubeAccount(token, id, { group_label: trimmedLabel || null })),
        ...toUngroup.map((id) => updateYoutubeAccount(token, id, { group_label: null })),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["youtube-accounts", token] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save group.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RightDrawer open={open} onClose={onClose} title="Group accounts" width="sm">
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Google can report a personal Gmail login and a Brand Account channel as separate accounts. Give
          them a shared name here to display their channels together.
        </p>
        <div>
          <label htmlFor="youtube-group-label" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Group name
          </label>
          <input
            id="youtube-group-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Kenyan Mugithi"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Accounts in this group</p>
          <div className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {allAccounts.map((account) => (
              <label
                key={account.id}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200"
              >
                <input
                  type="checkbox"
                  checked={selected.has(account.id)}
                  onChange={() => toggle(account.id)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                />
                <span className="truncate">{account.google_email}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </RightDrawer>
  );
}

// Shared "Disconnect"/"Group with another account" menu + dialogs for one
// account - rendered once in the mobile section header and once in the
// desktop group header row, each keeping its own open/confirm state.
function AccountActionsMenu({
  account,
  token,
  allAccounts,
}: {
  account: YoutubeAccount;
  token: string;
  allAccounts: YoutubeAccount[];
}) {
  const queryClient = useQueryClient();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);

  const handleDisconnect = async () => {
    await disconnectYoutubeAccount(token, account.id);
    setConfirmingDisconnect(false);
    void queryClient.invalidateQueries({ queryKey: ["youtube-accounts", token] });
  };

  const groupPartnerIds = account.group_label
    ? allAccounts.filter((a) => a.group_label === account.group_label).map((a) => a.id)
    : [account.id];

  return (
    <>
      <DropdownMenu
        menuButtonAriaLabel={`Actions for ${account.google_email}`}
        items={[
          {
            label: account.group_label ? "Edit group" : "Group with another account…",
            onClick: () => setGroupDrawerOpen(true),
          },
          { label: "Disconnect", onClick: () => setConfirmingDisconnect(true), danger: true },
        ]}
      />
      <Dialog
        isOpen={confirmingDisconnect}
        onClose={() => setConfirmingDisconnect(false)}
        title="Disconnect this account?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            This removes {account.google_email} and all {account.channels.length} of its channels, including
            their synced history, from Life Plan. You can reconnect it later.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDisconnect(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Disconnect
            </button>
          </div>
        </div>
      </Dialog>
      <GroupAccountsDrawer
        open={groupDrawerOpen}
        onClose={() => setGroupDrawerOpen(false)}
        token={token}
        allAccounts={allAccounts}
        initialAccountIds={groupPartnerIds}
        initialLabel={account.group_label ?? ""}
      />
    </>
  );
}

// Mobile (< md): one section per account - a stack of bordered channel cards,
// each carrying its own account actions menu (no raw account email, which for
// a Brand Account is an ugly synthetic address like "...@pages.plusgoogle.com",
// and no separate near-empty header row for it).
function AccountSectionMobile({
  account,
  token,
  allAccounts,
}: {
  account: YoutubeAccount;
  token: string;
  allAccounts: YoutubeAccount[];
}) {
  return (
    <section>
      {account.channels.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          No channels found on this account.
        </p>
      ) : (
        <div className="space-y-3">
          {account.channels.map((channel) => (
            <ChannelCardMobile key={channel.id} channel={channel} token={token} account={account} allAccounts={allAccounts} />
          ))}
        </div>
      )}
    </section>
  );
}

// One total, summed across every account in a display group (a lone
// ungrouped account counts as its own one-account group) - shown once after
// all of that group's account sections, not per account.
function GroupTotalMobile({ totals }: { totals: { usd: number; kes: number } }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Group total</p>
      <div className="mt-1 divide-y divide-zinc-200 dark:divide-zinc-700">
        <StatRow label="Est. earnings (USD)" value={formatUsd(totals.usd)} />
        <StatRow label="Est. earnings (KES)" value={formatKes(totals.kes)} />
      </div>
    </div>
  );
}

// Desktop (md: and up): one table section per account - a column header row
// then that account's channel rows, each carrying its own account actions
// menu (no raw account email, which for a Brand Account is an ugly synthetic
// address like "...@pages.plusgoogle.com", and no separate near-empty header
// row for it). A <tbody> per account (rather than one shared <thead>) is what
// lets each account's rows read as their own group.
function AccountTableGroup({
  account,
  token,
  allAccounts,
  showHeader = true,
}: {
  account: YoutubeAccount;
  token: string;
  allAccounts: YoutubeAccount[];
  showHeader?: boolean;
}) {
  return (
    <tbody className={showHeader ? "border-t-2 border-zinc-200 dark:border-zinc-700" : undefined}>
      {showHeader && (
        <tr className="bg-zinc-50/60 text-left text-xs font-medium text-zinc-500 dark:bg-zinc-800/30 dark:text-zinc-400">
          <th scope="col" className="px-3 py-2 font-medium">
            Channel
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Subscribers
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Total views
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Watch time (hrs)
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Views (month)
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Est. earnings (USD)
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Est. earnings (KES)
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Monetized
          </th>
          <th scope="col" className="px-3 py-2" />
        </tr>
      )}
      {account.channels.length === 0 ? (
        <tr className="border-t border-zinc-100 dark:border-zinc-800">
          <td colSpan={TABLE_COLUMN_COUNT} className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No channels found on this account.
          </td>
        </tr>
      ) : (
        account.channels.map((channel) => (
          <ChannelTableRow key={channel.id} channel={channel} token={token} account={account} allAccounts={allAccounts} />
        ))
      )}
    </tbody>
  );
}

// One total row, summed across every account in a display group (a lone
// ungrouped account counts as its own one-account group) - rendered once
// after all of that group's <AccountTableGroup> tbody blocks, not per account.
function GroupTotalRow({ totals }: { totals: { usd: number; kes: number } }) {
  return (
    <tbody>
      <tr className="border-t border-zinc-200 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-800/30">
        <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Group total
        </td>
        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {formatUsd(totals.usd)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {formatKes(totals.kes)}
        </td>
        <td colSpan={2} />
      </tr>
    </tbody>
  );
}

export function YoutubePanel() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ["youtube-accounts", token],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getYoutubeAccounts(token);
    },
    enabled: !!token,
  });

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("youtube_error");
    if (connected) {
      setBanner({ kind: "success", message: "Google account connected." });
      router.replace("/music-business/youtube");
    } else if (error) {
      setBanner({ kind: "error", message: error });
      router.replace("/music-business/youtube");
    }
  }, [searchParams, router]);

  const headerActions = useMemo(
    () => [
      {
        label: connecting ? "Connecting…" : "Connect Google account",
        onClick: () => {
          if (!token || connecting) return;
          setConnecting(true);
          getYoutubeOAuthUrl(token)
            .then((url) => {
              window.location.href = url;
            })
            .catch(() => setConnecting(false));
        },
        disabled: connecting,
      },
      {
        label: accountsQuery.isFetching ? "Refreshing…" : "Refresh",
        onClick: () => {
          void accountsQuery.refetch();
        },
        disabled: accountsQuery.isFetching,
      },
    ],
    [token, connecting, accountsQuery.isFetching, accountsQuery.refetch]
  );
  usePageHeaderActions(headerActions);

  if (!token) return null;

  const accounts = accountsQuery.data ?? [];
  const accountGroups = groupAccounts(accounts);
  const grandTotals = sumEarnings(accounts.flatMap((a) => a.channels));

  return (
    <div className="space-y-6 px-4 py-4 md:px-6">
      <Dialog
        isOpen={banner !== null}
        onClose={() => setBanner(null)}
        title={banner?.kind === "success" ? "Account connected" : "Connection failed"}
        size="sm"
      >
        <div className="space-y-4">
          <p
            className={`text-sm ${
              banner?.kind === "success"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            {banner?.message}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Okay
            </button>
          </div>
        </div>
      </Dialog>

      {accountsQuery.isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading connected accounts…</p>
      ) : accountsQuery.isError ? (
        <p className="text-sm text-red-700 dark:text-red-300">Could not load connected accounts.</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            No Google accounts connected yet. Open the <span aria-hidden>⋮</span> &ldquo;More actions&rdquo; menu in
            the top header and select &ldquo;Connect Google account&rdquo; to link the first one.
          </p>
        </div>
      ) : (
        <>
          {/* Shown once regardless of viewport - grand total across every
              connected account's channels. */}
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Estimated total earnings (all channels)
            </p>
            <div className="flex items-center gap-4">
              <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {formatUsd(grandTotals.usd)}
              </span>
              <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                {formatKes(grandTotals.kes)}
              </span>
            </div>
          </div>

          {/* Mobile: stacked account sections, one bordered card per channel. */}
          <div className="space-y-8 md:hidden">
            {accountGroups.map((group) => {
              const groupTotals = sumEarnings(group.accounts.flatMap((a) => a.channels));
              return (
                <div key={group.key} className="space-y-4">
                  {group.label && group.accounts.length > 1 && (
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{group.label}</h2>
                  )}
                  <div
                    className={
                      group.label && group.accounts.length > 1
                        ? "space-y-6 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700"
                        : "space-y-6"
                    }
                  >
                    {group.accounts.map((account) => (
                      <AccountSectionMobile key={account.id} account={account} token={token} allAccounts={accounts} />
                    ))}
                    <GroupTotalMobile totals={groupTotals} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: one table, channels grouped under a header row per account
              (and under a group-name row first, when 2+ accounts share a label). */}
          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 md:block">
            <table className="w-full min-w-180 border-collapse">
              {accountGroups.map((group) => {
                const groupTotals = sumEarnings(group.accounts.flatMap((a) => a.channels));
                return (
                  <Fragment key={group.key}>
                    {group.label && group.accounts.length > 1 && (
                      <tbody>
                        <tr className="border-t-4 border-zinc-300 dark:border-zinc-600">
                          <td colSpan={TABLE_COLUMN_COUNT} className="bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{group.label}</span>
                          </td>
                        </tr>
                      </tbody>
                    )}
                    {group.accounts.map((account, idx) => (
                      <AccountTableGroup
                        key={account.id}
                        account={account}
                        token={token}
                        allAccounts={accounts}
                        showHeader={idx === 0}
                      />
                    ))}
                    <GroupTotalRow totals={groupTotals} />
                  </Fragment>
                );
              })}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
