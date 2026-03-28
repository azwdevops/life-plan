"use client";

/**
 * Local (frontend-only) dictation for AI posting.
 *
 * 1) **Vosk** — WASM + Web Worker (`vosk-browser`), continuous `getUserMedia` until Stop.
 *    Model: `public/vosk-model-en-small.tar.gz` or `NEXT_PUBLIC_VOSK_MODEL_URL`.
 * 2) **Web Speech API** — if the model is missing, unreachable, times out, or
 *    `NEXT_PUBLIC_DISABLE_VOSK=1`.
 *
 * We probe the model URL (HEAD) before loading so a missing file does not hang `createModel`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { KaldiRecognizer, Model } from "vosk-browser";
import {
  useSpeechDictation,
  type SpeechDictationHandlers,
} from "@/lib/hooks/use-speech-dictation";

const DEFAULT_MODEL_PATH = "/vosk-model-en-small.tar.gz";
const MODEL_LOAD_TIMEOUT_MS = 45_000;

function modelUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_VOSK_MODEL_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return DEFAULT_MODEL_PATH;
}

function voskDisabledByEnv(): boolean {
  const v = process.env.NEXT_PUBLIC_DISABLE_VOSK;
  return v === "1" || v === "true";
}

function hasGetUserMedia(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** Avoid calling createModel when the file is missing (can hang on bad responses). */
async function isVoskModelReachable(): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  const url = modelUrl();
  try {
    let r = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: "GET", cache: "no-store", headers: { Range: "bytes=0-0" } });
    }
    return r.ok;
  } catch {
    return false;
  }
}

function rejectAfter<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, rej) => setTimeout(() => rej(new Error(message)), ms));
}

export function useLocalDictation(handlers: SpeechDictationHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const webSpeech = useSpeechDictation(handlers);

  const [voskOn, setVoskOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const tryVoskRef = useRef(!voskDisabledByEnv());
  const modelPromiseRef = useRef<Promise<Model> | null>(null);
  const modelRef = useRef<Model | null>(null);
  const startBusyRef = useRef(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const recognizerRef = useRef<KaldiRecognizer | null>(null);

  const listening = voskOn || webSpeech.listening;
  const error = localError ?? webSpeech.error;
  const supported = webSpeech.supported || hasGetUserMedia();

  const teardownVoskAudio = useCallback(() => {
    try {
      processorRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    processorRef.current = null;
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sourceRef.current = null;
    try {
      gainRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    gainRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    try {
      recognizerRef.current?.remove();
    } catch {
      /* ignore */
    }
    recognizerRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close();
    }
  }, []);

  const resetVoskModelState = useCallback(() => {
    try {
      modelRef.current?.terminate();
    } catch {
      /* ignore */
    }
    modelRef.current = null;
    modelPromiseRef.current = null;
  }, []);

  const stopVosk = useCallback(() => {
    teardownVoskAudio();
    setVoskOn(false);
  }, [teardownVoskAudio]);

  const ensureModelLoaded = useCallback(async (): Promise<Model> => {
    if (modelRef.current?.ready) return modelRef.current;
    if (!modelPromiseRef.current) {
      const { createModel } = await import("vosk-browser");
      modelPromiseRef.current = createModel(modelUrl())
        .then((m) => {
          modelRef.current = m;
          return m;
        })
        .catch((e) => {
          modelPromiseRef.current = null;
          throw e;
        });
    }
    return modelPromiseRef.current;
  }, []);

  const startVoskWithModel = useCallback(
    async (model: Model) => {
      if (!model.ready) {
        throw new Error("Vosk model is not ready.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: { ideal: 16000 },
        },
        video: false,
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const sampleRate = audioContext.sampleRate;
      const RecognizerCtor = model.KaldiRecognizer;
      const recognizer = new RecognizerCtor(sampleRate);
      recognizerRef.current = recognizer;

      recognizer.on("result", (msg: unknown) => {
        const m = msg as { result?: { text?: string } };
        const text = m?.result?.text?.trim() ?? "";
        if (text) handlersRef.current.onFinal(text);
      });

      recognizer.on("partialresult", (msg: unknown) => {
        const m = msg as { result?: { partial?: string } };
        const partial = m?.result?.partial?.trim() ?? "";
        handlersRef.current.onInterim(partial);
      });

      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        try {
          recognizer.acceptWaveform(event.inputBuffer);
        } catch {
          /* ignore frame errors */
        }
      };

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      gainRef.current = gain;

      source.connect(processor);
      processor.connect(gain);
      gain.connect(audioContext.destination);

      setVoskOn(true);
    },
    []
  );

  const start = useCallback(() => {
    if (listening || starting || startBusyRef.current) return;

    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      !/^localhost$|^127\.0\.0\.1$/i.test(window.location.hostname || "")
    ) {
      setLocalError("Microphone and speech need HTTPS (or localhost).");
      return;
    }

    startBusyRef.current = true;
    setLocalError(null);

    void (async () => {
      try {
        setStarting(true);

        if (tryVoskRef.current) {
          const reachable = await isVoskModelReachable();
          if (!reachable) {
            tryVoskRef.current = false;
          } else {
            try {
              const model = await Promise.race([
                ensureModelLoaded(),
                rejectAfter<Model>(MODEL_LOAD_TIMEOUT_MS, "Vosk model load timed out."),
              ]);
              await startVoskWithModel(model);
              return;
            } catch {
              teardownVoskAudio();
              resetVoskModelState();
              tryVoskRef.current = false;
            }
          }
        }

        webSpeech.start();
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : "Dictation failed to start.");
      } finally {
        startBusyRef.current = false;
        setStarting(false);
      }
    })();
  }, [
    ensureModelLoaded,
    listening,
    resetVoskModelState,
    startVoskWithModel,
    starting,
    teardownVoskAudio,
    webSpeech,
  ]);

  const stop = useCallback(() => {
    stopVosk();
    webSpeech.stop();
    setLocalError(null);
  }, [stopVosk, webSpeech]);

  useEffect(() => {
    return () => {
      stopVosk();
    };
  }, [stopVosk]);

  return {
    listening,
    error,
    start,
    stop,
    supported,
    starting,
  };
}
