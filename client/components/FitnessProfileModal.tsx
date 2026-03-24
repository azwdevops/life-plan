"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { putUserFitnessProfile, type UserResponse } from "@/lib/api/auth";

interface FitnessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  user: UserResponse | null;
  onSaved: (user: UserResponse) => void;
}

export function FitnessProfileModal({
  isOpen,
  onClose,
  token,
  user,
  onSaved,
}: FitnessProfileModalProps) {
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"" | "male" | "female" | "other">("");
  const [height, setHeight] = useState("");
  const [runningMet, setRunningMet] = useState("");
  const [statsRefreshSec, setStatsRefreshSec] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (!user) return;
    setWeight(user.weight_kg != null ? String(user.weight_kg) : "");
    setAge(user.age != null ? String(user.age) : "");
    setSex(
      user.sex === "male" || user.sex === "female" || user.sex === "other"
        ? user.sex
        : ""
    );
    setHeight(user.height_cm != null ? String(user.height_cm) : "");
    setRunningMet(user.running_met != null ? String(user.running_met) : "");
    setStatsRefreshSec(
      user.stats_refresh_interval_seconds != null
        ? String(user.stats_refresh_interval_seconds)
        : ""
    );
  }, [isOpen, user]);

  const buildPayload = () => {
    const weight_kg =
      weight.trim() === "" ? null : Number.parseFloat(weight.replace(",", "."));
    const ageVal = age.trim() === "" ? null : Number.parseInt(age, 10);
    const height_cm =
      height.trim() === "" ? null : Number.parseFloat(height.replace(",", "."));
    const running_met =
      runningMet.trim() === ""
        ? null
        : Number.parseFloat(runningMet.replace(",", "."));

    if (weight_kg != null && Number.isNaN(weight_kg)) {
      throw new Error("Weight must be a number (kg).");
    }
    if (ageVal != null && Number.isNaN(ageVal)) {
      throw new Error("Age must be a whole number.");
    }
    if (height_cm != null && Number.isNaN(height_cm)) {
      throw new Error("Height must be a number (cm).");
    }
    if (running_met != null && Number.isNaN(running_met)) {
      throw new Error("Running MET must be a number.");
    }

    let stats_refresh_interval_seconds: number | null = null;
    const sr = statsRefreshSec.trim();
    if (sr !== "") {
      const n = Number.parseInt(sr, 10);
      if (Number.isNaN(n)) {
        throw new Error("Stats refresh must be a whole number of seconds.");
      }
      if (n < 1 || n > 300) {
        throw new Error("Stats refresh must be between 1 and 300 seconds.");
      }
      stats_refresh_interval_seconds = n;
    }

    return {
      weight_kg,
      age: ageVal,
      sex: sex === "" ? null : sex,
      height_cm,
      running_met,
      stats_refresh_interval_seconds,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const body = buildPayload();
      setSaving(true);
      const updated = await putUserFitnessProfile(token, body);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Exercise metrics"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          These values are saved to your account and used for estimated energy
          use when you log runs and other exercise. You can change them anytime.
          The stats refresh interval controls how often distance and calories
          update during a live run (default 3s if left blank).
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Weight (kg)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 74.5"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Height (cm)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="e.g. 178"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Age (years)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 35"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Running MET multiplier
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={runningMet}
            onChange={(e) => setRunningMet(e.target.value)}
            placeholder="Default 1.0"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            kcal estimate uses weight × distance × MET. Typical running values are
            around 0.9–1.1.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Live stats refresh (seconds)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={statsRefreshSec}
            onChange={(e) => setStatsRefreshSec(e.target.value)}
            placeholder="Default 3"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            1–300. Stored with your profile; each saved run records the value
            used for that session.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Sex
          </label>
          <select
            value={sex}
            onChange={(e) =>
              setSex(e.target.value as "" | "male" | "female" | "other")
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / prefer not to say</option>
          </select>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
