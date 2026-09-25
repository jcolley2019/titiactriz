import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Pause, Play, Square } from "lucide-react";
import type { InputKind } from "./useStudioGeneration";
import { useVoiceRecorder } from "./useVoiceRecorder";

/**
 * BLOG.2 — the INPUT column (joeyc.ai InputPanel + YouTubeInput): a Brain Dump
 * she can type or speak, or a YouTube link whose transcript becomes the input.
 */

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

type Props = {
  kind: InputKind;
  onKindChange: (kind: InputKind) => void;
  brainDump: string;
  onBrainDumpChange: (text: string) => void;
  ytUrl: string;
  onYtUrlChange: (url: string) => void;
  transcript: string;
  onTranscript: (text: string) => void;
  extractTranscript: (url: string) => Promise<{ transcript: string } | { error: string }>;
  disabled: boolean;
};

const StudioInput = ({
  kind,
  onKindChange,
  brainDump,
  onBrainDumpChange,
  ytUrl,
  onYtUrlChange,
  transcript,
  onTranscript,
  extractTranscript,
  disabled,
}: Props) => {
  const { t, i18n } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);
  const [fetching, setFetching] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  const latest = useRef(brainDump);
  latest.current = brainDump;
  const recorder = useVoiceRecorder({
    lang: (i18n.language || "es").startsWith("en") ? "en-US" : "es-CO",
    onFinalTranscript: (text) => onBrainDumpChange(latest.current ? `${latest.current} ${text}` : text),
  });

  const startTimer = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };
  const stopTimer = () => window.clearInterval(timerRef.current);
  useEffect(() => () => window.clearInterval(timerRef.current), []);

  const onRecord = () => {
    setSeconds(0);
    recorder.startRecording();
    startTimer();
  };
  const onPauseResume = () => {
    if (recorder.isPaused) {
      recorder.resumeRecording();
      startTimer();
    } else {
      recorder.pauseRecording();
      stopTimer();
    }
  };
  const onStop = () => {
    recorder.stopRecording();
    stopTimer();
    setSeconds(0);
  };

  const newParagraph = useCallback(() => {
    const el = textareaRef.current;
    const pos = el ? el.selectionStart : brainDump.length;
    onBrainDumpChange(`${brainDump.slice(0, pos)}\n\n${brainDump.slice(pos)}`);
    requestAnimationFrame(() => {
      if (!el) return;
      el.selectionStart = el.selectionEnd = pos + 2;
      el.focus();
    });
  }, [brainDump, onBrainDumpChange]);

  const fetchTranscript = async () => {
    if (!ytUrl.trim()) return;
    setFetching(true);
    setYtError(null);
    const res = await extractTranscript(ytUrl.trim());
    setFetching(false);
    if ("transcript" in res) onTranscript(res.transcript);
    else setYtError(res.error);
  };

  const shown = brainDump + (recorder.interimText ? (brainDump ? " " : "") + recorder.interimText : "");

  return (
    <div className="st-column" data-qa="studio-input">
      <div>
        <h3 className="st-section-title">{t("admin.studio.input")}</h3>
        <p className="st-section-desc">{t("admin.studio.inputDesc")}</p>
      </div>

      <div className="st-segment" role="tablist" aria-label={t("admin.studio.input")}>
        {(["brain_dump", "youtube"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            className="st-tab"
            data-qa={`studio-input-${k}`}
            aria-selected={kind === k}
            onClick={() => onKindChange(k)}
          >
            {k === "brain_dump" ? t("admin.studio.tabBrainDump") : t("admin.studio.tabYoutube")}
          </button>
        ))}
      </div>

      {kind === "brain_dump" ? (
        <>
          {recorder.isSupported && (
            <div className="st-recorder" data-live={recorder.isRecording && !recorder.isPaused ? "true" : "false"}>
              {!recorder.isRecording ? (
                <button type="button" className="st-btn" data-qa="studio-record" onClick={onRecord} disabled={disabled}>
                  <Mic className="w-4 h-4" aria-hidden />
                  {t("admin.studio.record")}
                </button>
              ) : (
                <>
                  <button type="button" className="st-btn" onClick={onPauseResume}>
                    {recorder.isPaused ? <Play className="w-4 h-4" aria-hidden /> : <Pause className="w-4 h-4" aria-hidden />}
                    {recorder.isPaused ? t("admin.studio.resume") : t("admin.studio.pause")}
                  </button>
                  <button type="button" className="st-btn st-btn-danger" onClick={onStop}>
                    <Square className="w-4 h-4" aria-hidden />
                    {t("admin.studio.stop")}
                  </button>
                </>
              )}
              <span className="st-caption" role="status">
                {recorder.isRecording
                  ? `${recorder.isPaused ? t("admin.studio.paused") : t("admin.studio.recording")} ${formatTime(seconds)}`
                  : t("admin.studio.recordHint")}
              </span>
              {recorder.isRecording && !recorder.isPaused && <span className="st-live-dot" aria-hidden />}
            </div>
          )}
          {recorder.error && <p className="st-error">{recorder.error}</p>}

          <textarea
            ref={textareaRef}
            className="st-input"
            data-qa="studio-brain-dump"
            value={shown}
            onChange={(e) => {
              // While a phrase is still being heard, only edits before it count.
              if (recorder.interimText) {
                const suffix = (brainDump ? " " : "") + recorder.interimText;
                if (e.target.value.endsWith(suffix)) onBrainDumpChange(e.target.value.slice(0, -suffix.length));
              } else {
                onBrainDumpChange(e.target.value);
              }
            }}
            placeholder={t("admin.studio.placeholder")}
            aria-label={t("admin.studio.tabBrainDump")}
            disabled={disabled}
          />
          <div className="st-inline">
            <span className="st-caption" data-qa="studio-counts">
              {t("admin.studio.counts", { chars: [...brainDump].length, words: words(brainDump) })}
            </span>
            <span className="flex-1" />
            <button type="button" className="st-btn" onClick={newParagraph} disabled={disabled}>
              {t("admin.studio.newParagraph")}
            </button>
            <button
              type="button"
              className="st-btn st-btn-danger"
              data-qa="studio-clear"
              onClick={() => onBrainDumpChange("")}
              disabled={disabled || !brainDump}
            >
              {t("admin.studio.clear")}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="st-field-label" htmlFor="studio-yt-url">
            {t("admin.studio.ytLabel")}
          </label>
          <div className="st-inline">
            <input
              id="studio-yt-url"
              type="url"
              className="st-input"
              data-qa="studio-yt-url"
              value={ytUrl}
              onChange={(e) => onYtUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchTranscript();
              }}
              placeholder="https://youtube.com/watch?v=…"
              disabled={disabled}
            />
            <button
              type="button"
              className="st-btn"
              data-qa="studio-yt-fetch"
              onClick={fetchTranscript}
              disabled={disabled || fetching || !ytUrl.trim()}
            >
              {fetching && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {fetching ? t("admin.studio.ytFetching") : t("admin.studio.ytFetch")}
            </button>
          </div>
          {ytError && (
            <p className="st-error" data-qa="studio-yt-error">
              {t("admin.studio.ytError", { reason: ytError })}
            </p>
          )}
          {transcript && (
            <div>
              <p className="st-caption">{t("admin.studio.ytTranscript", { chars: [...transcript].length })}</p>
              <div className="st-preview" data-qa="studio-transcript">
                {transcript}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudioInput;
