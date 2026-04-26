"use client";

import type {
  Company,
  ComputedResultsMap,
  SharesFormula,
} from "@/lib/shares-feasibility/types";

type ResultsPanelProps = {
  formulas: SharesFormula[];
  companies: Company[];
  years: number[];
  computedResults: ComputedResultsMap;
};

function formatResult(value: number | null): string {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function ResultsPanel({
  formulas,
  companies,
  years,
  computedResults,
}: ResultsPanelProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Formula results
      </h3>
      {formulas.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Create and apply formulas to view computed results.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {formulas.map((formula) => {
            const formulaResults = computedResults[formula.id] ?? {};
            return (
              <div
                key={formula.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {formula.name}
                  </h4>
                  <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {formula.mode === "yearly" ? "Yearly" : "Over time"}
                  </span>
                </div>
                {companies.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Add companies to compute results.
                  </p>
                ) : formula.mode === "yearly" ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[620px] border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left dark:border-zinc-700 dark:bg-zinc-800">
                            Company
                          </th>
                          {years.map((year) => (
                            <th
                              key={`${formula.id}-${year}`}
                              className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-right dark:border-zinc-700 dark:bg-zinc-800"
                            >
                              {year}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((company) => (
                          <tr key={company.id}>
                            <td className="border border-zinc-300 px-3 py-2 font-medium dark:border-zinc-700">
                              {company.name}
                            </td>
                            {years.map((year) => {
                              const yearly =
                                formulaResults[company.id]?.yearly[String(year)];
                              return (
                                <td
                                  key={`${formula.id}-${company.id}-${year}`}
                                  className="border border-zinc-300 px-3 py-2 text-right dark:border-zinc-700"
                                  title={yearly?.reason}
                                >
                                  {formatResult(yearly?.value ?? null)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {companies.map((company) => {
                      const outcome = formulaResults[company.id]?.overTime;
                      return (
                        <li
                          key={`${formula.id}-${company.id}`}
                          className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                          title={outcome?.reason}
                        >
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                            {company.name}
                          </span>
                          <span className="font-mono text-zinc-900 dark:text-zinc-100">
                            {formatResult(outcome?.value ?? null)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
