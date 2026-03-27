import type { ReactNode } from "react";
import type { CoverLetterData, ResumeData } from "@/lib/resume-builder-storage";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      {children}
    </h2>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
      {children}
    </label>
  );
}

function previewDateRange(startDate: string, endDate: string): string | null {
  const s = startDate.trim();
  const e = endDate.trim();
  if (!s && !e) return null;
  const endLabel = e || "to date";
  return s ? `${s} – ${endLabel}` : endLabel;
}

export function ResumePreview({ resume }: { resume: ResumeData }) {
  return (
    <div
      id="resume-print-root"
      className="mx-auto max-w-[210mm] bg-white p-8 text-zinc-900 shadow-lg print:shadow-none dark:bg-white dark:text-zinc-900"
    >
      <header className="border-b border-zinc-200 pb-4">
        {resume.fullName ? (
          <h1 className="text-2xl font-bold tracking-tight">{resume.fullName}</h1>
        ) : (
          <h1 className="text-2xl font-bold tracking-tight text-zinc-400">
            Your name
          </h1>
        )}
        {resume.headline ? (
          <p className="mt-1 text-sm font-medium text-zinc-600">{resume.headline}</p>
        ) : null}
        {resume.contactHtml ? (
          <div
            className="mt-2 text-sm text-zinc-700 [&_a]:text-blue-700 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: resume.contactHtml }}
          />
        ) : null}
      </header>

      {resume.summaryHtml ? (
        <section className="mt-3">
          <h2 className="mb-1 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Professional summary
          </h2>
          <div
            className="text-sm leading-relaxed text-zinc-800 [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: resume.summaryHtml }}
          />
        </section>
      ) : null}

      {resume.workExperience.some(
        (w) =>
          w.company || w.title || w.descriptionHtml || w.startDate || w.endDate
      ) ? (
        <section className="mt-3">
          <h2 className="mb-1 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Experience
          </h2>
          <ul className="space-y-3">
            {resume.workExperience.map((w) => {
              const dateRange = previewDateRange(w.startDate, w.endDate);
              return (
                <li key={w.id} className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-zinc-900">
                      {w.title}
                      {w.company ? `, ${w.company}` : ""}
                    </span>
                    {dateRange ? (
                      <span className="text-xs text-zinc-500">{dateRange}</span>
                    ) : null}
                  </div>
                  {w.location ? (
                    <div className="text-xs text-zinc-500">{w.location}</div>
                  ) : null}
                  {w.descriptionHtml ? (
                    <div
                      className="mt-2 text-sm leading-relaxed text-zinc-700 [&_ul]:list-disc [&_ul]:pl-5"
                      dangerouslySetInnerHTML={{ __html: w.descriptionHtml }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {resume.education.some(
        (e) =>
          e.institution ||
          e.degree ||
          e.detailsHtml ||
          e.field ||
          e.startDate ||
          e.endDate
      ) ? (
        <section className="mt-3">
          <h2 className="mb-1 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Education
          </h2>
          <ul className="space-y-2">
            {resume.education.map((e) => {
              const dateRange = previewDateRange(e.startDate, e.endDate);
              return (
                <li key={e.id} className="text-sm">
                  <div className="font-semibold text-zinc-900">
                    {[e.degree, e.field].filter(Boolean).join(", ")}
                    {e.institution ? ` — ${e.institution}` : ""}
                  </div>
                  {dateRange ? (
                    <div className="text-xs text-zinc-500">{dateRange}</div>
                  ) : null}
                  {e.detailsHtml ? (
                    <div
                      className="mt-1 text-sm leading-relaxed text-zinc-700 [&_ul]:list-disc [&_ul]:pl-5"
                      dangerouslySetInnerHTML={{ __html: e.detailsHtml }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {resume.skillsHtml ? (
        <section className="mt-3">
          <h2 className="mb-1 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Skills
          </h2>
          <div
            className="text-sm leading-relaxed text-zinc-800 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: resume.skillsHtml }}
          />
        </section>
      ) : null}

      {resume.projectsHtml ? (
        <section className="mt-3">
          <h2 className="mb-1 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Projects
          </h2>
          <div
            className="text-sm leading-relaxed text-zinc-800 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: resume.projectsHtml }}
          />
        </section>
      ) : null}

      {resume.certificationsHtml ? (
        <section className="mt-3">
          <h2 className="mb-1 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Certifications
          </h2>
          <div
            className="text-sm leading-relaxed text-zinc-800 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: resume.certificationsHtml }}
          />
        </section>
      ) : null}

      {resume.additionalHtml ? (
        <section className="mt-3">
          <h2 className="mb-1 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Additional
          </h2>
          <div
            className="text-sm leading-relaxed text-zinc-800 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: resume.additionalHtml }}
          />
        </section>
      ) : null}
    </div>
  );
}

export function CoverLetterPreview({ letter }: { letter: CoverLetterData }) {
  return (
    <div
      id="resume-print-root"
      className="mx-auto max-w-[210mm] bg-white p-8 text-zinc-900 shadow-lg print:shadow-none dark:bg-white dark:text-zinc-900"
    >
      {letter.dateLine ? (
        <p className="mb-6 text-sm text-zinc-700">{letter.dateLine}</p>
      ) : null}
      {letter.recipientHtml ? (
        <div
          className="mb-6 text-sm leading-relaxed [&_p]:mb-1"
          dangerouslySetInnerHTML={{ __html: letter.recipientHtml }}
        />
      ) : null}
      {letter.subject ? (
        <p className="mb-4 text-sm font-semibold">Re: {letter.subject}</p>
      ) : null}
      {letter.bodyHtml ? (
        <div
          className="mb-8 text-sm leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: letter.bodyHtml }}
        />
      ) : null}
      {letter.closingHtml ? (
        <div
          className="text-sm leading-relaxed [&_p]:mb-2"
          dangerouslySetInnerHTML={{ __html: letter.closingHtml }}
        />
      ) : null}
    </div>
  );
}
