"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import type { ResponseType } from "@/types";
import { compressImage } from "@/lib/compress-image";
import { MonitoredTextarea } from "./MonitoredTextarea";
import type { IntegrityMetadata } from "./MonitoredTextarea";
import { DecisionMatrix } from "./DecisionMatrix";
import { PMIFramework } from "./PMIFramework";
import { PairwiseComparison } from "./PairwiseComparison";
import { TradeOffSliders } from "./TradeOffSliders";
import { ScamperTool } from "@/components/toolkit/ScamperTool";

// Dynamic imports for toolkit tools (to avoid loading all at once)
const SixHatsTool = dynamic(() => import("@/components/toolkit/SixHatsTool").then(m => ({ default: m.SixHatsTool })), { ssr: false });
const PmiChartTool = dynamic(() => import("@/components/toolkit/PmiChartTool").then(m => ({ default: m.PmiChartTool })), { ssr: false });
const FiveWhysTool = dynamic(() => import("@/components/toolkit/FiveWhysTool").then(m => ({ default: m.FiveWhysTool })), { ssr: false });
const EmpathyMapTool = dynamic(() => import("@/components/toolkit/EmpathyMapTool").then(m => ({ default: m.EmpathyMapTool })), { ssr: false });
const DecisionMatrixToolComponent = dynamic(() => import("@/components/toolkit/DecisionMatrixTool").then(m => ({ default: m.DecisionMatrixTool })), { ssr: false });
const HowMightWeTool = dynamic(() => import("@/components/toolkit/HowMightWeTool").then(m => ({ default: m.HowMightWeTool })), { ssr: false });
const ReverseBrainstormToolComponent = dynamic(() => import("@/components/toolkit/ReverseBrainstormTool").then(m => ({ default: m.ReverseBrainstormTool })), { ssr: false });
const SwotAnalysisToolComponent = dynamic(() => import("@/components/toolkit/SwotAnalysisTool").then(m => ({ default: m.SwotAnalysisTool })), { ssr: false });
const StakeholderMapToolComponent = dynamic(() => import("@/components/toolkit/StakeholderMapTool").then(m => ({ default: m.StakeholderMapTool })), { ssr: false });
const LotusDiagramToolComponent = dynamic(() => import("@/components/toolkit/LotusDiagramTool").then(m => ({ default: m.LotusDiagramTool })), { ssr: false });
const AffinityDiagramToolComponent = dynamic(() => import("@/components/toolkit/AffinityDiagramTool").then(m => ({ default: m.AffinityDiagramTool })), { ssr: false });
const MorphologicalChartToolComponent = dynamic(() => import("@/components/toolkit/MorphologicalChartTool").then(m => ({ default: m.MorphologicalChartTool })), { ssr: false });

interface ResponseInputProps {
  sectionIndex: number;
  responseType: ResponseType;
  value: string;
  onChange: (value: string) => void;
  sentenceStarters?: string[];
  placeholder?: string;
  unitId?: string;
  pageId?: string;
  allowedTypes?: ("text" | "upload" | "voice" | "link")[];
  toolId?: string;
  toolChallenge?: string;
  /** Enable integrity monitoring on text input (for academic integrity tracking) */
  enableIntegrityMonitoring?: boolean;
  /** Callback to receive integrity metadata from MonitoredTextarea */
  onIntegrityUpdate?: (metadata: IntegrityMetadata) => void;
}

