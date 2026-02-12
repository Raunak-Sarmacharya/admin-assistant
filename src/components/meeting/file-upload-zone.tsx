"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileAudio,
  FileText,
  X,
  AlertCircle,
} from "lucide-react";

export interface UploadedFile {
  file: File;
  base64: string;
  mimeType: string;
  preview: {
    name: string;
    size: string;
    type: "audio" | "text";
    duration?: string;
  };
}

interface FileUploadZoneProps {
  accept: string;
  maxSizeMB: number;
  fileType: "audio" | "text";
  onFileReady: (uploaded: UploadedFile) => void;
  onFileClear: () => void;
  uploadedFile: UploadedFile | null;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm", ".ogg"];
const TEXT_EXTENSIONS = [".txt", ".md", ".csv"];

export function FileUploadZone({
  accept,
  maxSizeMB,
  fileType,
  onFileReady,
  onFileClear,
  uploadedFile,
  disabled = false,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const extensions = fileType === "audio" ? AUDIO_EXTENSIONS : TEXT_EXTENSIONS;
  const FileIcon = fileType === "audio" ? FileAudio : FileText;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `File too large. Maximum size is ${maxSizeMB}MB.`;
      }
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!extensions.includes(ext)) {
        return `Unsupported format. Accepted: ${extensions.join(", ")}`;
      }
      return null;
    },
    [maxSizeMB, extensions]
  );

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        const uploaded: UploadedFile = {
          file,
          base64,
          mimeType: file.type || (fileType === "audio" ? "audio/mpeg" : "text/plain"),
          preview: {
            name: file.name,
            size: formatFileSize(file.size),
            type: fileType,
          },
        };

        onFileReady(uploaded);
      } catch {
        setError("Failed to read file. Please try again.");
      }
    },
    [validateFile, fileType, onFileReady]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, processFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [processFile]
  );

  if (uploadedFile) {
    return (
      <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50/50 p-6 dark:border-green-800 dark:bg-green-950/20">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
            <FileIcon className="size-6 text-green-700 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">
              {uploadedFile.preview.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-[10px]">
                {uploadedFile.preview.size}
              </Badge>
              <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                Ready
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => {
              onFileClear();
              setError(null);
            }}
            disabled={disabled}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50",
          disabled && "pointer-events-none opacity-50",
          error && "border-destructive/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div className={cn(
          "flex size-14 items-center justify-center rounded-full transition-colors",
          isDragOver ? "bg-primary/10" : "bg-muted"
        )}>
          <Upload className={cn(
            "size-6 transition-colors",
            isDragOver ? "text-primary" : "text-muted-foreground"
          )} />
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm font-medium">
            {isDragOver ? "Drop file here" : "Drag & drop or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fileType === "audio"
              ? `MP3, WAV, M4A, WebM, OGG — up to ${maxSizeMB}MB`
              : `TXT, MD, CSV — up to ${maxSizeMB}MB`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
