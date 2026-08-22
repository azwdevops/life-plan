"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import { usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  disconnectYoutubeAccount,
  getYoutubeAccounts,
  getYoutubeChannelStats,
  getYoutubeOAuthUrl,
  syncYoutubeChannel,
  updateYoutubeChannel,
  type YoutubeAccount,
  type YoutubeChannel,
} from "@/lib/api/youtube";

function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function formatSyncedAt(iso: string | undefined): string {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  return `Synced ${d.toLocaleDateString()} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
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
    return <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Loading history…</p>;
  }
  if (data.length < 2) {
    return (
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Sync at least twice to see subscriber growth over time.
      </p>
    );
  }
  return (
    <div className="mt-3 h-40 w-full">
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

function ChannelCard({ channel, token }: { channel: YoutubeChannel; token: string }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [monetizeConfirm, setMonetizeConfirm] = useState<boolean | null>(null);
  const [rpmDraft, setRpmDraft] = useState(channel.estimated_rpm != null ? String(channel.estimated_rpm) : "");
  const [savingRpm, setSavingRpm] = useState(false);

  const stat = channel.latest_stat;
  const mtdViews = stat?.month_to_date_views ?? null;
  const rpm = channel.estimated_rpm;
  const estimatedRevenue =
    channel.is_monetized && mtdViews != null && rpm != null ? (mtdViews / 1000) * rpm : null;

  const refreshAccounts = () => queryClient.invalidateQueries({ queryKey: ["youtube-accounts", token] });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncYoutubeChannel(token, channel.id);
      await refreshAccounts();
      void queryClient.invalidateQueries({ queryKey: ["youtube-channel-stats", channel.id, token] });
    } catch {
      // Best-effort; the card just keeps its previous stats on failure.
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

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        {channel.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.thumbnail_url}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            📺
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{channel.title}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatSyncedAt(stat?.synced_at)}</p>
        </div>
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
            onClick={() => void handleSync()}
            disabled={syncing}
            title="Sync stats"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            <IconSync spinning={syncing} />
          </button>
        </div>
      </div>

      <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        <StatRow label="Subscribers" value={formatCount(stat?.subscriber_count)} />
        <StatRow label="Total views" value={formatCount(stat?.view_count)} />
        <StatRow label="Watch time (hrs)" value={formatCount(stat?.watch_time_hours ?? null)} />
        <StatRow label="Views this month" value={formatCount(mtdViews)} />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Monetized</span>
        <button
          type="button"
          role="switch"
          aria-checked={channel.is_monetized}
          onClick={() => setMonetizeConfirm(!channel.is_monetized)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            channel.is_monetized ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              channel.is_monetized ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {channel.is_monetized && (
        <div className="mt-2 space-y-2 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`rpm-${channel.id}`} className="text-sm text-zinc-600 dark:text-zinc-300">
              Estimated RPM ($/1000 views)
            </label>
            <input
              id={`rpm-${channel.id}`}
              type="number"
              min="0"
              step="0.1"
              value={rpmDraft}
              onChange={(e) => setRpmDraft(e.target.value)}
              onBlur={() => void saveRpm()}
              disabled={savingRpm}
              placeholder="e.g. 2.5"
              className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <StatRow
            label="Estimated revenue this month"
            value={estimatedRevenue != null ? `$${estimatedRevenue.toFixed(2)}` : "—"}
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
      {expanded && <ChannelGrowthChart channelId={channel.id} token={token} />}

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
    </div>
  );
}

function AccountSection({ account, token }: { account: YoutubeAccount; token: string }) {
  const queryClient = useQueryClient();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const handleDisconnect = async () => {
    await disconnectYoutubeAccount(token, account.id);
    setConfirmingDisconnect(false);
    void queryClient.invalidateQueries({ queryKey: ["youtube-accounts", token] });
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {account.google_email}
        </h2>
        <DropdownMenu
          menuButtonAriaLabel={`Actions for ${account.google_email}`}
          items={[{ label: "Disconnect", onClick: () => setConfirmingDisconnect(true), danger: true }]}
        />
      </div>
      {account.channels.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          No channels found on this account.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {account.channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} token={token} />
          ))}
        </div>
      )}

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
    </section>
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
    ],
    [token, connecting]
  );
  usePageHeaderActions(headerActions);

  if (!token) return null;

  return (
    <div className="space-y-6 px-4 py-4 md:px-6">
      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {banner.message}
        </div>
      )}

      {accountsQuery.isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading connected accounts…</p>
      ) : accountsQuery.isError ? (
        <p className="text-sm text-red-700 dark:text-red-300">Could not load connected accounts.</p>
      ) : (accountsQuery.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            No Google accounts connected yet. Open the <span aria-hidden>⋮</span> &ldquo;More actions&rdquo; menu in
            the top header and select &ldquo;Connect Google account&rdquo; to link the first one.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {(accountsQuery.data ?? []).map((account) => (
            <AccountSection key={account.id} account={account} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
