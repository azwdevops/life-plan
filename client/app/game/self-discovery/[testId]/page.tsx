"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { generateQuestions, analyze, type GameApiProvider, type GameQuestion } from "@/lib/api/game";
import {
  TESTS,
  loadSession,
  saveSession,
  loadSettings,
  isValidTestId,
} from "../constants";

type Phase = "loading" | "loading_questions" | "quiz" | "submitting" | "results";

export default function SelfDiscoveryTestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params?.testId as string | undefined;
  const { isAuthenticated, isLoading } = useAuth();
  const { isSidebarOpen, toggleSidebar, setIsSidebarOpen } = useSidebar();
  const initialized = useRef(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [api, setApi] = useState<GameApiProvider>("openrouter");
  const [model, setModel] = useState<string>("");

  const testMeta = testId ? TESTS.find((t) => t.id === testId) : null;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!testId || initialized.current || isLoading || !isAuthenticated) return;
    if (!isValidTestId(testId)) {
      router.replace("/game/self-discovery");
      return;
    }

    initialized.current = true;
    const settings = loadSettings();
    const savedApi = settings?.api ?? "openrouter";
    const savedModel = settings?.model ?? "arcee-ai/trinity-large-preview:free";
    setApi(savedApi);
    setModel(savedModel);

    const session = loadSession(testId);

    if (session?.questions?.length) {
      setQuestions(session.questions);
      setAnswers(session.answers ?? []);

      if (session.analysis) {
        setAnalysis(session.analysis);
        setCurrentIndex(session.questions.length);
        setPhase("results");
        return;
      }

      if (session.answers.length >= session.questions.length) {
        setPhase("submitting");
        setCurrentIndex(session.questions.length);
        runAnalyze(
          testId,
          session.questions,
          session.answers,
          savedApi,
          savedModel,
          (analysisText) => {
            setAnalysis(analysisText);
            setPhase("results");
            saveSession(testId, {
              questions: session.questions,
              answers: session.answers,
              analysis: analysisText,
            });
          },
          (err) => {
            setError(err);
            setPhase("quiz");
            setCurrentIndex(session.questions.length - 1);
            setAnswers(session.answers.slice(0, -1));
          }
        );
        return;
      }

      setCurrentIndex(session.answers.length);
      setPhase("quiz");
      return;
    }

    setPhase("loading_questions");
    generateQuestions(testId, savedApi, savedModel)
      .then((res) => {
        setQuestions(res.questions);
        setCurrentIndex(0);
        setSelectedOption(null);
        setPhase("quiz");
        saveSession(testId, { questions: res.questions, answers: [] });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load questions");
        setPhase("loading");
        router.replace("/game/self-discovery");
      });
  }, [testId, isAuthenticated, isLoading, router]);

  function runAnalyze(
    id: string,
    qs: GameQuestion[],
    ans: string[],
    a: GameApiProvider,
    m: string,
    onSuccess: (analysis: string) => void,
    onError: (message: string) => void
  ) {
    analyze(id, qs, ans, a, m)
      .then((res) => onSuccess(res.analysis))
      .catch((e) => onError(e instanceof Error ? e.message : "Failed to get analysis"));
  }

  const handleNext = () => {
    if (selectedOption === null || !testId || currentIndex >= questions.length) return;
    const opt = questions[currentIndex].options.find((o) => o.key === selectedOption);
    const answerText = opt ? opt.text : selectedOption;
    const newAnswers = [...answers, answerText];
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (currentIndex + 1 >= questions.length) {
      setPhase("submitting");
      runAnalyze(testId, questions, newAnswers, api, model, (analysisText) => {
        setAnalysis(analysisText);
        setPhase("results");
        saveSession(testId, { questions, answers: newAnswers, analysis: analysisText });
      }, (err) => {
        setError(err);
        setPhase("quiz");
        setCurrentIndex(questions.length - 1);
        setAnswers(newAnswers.slice(0, -1));
      });
    } else {
      setCurrentIndex((i) => i + 1);
      saveSession(testId, { questions, answers: newAnswers });
    }
  };

  if (!isAuthenticated && !isLoading) return null;
  if (!testId || !testMeta) return null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isLoggedIn={isAuthenticated} />
      <main
        className={`flex-1 transition-all duration-300 ${isSidebarOpen && isAuthenticated ? "lg:ml-64" : "lg:ml-0"}`}
      >
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/game/self-discovery"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to tests
            </Link>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{testMeta.name}</h1>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          {(phase === "loading" || phase === "loading_questions") && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                {phase === "loading_questions" ? "Generating questions…" : "Loading…"}
              </p>
            </div>
          )}

          {phase === "quiz" && questions.length > 0 && (
            <div className="mx-auto max-w-6xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Question {currentIndex + 1} of {questions.length}
              </p>
              <h2 className="mb-6 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {questions[currentIndex].question}
              </h2>
              <ul className="space-y-3">
                {questions[currentIndex].options.map((opt) => (
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
                      <span className="text-zinc-900 dark:text-zinc-100">{opt.text}</span>
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
                  {currentIndex + 1 >= questions.length ? "Submit" : "Next"}
                </button>
              </div>
            </div>
          )}

          {phase === "submitting" && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Generating my analysis…</p>
            </div>
          )}

          {phase === "results" && analysis && (
            <div className="mx-auto max-w-6xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">My Analysis</h2>
              <div className="prose prose-zinc max-w-none dark:prose-invert prose-p:leading-relaxed">
                {analysis.split(/\n\n+/).map((para, i) => (
                  <p key={i} className="text-zinc-700 dark:text-zinc-300">
                    {para}
                  </p>
                ))}
              </div>
              <Link
                href="/game/self-discovery"
                className="mt-8 inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
              >
                Back to tests
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
