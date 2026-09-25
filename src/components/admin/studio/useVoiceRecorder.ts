import { useCallback, useEffect, useRef, useState } from "react";

/**
 * BLOG.2 — Record for the Brain Dump, ported from joeyc.ai's useVoiceRecorder.
 * Web Speech API only: where the browser has no SpeechRecognition (Firefox,
 * some iPad browsers), `isSupported` is false and the Studio hides Record
 * instead of offering a button that cannot work.
 *
 * Changed from the source: the recognition language is a parameter (es-CO for
 * the Spanish admin, en-US for the English one) instead of a fixed en-US.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function useVoiceRecorder({ lang, onFinalTranscript }: { lang: string; onFinalTranscript: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const processedIndexRef = useRef(0);
  const isPausedRef = useRef(false);
  const isRecordingRef = useRef(false);

  const isSupported = recognitionCtor() !== null;

  const createRecognition = useCallback(() => {
    const Ctor = recognitionCtor()!;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let newFinal = "";
      let interim = "";
      for (let i = processedIndexRef.current; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinal += result[0].transcript;
          processedIndexRef.current = i + 1;
        } else {
          interim += result[0].transcript;
        }
      }
      if (newFinal) onFinalRef.current(newFinal.trim());
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(event.error);
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsPaused(false);
    };

    recognition.onend = () => {
      // The browser stops on its own after a silence; keep going while recording.
      if (recognitionRef.current && !isPausedRef.current && isRecordingRef.current) {
        try {
          processedIndexRef.current = 0;
          recognition.start();
        } catch {
          /* already started */
        }
        return;
      }
      setInterimText("");
    };
    return recognition;
  }, [lang]);

  const startRecording = useCallback(() => {
    if (!isSupported) return;
    setError(null);
    processedIndexRef.current = 0;
    const recognition = createRecognition();
    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    isPausedRef.current = false;
    setIsRecording(true);
    setIsPaused(false);
    try {
      recognition.start();
    } catch {
      setError("start");
    }
  }, [isSupported, createRecognition]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    setInterimText("");
    processedIndexRef.current = 0;
  }, []);

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    recognitionRef.current?.stop();
    setInterimText("");
  }, []);

  const resumeRecording = useCallback(() => {
    if (!isSupported) return;
    setError(null);
    processedIndexRef.current = 0;
    isPausedRef.current = false;
    setIsPaused(false);
    const recognition = createRecognition();
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError("resume");
    }
  }, [isSupported, createRecognition]);

  // Leaving the Studio stops the microphone.
  useEffect(
    () => () => {
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
    },
    [],
  );

  return { isRecording, isPaused, interimText, error, isSupported, startRecording, stopRecording, pauseRecording, resumeRecording };
}
