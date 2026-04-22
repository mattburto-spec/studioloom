"use client";

/**
 * FileDropzone — drag-drop + click file picker for Preflight uploads.
 *
 * Handles the three inputs: drag, drop, click-to-browse. Validates
 * extension + size immediately and surfaces rejections inline (no toast
 * infrastructure in the project — errors live in-place).
 *
 * Stateless w/r/t the upload flow itself — the parent page manages the
 * selected file. This component just announces picks and rejections.
 */

import * as React from "react";
import {
  validateUploadFile,
  formatFileSize,
  type FabricationFileType,
} from "./picker-helpers";

export interface FileDropzoneProps {
  /** The currently-picked file, if any. null = empty state. */
  file: File | null;
  /**
   * Called when a valid file is picked (drag or click). The component
   * runs validation first; onFilePicked never sees an invalid file.
   */
  onFilePicked: (file: File, fileType: FabricationFileType) => void;
  /** Called when a pick attempt fails validation. Message is user-facing. */
  onValidationError: (message: string) => void;
  /** Disable interaction while an upload is in progress. */
  disabled?: boolean;
}

export function FileDropzone({
  file,
  onFilePicked,
  onValidationError,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = React.useCallback(
    (picked: File) => {
      const result = validateUploadFile({ name: picked.name, size: picked.size });
      if (!result.ok) {
        onValidationError(result.error);
        return;
      }
      onFilePicked(picked, result.fileType);
    },
    [onFilePicked, onValidationError]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    const picked = e.dataTransfer.files?.[0];
    if (picked) handleFile(picked);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
    // Reset the input so picking the same file twice re-fires onChange.
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const borderColor = isDragOver
    ? "border-brand-purple"
    : file
    ? "border-green-400"
    : "border-gray-300";

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Drop file or press Enter to browse"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`rounded-xl border-2 border-dashed ${borderColor} bg-gray-50 p-6 text-center transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-100"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".stl,.svg"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
          aria-hidden="true"
        />
        {file ? (
          <div>
            <p className="text-sm font-semibold text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{formatFileSize(file.size)}</p>
            <p className="text-xs text-gray-400 mt-2">
              Click or drop a new file to replace
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drop your STL or SVG file here
            </p>
            <p className="text-xs text-gray-500 mt-1">
              or click to browse — up to 50 MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileDropzone;
