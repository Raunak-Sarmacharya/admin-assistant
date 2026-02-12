"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import type { RecordingState } from "@/hooks/use-audio-recorder";

interface AudioRecorderProps {
  state: RecordingState;
  duration: number;
  audioUrl: string | null;
  error: string | null;
  analyserNode: AnalyserNode | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled?: boolean;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function WaveformVisualizer({
  analyserNode,
  isActive,
  className,
}: {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || !isActive) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!isActive) return;
      animFrameRef.current = requestAnimationFrame(render);

      analyserNode.getByteTimeDomainData(dataArray);

      const { width, height } = canvas;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      // Draw waveform
      ctx.lineWidth = 2;

      // Gradient for the waveform line
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, "hsl(142, 71%, 45%)");
      gradient.addColorStop(0.5, "hsl(142, 71%, 55%)");
      gradient.addColorStop(1, "hsl(142, 71%, 45%)");
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const sliceWidth = w / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Draw subtle center line
      ctx.strokeStyle = "hsl(0, 0%, 50%)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    render();
  }, [analyserNode, isActive]);

  useEffect(() => {
    if (isActive && analyserNode) {
      draw();
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isActive, analyserNode, draw]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "w-full rounded-md border bg-black/5 dark:bg-white/5",
        className
      )}
      style={{ height: 80 }}
    />
  );
}

export function AudioRecorder({
  state,
  duration,
  audioUrl,
  error,
  analyserNode,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  disabled = false,
  compact = false,
}: AudioRecorderProps) {
  const isRecording = state === "recording";
  const isPaused = state === "paused";
  const isStopped = state === "stopped";
  const isIdle = state === "idle";

  return (
    <div className="space-y-3">
      {/* Waveform */}
      {(isRecording || isPaused) && (
        <WaveformVisualizer
          analyserNode={analyserNode}
          isActive={isRecording}
          className={isPaused ? "opacity-50" : ""}
        />
      )}

      {/* Idle state */}
      {isIdle && !error && (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8",
            "border-muted-foreground/25 bg-muted/30",
            compact && "p-4"
          )}
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Mic className="size-6 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium">Ready to Record</p>
          <p className="mt-1 text-xs text-muted-foreground text-center">
            Click the button below to start recording from your microphone.
            <br />
            Audio is processed locally — never stored on any server.
          </p>
        </div>
      )}

      {/* Stopped state - playback */}
      {isStopped && audioUrl && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-xs"
            >
              Recording Complete
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDuration(duration)}
            </span>
          </div>
          <audio src={audioUrl} controls className="w-full h-8" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Timer (during recording) */}
      {(isRecording || isPaused) && (
        <div className="flex items-center justify-center gap-3">
          <div
            className={cn(
              "size-2.5 rounded-full",
              isRecording ? "bg-red-500 animate-pulse" : "bg-yellow-500"
            )}
          />
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-wider">
            {formatDuration(duration)}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {isRecording ? "Recording" : "Paused"}
          </Badge>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {isIdle && (
          <Button
            onClick={onStart}
            disabled={disabled}
            size={compact ? "default" : "lg"}
            className="gap-2"
          >
            <Mic className="size-4" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <>
            <Button
              onClick={onPause}
              variant="outline"
              size="icon"
              className="size-10"
            >
              <Pause className="size-4" />
            </Button>
            <Button
              onClick={onStop}
              variant="destructive"
              size={compact ? "default" : "lg"}
              className="gap-2"
            >
              <Square className="size-3.5" />
              Stop Recording
            </Button>
          </>
        )}

        {isPaused && (
          <>
            <Button
              onClick={onResume}
              variant="outline"
              size="icon"
              className="size-10"
            >
              <Play className="size-4" />
            </Button>
            <Button
              onClick={onStop}
              variant="destructive"
              size={compact ? "default" : "lg"}
              className="gap-2"
            >
              <Square className="size-3.5" />
              Stop Recording
            </Button>
          </>
        )}

        {isStopped && (
          <Button
            onClick={onReset}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Record Again
          </Button>
        )}
      </div>
    </div>
  );
}
