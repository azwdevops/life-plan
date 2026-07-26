"use client";

import { useEffect, useState } from "react";

export type PeriodType = "month" | "custom";

/**
 * Same shape as the plain useState-based period filter (periodType,
 * selectedMonthDate, customStartDate, customEndDate), but persists the
 * selection to localStorage so it survives a page reload.
 */
export function usePersistedPeriodFilter(storageKey: string) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.periodType === "month" || saved.periodType === "custom") {
        setPeriodType(saved.periodType);
      }
      if (saved.selectedMonthDate) setSelectedMonthDate(new Date(saved.selectedMonthDate));
      if (saved.customStartDate) setCustomStartDate(new Date(saved.customStartDate));
      if (saved.customEndDate) setCustomEndDate(new Date(saved.customEndDate));
    } catch {
      // ignore malformed/unavailable storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          periodType,
          selectedMonthDate: selectedMonthDate.toISOString(),
          customStartDate: customStartDate ? customStartDate.toISOString() : null,
          customEndDate: customEndDate ? customEndDate.toISOString() : null,
        })
      );
    } catch {
      // ignore
    }
  }, [storageKey, periodType, selectedMonthDate, customStartDate, customEndDate]);

  return {
    periodType,
    selectedMonthDate,
    customStartDate,
    customEndDate,
    setPeriodType,
    setSelectedMonthDate,
    setCustomStartDate,
    setCustomEndDate,
  };
}
