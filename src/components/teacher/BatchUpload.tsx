"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  File,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { UploadSSEEvent } from "@/types/upload-progress";

interface BatchUploadProps {
  onUploadComplete?: (results: UploadResult[]) => void;
  onClose?: () => void;
  className?: string;
}

interface UploadResult {
  filename: string;
  success: boolean;
  documentId?: string;
  error?: string;
  profileId?: string;
}

interface QueuedFile {
  id: string;
  file: File;
  status: "queued" | "extracting" | "analysing" | "ready" | "error";
  progress: number;
  message: string;
  error?: string;
  uploadId?: string;
  profileId?: string;
}

const ACCEPTED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_BATCH = 10;

const SOURCE_CATEGORIES = [
  { id: "lesson_plan", label: "Lesson Plan" },
  { id: "scheme_of_work", label: "Scheme of Work" },
  { id: "student_exemplar", label: "Student Exemplar" },
  { id: "assessment_resource", label: "Assessment Resource" },
  { id: "general_resource", label: "General Resource" },
] as const;

export default function BatchUpload({
  onUploadComplete,
  onClose,
  className = "",
}: BatchUploadProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [sourceCategory, setSourceCategory] = useState<string>("lesson_plan");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Get file icon based on extension
  function getFileIcon(filename: string) {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "pdf") {
      return <FileText className="w-4 h-4 text-red-500" />;
    }
    if (ext === "docx") {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    if (ext === "pptx") {
      return <FileText className="w-4 h-4 text-orange-500" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  }

  // Validate file
  function isValidFile(file: File): { valid: boolean; error?: string } {
    const ext = file.name.toLowerCase().split(".").pop();
    const isValidType = ACCEPTED_TYPES.includes(file.type) || ["pdf", "docx", "pptx"].includes(ext || "");

    if (!isValidType) {
      return { valid: false, error: "Only PDF, DOCX, and PPTX files are accepted" };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File exceeds 10MB limit (${formatFileSize(file.size)})` };
    }

    return { valid: true };
  }

  // Handle file selection (both drag-drop and browse)
  function handleFiles(files: FileList) {
    const newFiles: QueuedFile[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = isValidFile(file);

      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      // Check if file already in queue
      if (queue.some((f) => f.file.name === file.name && f.file.size === file.size)) {
        errors.push(`${file.name}: Already in upload queue`);
        continue;
      }

      newFiles.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: "queued",
        progress: 0,
        message: "Waiting to upload...",
      });
    }

    // Check total file count
    const totalFiles = queue.length + newFiles.length;
    if (totalFiles > MAX_FILES_PER_BATCH) {
      errors.push(
        `Cannot exceed ${MAX_FILES_PER_BATCH} files per batch (${totalFiles} selected)`
      );
      newFiles.splice(MAX_FILES_PER_BATCH - queue.length);
    }

    if (errors.length > 0) {
      // Show validation errors
      alert("File validation errors:\n\n" + errors.join("\n"));
    }

    if (newFiles.length > 0) {
      setQueue((prev) => [...prev, ...newFiles]);
    }
  }

  // Handle drag and drop
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  // Upload a single file
  async function uploadFile(queuedFile: QueuedFile): Promise<UploadResult> {
    const abortController = new AbortController();
    abortControllersRef.current.set(queuedFile.id, abortController);

    try {
      // Update status to extracting
      setQueue((prev) =>
        prev.map((f) =>
          f.id === queuedFile.id
            ? { ...f, status: "extracting", message: "Uploading...", progress: 5 }
            : f
        )
      );

      const formData = new FormData();
      formData.append("file", queuedFile.file);
      formData.append("source_category", sourceCategory);

      const response = await fetch("/api/teacher/knowledge/upload", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      // Handle non-200 response before reading stream
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: UploadSSEEvent = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                setQueue((prev) =>
                  prev.map((f) =>
                    f.id === queuedFile.id
                      ? {
                          ...f,
                          status: event.stage as "extracting" | "analysing",
                          message: event.message,
                          progress: event.percent,
                        }
                      : f
                  )
                );
              } else if (event.type === "complete") {
                setQueue((prev) =>
                  prev.map((f) =>
                    f.id === queuedFile.id
                      ? {
                          ...f,
                          status: "ready",
                          message: "Upload complete",
                          progress: 100,
                          uploadId: event.uploadId,
                          profileId: event.profileId,
                        }
                      : f
                  )
                );

                return {
                  filename: event.filename,
                  success: true,
                  documentId: event.uploadId,
                  profileId: event.profileId,
                };
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.warn("Failed to parse SSE event:", line);
              } else {
                throw e;
              }
            }
          }
        }
      }

      // If we got here without a complete event, something went wrong
      throw new Error("Upload did not complete");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";

      // Don't show error for aborted requests
      if (abortController.signal.aborted) {
        return {
          filename: queuedFile.file.name,
          success: false,
          error: "Upload cancelled",
        };
      }

      setQueue((prev) =>
        prev.map((f) =>
          f.id === queuedFile.id
            ? {
                ...f,
                status: "error",
                message: "Upload failed",
                error: errorMsg,
              }
            : f
        )
      );

      return {
        filename: queuedFile.file.name,
        success: false,
        error: errorMsg,
      };
    } finally {
      abortControllersRef.current.delete(queuedFile.id);
    }
  }

  // Process queue sequentially
  async function processQueue() {
    if (isProcessing || queue.length === 0) return;

    setIsProcessing(true);
    setCompletedCount(0);
    const results: UploadResult[] = [];

    for (const queuedFile of queue) {
      if (queuedFile.status !== "queued") continue;

      const result = await uploadFile(queuedFile);
      results.push(result);
      setCompletedCount((prev) => prev + 1);

      // Small delay between uploads to avoid overloading
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsProcessing(false);
    onUploadComplete?.(results);
  }

  // Start processing when files are added and not already processing
  async function startProcessing() {
    if (isProcessing) return;
    await processQueue();
  }

  // Remove file from queue
  function removeFile(id: string) {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
    }
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }

  // Retry failed upload
  async function retryFile(id: string) {
    const file = queue.find((f) => f.id === id);
    if (!file) return;

    // Reset to queued
    setQueue((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: "queued", message: "Waiting to upload...", error: undefined } : f
      )
    );

    const result = await uploadFile(file);
    onUploadComplete?.([result]);
  }

  // Auto-start processing when files are added
  const shouldProcess = queue.length > 0 && !isProcessing && queue.some((f) => f.status === "queued");
  if (shouldProcess) {
    // Use callback to avoid infinite render loops
    const startAsync = async () => {
      await startProcessing();
    };
    startAsync().catch(console.error);
  }

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Quarantine banner (Phase 0.2, 10 Apr 2026) */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg">
        <p className="text-sm text-amber-900 font-semibold">Migrated to new ingestion</p>
        <p className="text-sm text-amber-800 mt-1">
          The legacy knowledge upload pipeline is quarantined. Use the new Dimensions3 pipeline via{" "}
          <a href="/teacher/knowledge/review" className="underline font-medium">
            /teacher/knowledge/review
          </a>
          . Uploads submitted from this component will fail with HTTP 410.
        </p>
      </div>
      {/* Source Category Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Content Category
        </label>
        <select
          value={sourceCategory}
          onChange={(e) => setSourceCategory(e.target.value)}
          disabled={isProcessing || queue.some((f) => ["extracting", "analysing"].includes(f.status))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {SOURCE_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drag-Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-900 mb-1">
          Drag and drop your files here
        </p>
        <p className="text-xs text-gray-500 mb-3">
          or click to browse
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition"
        >
          Browse Files
        </button>
        <p className="text-xs text-gray-500 mt-3">
          PDF, DOCX, PPTX • Up to 10MB each • Maximum 10 files
        </p>
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />

      {/* File Queue */}
      {queue.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Upload Queue ({queue.length} file{queue.length !== 1 ? "s" : ""})
            </h3>
            {completedCount > 0 && (
              <span className="text-xs text-green-600 font-medium">
                {completedCount} of {queue.length} complete
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queue.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-3">
                  {/* File Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === "ready" ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : ["extracting", "analysing"].includes(item.status) ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : (
                      getFileIcon(item.file.name)
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.file.name}
                      </p>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>

                    {/* Status and Message */}
                    <div className="mt-1">
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {item.message}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-600 mt-1">{item.error}</p>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {["extracting", "analysing"].includes(item.status) && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {item.status === "error" && (
                      <button
                        onClick={() => retryFile(item.id)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Retry upload"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    {item.status === "queued" || item.status === "error" ? (
                      <button
                        onClick={() => removeFile(item.id)}
                        className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Progress Bar */}
      {queue.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">
              Overall Progress
            </span>
            <span className="text-xs text-gray-600">
              {completedCount} of {queue.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${queue.length > 0 ? (completedCount / queue.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Close Button */}
      {queue.length > 0 && !isProcessing && completedCount === queue.length && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
