"use client";

import { useEffect, useState } from "react";

export type PeriodType = "month" | "quarter" | "half_year" | "year" | "custom";
export type HalfYearHalf = 1 | 2;

const PERIOD_TYPES: PeriodType[] = ["month", "quarter", "half_year", "year", "custom"];

/**
 * Same shape as the plain useState-based period filter (periodType,
 * selectedMonthDate, customStartDate, customEndDate), but persists the
 * selection to localStorage so it survives a page reload.
 */
export function usePersistedPeriodFilter(storageKey: string) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
  const [selectedQuarterDate, setSelectedQuarterDate] = useState<Date>(new Date());
  const [selectedYearDate, setSelectedYearDate] = useState<Date>(new Date());
  const [selectedHalf, setSelectedHalf] = useState<HalfYearHalf>(
    new Date().getMonth() < 6 ? 1 : 2
  );
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (PERIOD_TYPES.includes(saved.periodType)) {
        setPeriodType(saved.periodType);
      }
      if (saved.selectedMonthDate) setSelectedMonthDate(new Date(saved.selectedMonthDate));
      if (saved.selectedQuarterDate) setSelectedQuarterDate(new Date(saved.selectedQuarterDate));
      if (saved.selectedYearDate) setSelectedYearDate(new Date(saved.selectedYearDate));
      if (saved.selectedHalf === 1 || saved.selectedHalf === 2) setSelectedHalf(saved.selectedHalf);
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
          selectedQuarterDate: selectedQuarterDate.toISOString(),
          selectedYearDate: selectedYearDate.toISOString(),
          selectedHalf,
          customStartDate: customStartDate ? customStartDate.toISOString() : null,
          customEndDate: customEndDate ? customEndDate.toISOString() : null,
        })
      );
    } catch {
      // ignore
    }
  }, [
    storageKey,
    periodType,
    selectedMonthDate,
    selectedQuarterDate,
    selectedYearDate,
    selectedHalf,
    customStartDate,
    customEndDate,
  ]);

  return {
    periodType,
    selectedMonthDate,
    selectedQuarterDate,
    selectedYearDate,
    selectedHalf,
    customStartDate,
    customEndDate,
    setPeriodType,
    setSelectedMonthDate,
    setSelectedQuarterDate,
    setSelectedYearDate,
    setSelectedHalf,
    setCustomStartDate,
    setCustomEndDate,
  };
}
