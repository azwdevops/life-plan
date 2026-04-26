import type { Account, Company, SharesFormula } from "./types";

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function isCompanyNameUnique(
  companies: Company[],
  candidateName: string,
  excludeCompanyId?: string
): boolean {
  const normalized = normalizeText(candidateName);
  if (!normalized) return false;
  return !companies.some(
    (company) =>
      company.id !== excludeCompanyId && company.normalizedName === normalized
  );
}

export function isFormulaNameUnique(
  formulas: SharesFormula[],
  candidateName: string,
  excludeFormulaId?: string
): boolean {
  const normalized = normalizeText(candidateName);
  if (!normalized) return false;
  return !formulas.some(
    (formula) =>
      formula.id !== excludeFormulaId &&
      normalizeText(formula.name) === normalized
  );
}

export function normalizeAccountLabel(value: string): string {
  return normalizeText(value);
}

export function toAccountVariableAlias(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** One stable @alias per account for formulas (suffix when labels collide). */
export type AccountAliasEntry = {
  accountId: string;
  label: string;
  alias: string;
};

export function buildAccountAliasEntries(accounts: Account[]): AccountAliasEntry[] {
  const used = new Set<string>();
  const entries: AccountAliasEntry[] = [];
  for (const account of accounts) {
    let base = toAccountVariableAlias(account.label);
    if (!base) {
      base = `acct_${account.id.replace(/-/g, "").slice(0, 8)}`;
    }
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${n}`;
      n += 1;
    }
    used.add(candidate);
    entries.push({
      accountId: account.id,
      label: account.label,
      alias: candidate,
    });
  }
  return entries;
}

export function accountAliasToAccountIdMap(
  accounts: Account[]
): Record<string, string> {
  return Object.fromEntries(
    buildAccountAliasEntries(accounts).map((e) => [e.alias, e.accountId])
  );
}

export function isAccountLabelUnique(
  accounts: Account[],
  candidateLabel: string,
  excludeAccountId?: string
): boolean {
  const normalized = normalizeAccountLabel(candidateLabel);
  if (!normalized) return false;
  return !accounts.some(
    (account) =>
      account.id !== excludeAccountId && account.normalizedLabel === normalized
  );
}

export function isYearUnique(years: number[], candidate: number): boolean {
  return Number.isInteger(candidate) && !years.includes(candidate);
}
