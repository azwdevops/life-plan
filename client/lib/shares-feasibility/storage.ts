import type { SharesFeasibilityState } from "./types";

export function createDefaultSharesFeasibilityState(): SharesFeasibilityState {
  return {
    companies: [],
    accounts: [],
    variables: [],
    years: [],
    values: {},
    formulas: [],
    computedResults: {},
  };
}

/** Normalizes a JSON-like object into `SharesFeasibilityState` (e.g. API response). */
export function parseSharesFeasibilityStatePayload(
  parsed: unknown
): SharesFeasibilityState {
  const p =
    parsed && typeof parsed === "object"
      ? (parsed as Partial<SharesFeasibilityState>)
      : {};
  return {
    companies: Array.isArray(p.companies) ? p.companies : [],
    accounts: Array.isArray(p.accounts)
      ? p.accounts.map((account) => ({
          ...account,
          normalizedLabel:
            typeof account.normalizedLabel === "string"
              ? account.normalizedLabel
              : String(account.label ?? "").trim().toLowerCase(),
        }))
      : [],
    variables: [],
    years: Array.isArray(p.years)
      ? p.years.filter((year): year is number => Number.isInteger(year))
      : [],
    values: p.values && typeof p.values === "object" ? p.values : {},
    formulas: Array.isArray(p.formulas)
      ? p.formulas.map((formula) => ({
          ...formula,
          expression:
            typeof formula.expression === "string" ? formula.expression : "",
          overTimeAggregation:
            formula.overTimeAggregation === "sum" ||
            formula.overTimeAggregation === "avg" ||
            formula.overTimeAggregation === "first" ||
            formula.overTimeAggregation === "last"
              ? formula.overTimeAggregation
              : "sum",
        }))
      : [],
    computedResults:
      p.computedResults && typeof p.computedResults === "object"
        ? p.computedResults
        : {},
  };
}
