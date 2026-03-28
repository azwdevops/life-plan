"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export type SpeechDictationHandlers = {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
};

/** Delay before restarting recognition; avoids InvalidStateError after onend (Chrome). */
const RESTART_MS = 120;

export function useSpeechDictation(handlers: SpeechDictationHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True from user Start until user Stop — browser onend alone must not turn dictation off. */
  const sessionActiveRef = useRef(false);

  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current != null) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const startOneSegment = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !sessionActiveRef.current) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      const finals: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finals.push(r[0].transcript);
        else interim += r[0].transcript;
      }
      if (finals.length) {
        const t = finals.join("").trim();
        if (t) handlersRef.current.onFinal(t);
      }
      handlersRef.current.onInterim(interim.trim());
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "aborted") return;
      if (e.error === "not-allowed") {
        clearRestartTimeout();
        sessionActiveRef.current = false;
        setListening(false);
        handlersRef.current.onInterim("");
        setError("Microphone permission denied. Allow the mic to use voice input.");
        return;
      }
      if (e.error === "no-speech") {
        return;
      }
      setError(e.message || e.error || "Speech recognition error.");
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!sessionActiveRef.current) {
        setListening(false);
        handlersRef.current.onInterim("");
        return;
      }
      clearRestartTimeout();
      restartTimeoutRef.current = setTimeout(() => {
        restartTimeoutRef.current = null;
        if (sessionActiveRef.current) {
          startOneSegment();
        }
      }, RESTART_MS);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      sessionActiveRef.current = false;
      setListening(false);
      handlersRef.current.onInterim("");
      setError("Could not start the microphone.");
    }
  }, [clearRestartTimeout]);

  const stop = useCallback(() => {
    clearRestartTimeout();
    sessionActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, [clearRestartTimeout]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (sessionActiveRef.current) return;
    setError(null);
    sessionActiveRef.current = true;
    setListening(true);
    startOneSegment();
  }, [startOneSegment]);

  useEffect(() => {
    return () => {
      clearRestartTimeout();
      sessionActiveRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, [clearRestartTimeout]);

  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  return {
    listening,
    error,
    start,
    stop,
    supported,
  };
}
