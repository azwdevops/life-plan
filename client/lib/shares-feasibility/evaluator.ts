import type {
  Company,
  CompanyFormulaResult,
  ComputationStatus,
  ExpressionNode,
  SharesFeasibilityState,
  SharesFormula,
  ValuesMap,
  YearlyComputation,
} from "./types";

type EvalOutcome = {
  value: number | null;
  status: ComputationStatus;
  reason?: string;
};

function getCellValue(
  values: ValuesMap,
  companyId: string,
  accountId: string,
  year: number
): number | undefined {
  const byCompany = values[companyId];
  if (!byCompany) return undefined;
  const byAccount = byCompany[accountId];
  if (!byAccount) return undefined;
  return byAccount[String(year)];
}

function evaluateNode(
  node: ExpressionNode,
  companyId: string,
  values: ValuesMap,
  year: number
): EvalOutcome {
  if (node.type === "constant") {
    return { value: node.value, status: "ok" };
  }

  if (node.type === "account") {
    const value = getCellValue(values, companyId, node.accountId, year);
    if (!Number.isFinite(value)) {
      return { value: null, status: "missing_data", reason: "Missing account value." };
    }
    return { value, status: "ok" };
  }

  const left = evaluateNode(node.left, companyId, values, year);
  if (left.status !== "ok" || left.value == null) return left;
  const right = evaluateNode(node.right, companyId, values, year);
  if (right.status !== "ok" || right.value == null) return right;

  if (node.operator === "+") {
    return { value: left.value + right.value, status: "ok" };
  }
  if (node.operator === "-") {
    return { value: left.value - right.value, status: "ok" };
  }
  if (node.operator === "*") {
    return { value: left.value * right.value, status: "ok" };
  }
  if (right.value === 0) {
    return {
      value: null,
      status: "division_by_zero",
      reason: "Division by zero.",
    };
  }
  return { value: left.value / right.value, status: "ok" };
}

function toYearlyComputation(outcome: EvalOutcome): YearlyComputation {
  return {
    value: outcome.value,
    status: outcome.status,
    reason: outcome.reason,
  };
}

export function evaluateYearlyFormula(
  formula: SharesFormula,
  companyId: string,
  years: number[],
  values: ValuesMap
): Record<string, YearlyComputation> {
  return years.reduce<Record<string, YearlyComputation>>((acc, year) => {
    acc[String(year)] = toYearlyComputation(
      evaluateNode(formula.expressionTree, companyId, values, year)
    );
    return acc;
  }, {});
}

export function evaluateOverTimeFormula(
  formula: SharesFormula,
  companyId: string,
  years: number[],
  values: ValuesMap
): YearlyComputation {
  const yearlyMap = evaluateYearlyFormula(formula, companyId, years, values);
  if (years.length === 0) {
    return { value: null, status: "missing_data", reason: "No years available." };
  }
  if (formula.overTimeAggregation === "first") {
    return yearlyMap[String(years[0])] ?? {
      value: null,
      status: "missing_data",
      reason: "Missing first year value.",
    };
  }
  if (formula.overTimeAggregation === "last") {
    return yearlyMap[String(years[years.length - 1])] ?? {
      value: null,
      status: "missing_data",
      reason: "Missing last year value.",
    };
  }

  const outcomes = years.map((year) => yearlyMap[String(year)]);
  const invalid = outcomes.find((item) => !item || item.status !== "ok" || item.value == null);
  if (invalid) {
    return invalid ?? {
      value: null,
      status: "missing_data",
      reason: "Missing yearly values for aggregation.",
    };
  }
  const valuesOnly = outcomes.map((item) => item?.value ?? 0);
  const sum = valuesOnly.reduce((acc, value) => acc + value, 0);
  if (formula.overTimeAggregation === "sum") {
    return { value: sum, status: "ok" };
  }
  return { value: sum / valuesOnly.length, status: "ok" };
}

function evaluateForCompany(
  formula: SharesFormula,
  company: Company,
  state: SharesFeasibilityState
): CompanyFormulaResult {
  if (formula.mode === "yearly") {
    return {
      mode: formula.mode,
      yearly: evaluateYearlyFormula(formula, company.id, state.years, state.values),
      overTime: null,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    mode: formula.mode,
    yearly: {},
    overTime: evaluateOverTimeFormula(formula, company.id, state.years, state.values),
    updatedAt: new Date().toISOString(),
  };
}

export function applyFormulaToAllCompanies(
  formulaId: string,
  state: SharesFeasibilityState
): SharesFeasibilityState {
  const formula = state.formulas.find((item) => item.id === formulaId);
  if (!formula) return state;

  const formulaResults = state.companies.reduce<Record<string, CompanyFormulaResult>>(
    (acc, company) => {
      acc[company.id] = evaluateForCompany(formula, company, state);
      return acc;
    },
    {}
  );

  return {
    ...state,
    computedResults: {
      ...state.computedResults,
      [formula.id]: formulaResults,
    },
  };
}

export function applyAllFormulas(
  state: SharesFeasibilityState
): SharesFeasibilityState {
  return state.formulas.reduce(
    (acc, formula) => applyFormulaToAllCompanies(formula.id, acc),
    state
  );
}
