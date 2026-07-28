"use client";

import { useCallback, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { DropdownMenu } from "@/components/DropdownMenu";
import { TiptapRichTextEditor } from "@/components/editor/TiptapRichTextEditor";
import {
  getSelfDiscoveryAssessment,
  updateSelfDiscoveryAssessment,
  type SelfDiscoveryAssessmentCard,
  type SelfDiscoveryAssessmentDetail,
  type SelfDiscoveryAssessmentListKind,
} from "@/lib/api/self-discovery-assessments";

function isBlankRichText(html: string): boolean {
  return !html.replace(/<[^>]+>/g, "").trim();
}

type Props = {
  token: string;
  assessments: SelfDiscoveryAssessmentCard[];
  onSaved?: () => void;
  kind?: SelfDiscoveryAssessmentListKind;
  sectionTitle?: string;
  sectionDescription?: string;
  hasSavedByTestId?: Record<string, boolean>;
  generatingTestId?: string | null;
  credentialsReady?: boolean;
  onContinue?: (testId: string) => void;
  onGenerateQuestions?: (testId: string) => void;
};

export function SelfDiscoveryAssessmentsEditor({
  token,
  assessments,
  onSaved,
  kind = "self_discovery",
  sectionTitle,
  sectionDescription,
  hasSavedByTestId,
  generatingTestId,
  credentialsReady = true,
  onContinue,
  onGenerateQuestions,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [questionsHtml, setQuestionsHtml] = useState("");
  const [analysisHtml, setAnalysisHtml] = useState("");
  const [llmRequestBodyTemplate, setLlmRequestBodyTemplate] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const heading = sectionTitle ?? "Tests";
  const blurb = sectionDescription ?? null;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleAssessments = normalizedSearch
    ? assessments.filter((a) =>
        `${a.title} ${a.tagline}`.toLowerCase().includes(normalizedSearch)
      )
    : assessments;
  const showRequestTemplate = kind === "self_discovery" || kind === "ai_schedule";

  const questionsLabel =
    kind === "ai_schedule" ? "Day-plan instructions" : "Question-generation prompt";
  const questionsHint =
    kind === "ai_schedule"
      ? "Prepended before the live time window, your activities, and the required JSON shape."
      : "Instructions for generating the 8 multiple-choice questions. JSON format rules are appended on the server.";

  const analysisLabel = kind === "ai_schedule" ? "System message (optional)" : "Analysis prompt";
  const analysisHint =
    kind === "ai_schedule"
      ? "Leave empty to use the default (JSON-only, task blocks). When set, replaces that system message."
      : "System instructions for the post-quiz written analysis. Output-format rules are appended on the server.";

  const close = () => {
    setEditingId(null);
    setError(null);
    setLoading(false);
    setSaving(false);
    setLlmRequestBodyTemplate("");
  };

  const openEdit = useCallback(
    async (testId: string) => {
      setEditingId(testId);
      setError(null);
      setLoading(true);
      try {
        const d: SelfDiscoveryAssessmentDetail = await getSelfDiscoveryAssessment(token, testId);
        setTitle(d.title);
        setTagline(d.tagline);
        setQuestionsHtml(d.questions_instruction_html);
        setAnalysisHtml(d.analysis_instruction_html);
        setLlmRequestBodyTemplate(d.llm_request_body_template ?? "");
        setSortOrder(d.sort_order);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load assessment");
        setEditingId(null);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const handleSave = async () => {
    if (!editingId) return;
    const t = title.trim();
    const tg = tagline.trim();
    if (!t || !tg || !questionsHtml.trim()) return;
    const analysisOut =
      kind === "ai_schedule" && isBlankRichText(analysisHtml) ? "<p></p>" : analysisHtml;
    if (kind === "self_discovery" && !analysisOut.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await updateSelfDiscoveryAssessment(token, editingId, {
        title: t,
        tagline: tg,
        questions_instruction_html: questionsHtml,
        analysis_instruction_html: analysisOut,
        sort_order: sortOrder,
        ...(showRequestTemplate ? { llm_request_body_template: llmRequestBodyTemplate.trim() } : {}),
      });
      onSaved?.();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled =
    saving ||
    !title.trim() ||
    !tagline.trim() ||
    !questionsHtml.trim() ||
    (kind === "self_discovery" && !analysisHtml.trim());

  return (
    <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="shrink-0 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{heading}</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tests by title or description…"
          className="w-full flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
      {blurb ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{blurb}</p> : null}
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleAssessments.map((a) => (
          <div
            key={a.test_id}
            className="flex min-h-[180px] flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{a.title}</h3>
              </div>
              <DropdownMenu
                items={[
                  {
                    label: "Edit",
                    onClick: () => void openEdit(a.test_id),
                  },
                ]}
                menuButtonAriaLabel={`Actions for ${a.title}`}
              />
            </div>
            <div className="mt-2">
              <p className="text-justify text-sm text-zinc-600 dark:text-zinc-400">{a.tagline}</p>
            </div>
            {onGenerateQuestions ? (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {hasSavedByTestId?.[a.test_id] && onContinue ? (
                  <button
                    type="button"
                    onClick={() => onContinue(a.test_id)}
                    disabled={generatingTestId === a.test_id || !credentialsReady}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
                  >
                    Continue
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onGenerateQuestions(a.test_id)}
                  disabled={generatingTestId === a.test_id || !credentialsReady}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                >
                  {generatingTestId === a.test_id
                    ? "Generating…"
                    : hasSavedByTestId?.[a.test_id]
                      ? "Generate new questions"
                      : "Generate questions"}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">{a.test_id}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog
        isOpen={editingId != null}
        onClose={() => {
          if (!saving && !loading) close();
        }}
        title={editingId ? `Edit: ${title || editingId}` : "Edit assessment"}
        size="xl"
      >
        {editingId && loading ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading assessment…</p>
        ) : null}
        {editingId && !loading ? (
          <div className="max-h-[min(85vh,40rem)] space-y-4 overflow-y-auto pr-1">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Tagline</span>
              <textarea
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                rows={2}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{questionsLabel}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{questionsHint}</span>
              <TiptapRichTextEditor
                value={questionsHtml}
                onChange={setQuestionsHtml}
                minHeight="12rem"
                aria-label={questionsLabel}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{analysisLabel}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{analysisHint}</span>
              <TiptapRichTextEditor
                value={analysisHtml}
                onChange={setAnalysisHtml}
                minHeight="10rem"
                aria-label={analysisLabel}
              />
            </label>
            {showRequestTemplate ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">LLM request body template (optional)</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Enter the <strong>JSON</strong> body for OpenRouter <code className="font-mono">POST /api/v1/chat/completions</code> (not
                  Python). Use <code className="font-mono">{`{{ variable_name }}`}</code> placeholders; values are filled server-side. Examples:{" "}
                  <code className="font-mono">{`{{ model_name }}`}</code>, <code className="font-mono">{`{{ messages }}`}</code>,{" "}
                  <code className="font-mono">{`{{ max_tokens }}`}</code>, <code className="font-mono">{`{{ prompt_content }}`}</code> (user message
                  text), <code className="font-mono">system_message</code>. Empty = server default (
                  <code className="font-mono">model</code> + <code className="font-mono">messages</code> + <code className="font-mono">max_tokens</code>
                  ).
                </span>
                <textarea
                  value={llmRequestBodyTemplate}
                  onChange={(e) => setLlmRequestBodyTemplate(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  aria-label="LLM request body template"
                />
              </label>
            ) : null}
            <label className="flex max-w-xs flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Sort order</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <button
                type="button"
                disabled={saving}
                onClick={close}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveDisabled}
                onClick={() => void handleSave()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
