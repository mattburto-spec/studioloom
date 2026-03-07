"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ResponseType } from "@/types";

interface ResponseInputProps {
  sectionIndex: number;
  responseType: ResponseType;
  value: string;
  onChange: (value: string) => void;
  sentenceStarters?: string[];
  placeholder?: string;
  unitId?: string;
  pageId?: string;
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
}: ResponseInputProps) {
  const [activeType, setActiveType] = useState<ResponseType>(
    responseType === "multi" ? "text" : responseType
  );

  const typeOptions: { type: ResponseType; label: string; icon: string }[] = [
    { type: "text", label: "Text", icon: "✏️" },
    { type: "upload", label: "Upload", icon: "📎" },
    { type: "voice", label: "Voice", icon: "🎤" },
    { type: "sketch", label: "Sketch", icon: "🎨" },
  ];

  return (
    <div className="space-y-2">
      {/* Response type selector for multi */}
      {responseType === "multi" && (
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

      {/* Text input */}
      {(activeType === "text" || (responseType === "text" && responseType !== "multi")) && (
        <textarea
          id={`response-${sectionIndex}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-y text-sm"
        />
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

      {/* Sketch */}
      {activeType === "sketch" && (
        <SketchInput
          value={value}
          onChange={onChange}
          unitId={unitId}
          pageId={pageId}
          sectionIndex={sectionIndex}
        />
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
// Sketch Input
// ========================================
function SketchInput({
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [saving, setSaving] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const sketchData = value && value.startsWith("{") ? (() => {
    try {
      const parsed = JSON.parse(value);
      return parsed.type === "sketch" ? parsed : null;
    } catch { return null; }
  })() : null;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sketchData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 300;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [sketchData]);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPos.current) return;

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? brushSize * 3 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }, [drawing, color, brushSize, tool, getPos]);

  const endDraw = useCallback(() => {
    setDrawing(false);
    lastPos.current = null;
  }, []);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function saveSketch() {
    const canvas = canvasRef.current;
    if (!canvas || !unitId || !pageId) return;
    setSaving(true);

    canvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }

      const file = new File([blob], `sketch_${sectionIndex}.png`, {
        type: "image/png",
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
            type: "sketch",
            url: data.url,
            filename: data.filename,
          }));
        }
      } catch (err) {
        console.error("Sketch save failed:", err);
      } finally {
        setSaving(false);
      }
    }, "image/png");
  }

  const colors = ["#000000", "#EF4444", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6"];

  if (sketchData) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-text-primary">Your Sketch</p>
          <button
            onClick={() => onChange("")}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Remove & Redraw
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sketchData.url}
          alt="Sketch"
          className="w-full rounded border border-border"
        />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt border-b border-border flex-wrap">
        <button
          onClick={() => setTool("pen")}
          className={`px-2 py-1 text-xs rounded transition ${
            tool === "pen" ? "bg-accent-blue text-white" : "bg-white text-text-secondary hover:bg-gray-100"
          }`}
        >
          ✏️ Pen
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`px-2 py-1 text-xs rounded transition ${
            tool === "eraser" ? "bg-accent-blue text-white" : "bg-white text-text-secondary hover:bg-gray-100"
          }`}
        >
          🧹 Eraser
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {colors.map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool("pen"); }}
            className={`w-5 h-5 rounded-full border-2 transition ${
              color === c && tool === "pen" ? "border-text-primary scale-125" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        <select
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="text-xs bg-white border border-border rounded px-1 py-0.5"
        >
          <option value={1}>Thin</option>
          <option value={3}>Medium</option>
          <option value={6}>Thick</option>
          <option value={10}>Extra Thick</option>
        </select>

        <div className="flex-1" />

        <button
          onClick={clearCanvas}
          className="px-2 py-1 text-xs text-red-400 hover:text-red-600 bg-white rounded border border-border"
        >
          Clear
        </button>
        <button
          onClick={saveSketch}
          disabled={saving}
          className="px-3 py-1 text-xs bg-accent-blue text-white rounded hover:bg-accent-blue/90 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "💾 Save Sketch"}
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair bg-white touch-none"
        style={{ height: 300 }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
    </div>
  );
}
