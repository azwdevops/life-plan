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

export function useSpeechDictation(handlers: SpeechDictationHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);

  const stop = useCallback(() => {
    listeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (listeningRef.current) return;
    setError(null);

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
      if (e.error === "aborted" || e.error === "no-speech") return;
      if (e.error === "not-allowed") {
        setError("Microphone permission denied. Allow the mic to use voice input.");
        return;
      }
      setError(e.message || e.error || "Speech recognition error.");
    };

    rec.onend = () => {
      listeningRef.current = false;
      setListening(false);
      handlersRef.current.onInterim("");
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setError("Could not start the microphone.");
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

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