export function ResponseInput({
  sectionIndex,
  responseType,
  value,
  onChange,
  sentenceStarters,
  placeholder = "Type your response here...",
  unitId,
  pageId,
  allowedTypes,
  toolId,
  toolChallenge,
  enableIntegrityMonitoring = false,
  onIntegrityUpdate,
}: ResponseInputProps) {
  const allTypeOptions: { type: ResponseType; label: string; icon: string }[] = [
    { type: "text", label: "Text", icon: "✏️" },
    { type: "upload", label: "Upload", icon: "📎" },
    { type: "voice", label: "Voice", icon: "🎤" },
    { type: "link", label: "Link", icon: "🔗" },
  ];

  // Filter type options based on allowed types
  const typeOptions = allowedTypes
    ? allTypeOptions.filter((opt) =>
        allowedTypes.includes(opt.type as "text" | "upload" | "voice" | "link")
      )
    : allTypeOptions;

  const [activeType, setActiveType] = useState<ResponseType>(
    responseType === "multi"
      ? typeOptions.length > 0
        ? (typeOptions[0].type as ResponseType)
        : "text"
      : responseType
  );

  return (
    <div className="space-y-2">
      {/* Response type selector for multi */}
      {responseType === "multi" && typeOptions.length > 1 && (
        <div className="flex gap-1">
          {typeOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setActiveType(opt.type)}
              className={`px-3 py-1 text-xs rounded-full transition ${
                activeType === opt.type
                  ? "bg-accent-blue text-white"
                  : "bg-surface-alt text-text-secondary hover:bg-gray-200"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Sentence starters */}
      {sentenceStarters && sentenceStarters.length > 0 && activeType === "text" && (
        <div className="flex flex-wrap gap-1.5">
          {sentenceStarters.map((starter, i) => (
            <button
              key={i}
              onClick={() => {
                if (!value.includes(starter)) {
                  onChange(value ? `${value}\n${starter}` : starter);
                }
              }}
              className="px-2.5 py-1 text-xs bg-accent-blue/10 text-accent-blue rounded-full hover:bg-accent-blue/20 transition"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {/* Text input — uses MonitoredTextarea when integrity monitoring is enabled */}
      {(activeType === "text" || (responseType === "text" && (responseType as string) !== "multi")) && (
        enableIntegrityMonitoring ? (
          <MonitoredTextarea
            id={`response-${sectionIndex}`}
            value={value}
            onChange={onChange}
            onIntegrityUpdate={onIntegrityUpdate}
            placeholder={placeholder}
            rows={4}
          />
        ) : (
          <textarea
            id={`response-${sectionIndex}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-y text-sm"
          />
        )
      )}

      {/* Upload */}
      {activeType === "upload" && (
        <UploadInput
          value={value}
          onChange={onChange}
          unitId={unitId}
          pageId={pageId}
          sectionIndex={sectionIndex}
        />
      )}

      {/* Voice */}
      {activeType === "voice" && (
        <VoiceInput
          value={value}
          onChange={onChange}
          unitId={unitId}
          pageId={pageId}
          sectionIndex={sectionIndex}
        />
      )}

      {/* Link */}
      {activeType === "link" && (
        <LinkInput value={value} onChange={onChange} />
      )}

      {/* Decision Matrix */}
      {activeType === "decision-matrix" && (
        <DecisionMatrix value={value} onChange={onChange} />
      )}

      {/* PMI Framework */}
      {activeType === "pmi" && (
        <PMIFramework value={value} onChange={onChange} />
      )}

      {/* Pairwise Comparison */}
      {activeType === "pairwise" && (
        <PairwiseComparison value={value} onChange={onChange} />
      )}

      {/* Trade-Off Sliders */}
      {activeType === "trade-off-sliders" && (
        <TradeOffSliders value={value} onChange={onChange} />
      )}

      {/* Toolkit Tools */}
      {responseType === "toolkit-tool" && toolId === "scamper" && (
        <ScamperTool
          toolId={toolId}
          mode="embedded"
          challenge={toolChallenge}
          onSave={(state) => {
            onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
          }}
          onComplete={(data) => {
            onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
          }}
        />
      )}

      {responseType === "toolkit-tool" && toolId === "six-thinking-hats" && (
        <Suspense fallback={<div>Loading...</div>}>
          <SixHatsTool
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "pmi-chart" && (
        <Suspense fallback={<div>Loading...</div>}>
          <PmiChartTool
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "five-whys" && (
        <Suspense fallback={<div>Loading...</div>}>
          <FiveWhysTool
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "empathy-map" && (
        <Suspense fallback={<div>Loading...</div>}>
          <EmpathyMapTool
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "decision-matrix" && (
        <Suspense fallback={<div>Loading...</div>}>
          <DecisionMatrixToolComponent
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "how-might-we" && (
        <Suspense fallback={<div>Loading...</div>}>
          <HowMightWeTool
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "reverse-brainstorm" && (
        <Suspense fallback={<div>Loading...</div>}>
          <ReverseBrainstormToolComponent
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "swot-analysis" && (
        <Suspense fallback={<div>Loading...</div>}>
          <SwotAnalysisToolComponent
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "stakeholder-map" && (
        <Suspense fallback={<div>Loading...</div>}>
          <StakeholderMapToolComponent
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "lotus-diagram" && (
        <Suspense fallback={<div>Loading...</div>}>
          <LotusDiagramToolComponent
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "affinity-diagram" && (
        <Suspense fallback={<div>Loading...</div>}>
          <AffinityDiagramToolComponent
            toolId={toolId}
            mode="embedded"
            challenge={toolChallenge}
            onSave={(state) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
            }}
            onComplete={(data) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}

      {responseType === "toolkit-tool" && toolId === "morphological-chart" && (
        <Suspense fallback={<div>Loading...</div>}>
          <MorphologicalChartToolComponent
            mode="embedded"
            challenge={toolChallenge}
            onComplete={(data: any) => {
              onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

// ========================================
// Upload Input
// ========================================
function UploadInput({
  value,
  onChange,
  unitId,
  pageId,
  sectionIndex,
}: {
  value: string;
  onChange: (v: string) => void;
  unitId?: string;
  pageId?: string;
  sectionIndex: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parse existing value as JSON if it contains upload data
  const uploadData = value && value.startsWith("{") ? (() => {
    try { return JSON.parse(value); } catch { return null; }
  })() : null;

  async function handleFile(file: File) {
    if (!unitId || !pageId) return;
    setUploading(true);

    // Compress images before upload (5-8MB → ~400KB)
    const processedFile = await compressImage(file);

    const formData = new FormData();
    formData.append("file", processedFile);
    formData.append("unitId", unitId);
    formData.append("pageId", pageId);

    try {
      const res = await fetch("/api/student/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        onChange(JSON.stringify({
          type: "upload",
          url: data.url,
          filename: data.filename || file.name,
          size: data.size || file.size,
          mimeType: data.type || file.type,
        }));
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      {uploadData ? (
        <div className="border border-border rounded-lg p-4 flex items-center gap-3">
          {uploadData.mimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadData.url}
              alt={uploadData.filename}
              className="w-20 h-20 object-cover rounded"
            />
          ) : (
            <div className="w-12 h-12 bg-surface-alt rounded flex items-center justify-center text-xl">
              📄
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {uploadData.filename}
            </p>
            <p className="text-xs text-text-secondary">
              {(uploadData.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={() => onChange("")}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
            dragActive
              ? "border-accent-blue bg-accent-blue/5"
              : "border-border hover:border-accent-blue/50"
          }`}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-secondary text-sm">Uploading...</p>
            </div>
          ) : (
            <>
              <p className="text-2xl mb-2">📎</p>
              <p className="text-text-secondary text-sm">
                Drag and drop a file here, or click to browse
              </p>
              <p className="text-text-secondary/60 text-xs mt-1">
                Images, PDFs, documents (max 10MB)
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            id={`upload-${sectionIndex}`}
            accept="image/*,.pdf,.doc,.docx,audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ========================================
// Voice Input
// ========================================
function VoiceInput({
  value,
  onChange,
  unitId,
  pageId,
  sectionIndex,
}: {
  value: string;
  onChange: (v: string) => void;
  unitId?: string;
  pageId?: string;
  sectionIndex: number;
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const voiceData = value && value.startsWith("{") ? (() => {
    try { return JSON.parse(value); } catch { return null; }
  })() : null;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAudio(blob);
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      alert("Could not access microphone. Please check your permissions.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function uploadAudio(blob: Blob) {
    if (!unitId || !pageId) return;
    setUploading(true);

    const file = new File([blob], `voice_${sectionIndex}.webm`, {
      type: "audio/webm",
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("unitId", unitId);
    formData.append("pageId", pageId);

    try {
      const res = await fetch("/api/student/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        onChange(JSON.stringify({
          type: "voice",
          url: data.url,
          duration: duration,
          filename: data.filename,
        }));
      }
    } catch (err) {
      console.error("Voice upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="border border-border rounded-lg p-6">
      {voiceData ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center">
              🎤
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                Voice Recording
              </p>
              <p className="text-xs text-text-secondary">
                {voiceData.duration ? formatTime(voiceData.duration) : "Recorded"}
              </p>
            </div>
            <button
              onClick={() => onChange("")}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={voiceData.url} controls className="w-full h-10" />
        </div>
      ) : recording ? (
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-full bg-red-500 animate-pulse flex items-center justify-center">
              <span className="text-white text-2xl">🎤</span>
            </div>
          </div>
          <p className="text-lg font-mono font-bold text-red-500">
            {formatTime(duration)}
          </p>
          <p className="text-text-secondary text-xs">Recording...</p>
          <button
            onClick={stopRecording}
            className="px-6 py-2.5 bg-red-500 text-white rounded-full text-sm font-medium hover:bg-red-600 transition"
          >
            ■ Stop Recording
          </button>
        </div>
      ) : uploading ? (
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">Saving recording...</p>
        </div>
      ) : (
        <div className="text-center space-y-2">
          <button
            onClick={startRecording}
            className="px-6 py-3 bg-red-500 text-white rounded-full text-sm font-medium hover:bg-red-600 transition"
          >
            🎤 Start Recording
          </button>
          <p className="text-text-secondary text-xs">
            Click to record your voice response (max 5 minutes)
          </p>
        </div>
      )}
    </div>
  );
}

// ========================================
// Link Input
// ========================================
function LinkInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const linkData = value && value.startsWith("{") ? (() => {
    try {
      const parsed = JSON.parse(value);
      return parsed.type === "link" ? parsed : null;
    } catch { return null; }
  })() : null;

  const [url, setUrl] = useState(linkData?.url || "");
  const [title, setTitle] = useState(linkData?.title || "");
  const [error, setError] = useState("");

  function isValidUrl(str: string): boolean {
    try {
      new URL(str.startsWith("http") ? str : `https://${str}`);
      return true;
    } catch {
      return false;
    }
  }

  function getDomain(urlStr: string): string {
    try {
      return new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`).hostname;
    } catch {
      return "";
    }
  }

  function saveLink() {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    if (!isValidUrl(fullUrl)) {
      setError("Please enter a valid URL");
      return;
    }
    setError("");
    onChange(JSON.stringify({
      type: "link",
      url: fullUrl,
      title: title || getDomain(fullUrl),
    }));
  }

  if (linkData) {
    const domain = getDomain(linkData.url);
    return (
      <div className="border border-border rounded-lg p-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          className="w-8 h-8"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {linkData.title}
          </p>
          <p className="text-xs text-text-secondary truncate">{linkData.url}</p>
        </div>
        <button
          onClick={() => onChange("")}
          className="text-xs text-red-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="https://www.canva.com/design/..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Link title (optional)"
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
        onKeyDown={(e) => {
          if (e.key === "Enter") saveLink();
        }}
      />
      {url && isValidUrl(url.startsWith("http") ? url : `https://${url}`) && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=16`}
            alt=""
            className="w-4 h-4"
          />
          <span>{getDomain(url)}</span>
        </div>
      )}
      <button
        onClick={saveLink}
        disabled={!url.trim()}
        className="px-4 py-2 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition disabled:opacity-40"
      >
        Save Link
      </button>
    </div>
  );
}
