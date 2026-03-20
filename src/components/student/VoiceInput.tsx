"use client";

import { useState, useRef, useEffect } from "react";

interface VoiceInputProps {
  value: string;
  onChange: (v: string) => void;
  unitId?: string;
  pageId?: string;
  sectionIndex: number;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceInput({
  value,
  onChange,
  unitId,
  pageId,
  sectionIndex,
}: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const voiceData =
    value && value.startsWith("{")
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        })()
      : null;

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
        onChange(
          JSON.stringify({
            type: "voice",
            url: data.url,
            duration: duration,
            filename: data.filename,
          })
        );
      }
    } catch (err) {
      console.error("Voice upload failed:", err);
    } finally {
      setUploading(false);
    }
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
                {voiceData.duration
                  ? formatTime(voiceData.duration)
                  : "Recorded"}
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
