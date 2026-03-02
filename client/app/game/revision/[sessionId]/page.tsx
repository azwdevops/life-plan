"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { analyzeRevision } from "@/lib/api/revision";
import type { RevisionQuestion } from "@/lib/api/revision";
import {
  loadRevisionSession,
  saveRevisionSession,
  REVISION_CATEGORIES,
  PROGRAMMING_LANGUAGES,
} from "../constants";

type Phase = "loading" | "quiz" | "submitting" | "results";

export default function RevisionSessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, toggleSidebar, setIsSidebarOpen } = useSidebar();
  const isAdmin = user?.groups?.includes("admin");
  const initialized = useRef(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<ReturnType<typeof loadRevisionSession>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) router.push("/dashboard");
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/game/revision");
      return;
    }
    if (initialized.current) return;
    initialized.current = true;

    const data = loadRevisionSession(sessionId);
    if (!data) {
      router.replace("/game/revision");
      return;
    }

    setSession(data);
    setCurrentIndex(data.answers.length);

    if (data.analysis) {
      setPhase("results");
      return;
    }

    if (data.answers.length >= data.questions.length) {
      setPhase("submitting");
      runAnalyze(data, (analysisText) => {
        const updated = { ...data, analysis: analysisText };
        saveRevisionSession(updated);
        setSession(updated);
        setPhase("results");
      }, (err) => {
        setError(err);
        setPhase("quiz");
        setCurrentIndex(data.questions.length - 1);
      });
      return;
    }

    setPhase("quiz");
  }, [sessionId, router]);

  function runAnalyze(
    data: NonNullable<typeof session>,
    onSuccess: (analysis: string) => void,
    onError: (message: string) => void
  ) {
    analyzeRevision(
      data.category,
      data.programmingLanguage,
      data.questions,
      data.answers,
      data.api,
      data.model
    )
      .then((res) => onSuccess(res.analysis))
      .catch((e) => onError(e instanceof Error ? e.message : "Failed to get analysis"));
  }

  const handleNext = () => {
    if (!session || selectedOption === null || currentIndex >= session.questions.length) return;
    const opt = session.questions[currentIndex].options.find((o) => o.key === selectedOption);
    const answerText = opt ? opt.text : selectedOption;
    const newAnswers = [...session.answers, answerText];
    const updated = { ...session, answers: newAnswers };
    saveRevisionSession(updated);
    setSession(updated);
    setSelectedOption(null);

    if (currentIndex + 1 >= session.questions.length) {
      setPhase("submitting");
      runAnalyze(updated, (analysisText) => {
        const withAnalysis = { ...updated, analysis: analysisText };
        saveRevisionSession(withAnalysis);
        setSession(withAnalysis);
        setPhase("results");
      }, (err) => {
        setError(err);
        setPhase("quiz");
        setCurrentIndex(session.questions.length - 1);
        setSession(updated);
      });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (!sessionId || !session) return null;
  if (!isLoading && isAuthenticated && !isAdmin) return null;

  const categoryLabel = REVISION_CATEGORIES.find((c) => c.value === session.category)?.label ?? session.category;
  const languageLabel = PROGRAMMING_LANGUAGES.find((l) => l.value === session.programmingLanguage)?.label ?? session.programmingLanguage;
  const currentQuestion: RevisionQuestion | undefined = session.questions[currentIndex];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      {isAuthenticated && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isLoggedIn={isAuthenticated}
        />
      )}
      <main
        className={`flex-1 transition-all duration-300 ${isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"}`}
      >
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/game/revision"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to revision kits
            </Link>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {categoryLabel} · {languageLabel}
            </h1>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
            </div>
          )}

          {phase === "quiz" && currentQuestion && (
            <div className="mx-auto max-w-6xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Question {currentIndex + 1} of {session.questions.length}
              </p>
              <h2 className="mb-6 text-lg font-medium text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                {currentQuestion.question}
              </h2>
              <ul className="space-y-3">
                {currentQuestion.options.map((opt) => (
                  <li key={opt.key}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-4 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:border-zinc-700 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-950/30">
                      <input
                        type="radio"
                        name="option"
                        value={opt.key}
                        checked={selectedOption === opt.key}
                        onChange={() => setSelectedOption(opt.key)}
                        className="mt-1 h-4 w-4 border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                      />
                      <span className="text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">{opt.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={selectedOption === null}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                >
                  {currentIndex + 1 >= session.questions.length ? "Submit" : "Next"}
                </button>
              </div>
            </div>
          )}

          {phase === "submitting" && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Analyzing your answers…</p>
            </div>
          )}

          {phase === "results" && session.analysis && (
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  You completed all {session.questions.length} questions.
                </p>
                <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Areas to work on
                </h2>
                <div className="prose prose-zinc max-w-none dark:prose-invert prose-p:leading-relaxed">
                  {session.analysis.split(/\n\n+/).map((para, i) => (
                    <p key={i} className="text-zinc-700 dark:text-zinc-300">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
              <Link
                href="/game/revision"
                className="inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
              >
                Back to revision kits
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
