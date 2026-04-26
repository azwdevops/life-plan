export type FormulaMode = "yearly" | "over_time";
export type FormulaOperator = "+" | "-" | "*" | "/";
export type OverTimeAggregation = "sum" | "avg" | "first" | "last";
export type ComputationStatus =
  | "ok"
  | "missing_data"
  | "division_by_zero"
  | "invalid_formula";

export type Company = {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
};

export type Account = {
  id: string;
  label: string;
  normalizedLabel: string;
};

export type FormulaVariable = {
  id: string;
  name: string;
  normalizedName: string;
  accountId: string;
};

export type ExpressionNode =
  | {
      type: "constant";
      value: number;
    }
  | {
      type: "account";
      accountId: string;
    }
  | {
      type: "operation";
      operator: FormulaOperator;
      left: ExpressionNode;
      right: ExpressionNode;
    };

export type SharesFormula = {
  id: string;
  name: string;
  mode: FormulaMode;
  expression: string;
  overTimeAggregation: OverTimeAggregation;
  expressionTree: ExpressionNode;
  createdAt: string;
  updatedAt: string;
};

export type YearlyComputation = {
  value: number | null;
  status: ComputationStatus;
  reason?: string;
};

export type CompanyFormulaResult = {
  mode: FormulaMode;
  yearly: Record<string, YearlyComputation>;
  overTime: YearlyComputation | null;
  updatedAt: string;
};

export type ComputedResultsMap = Record<
  string,
  Record<string, CompanyFormulaResult>
>;

export type ValuesMap = Record<
  string,
  Record<string, Record<string, number | undefined>>
>;

export type SharesFeasibilityState = {
  companies: Company[];
  accounts: Account[];
  variables: FormulaVariable[];
  years: number[];
  values: ValuesMap;
  formulas: SharesFormula[];
  computedResults: ComputedResultsMap;
};
