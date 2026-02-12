"use client";

import { cn } from "@/lib/utils";
import {
  Upload,
  AudioLines,
  ShieldCheck,
  Brain,
  Scale,
  CheckCircle2,
  Loader2,
  Circle,
} from "lucide-react";

export type PipelineStepStatus = "pending" | "running" | "complete" | "error" | "skipped";

export interface PipelineStep {
  id: string;
  label: string;
  description?: string;
  status: PipelineStepStatus;
  icon: React.ElementType;
}

interface ProcessingPipelineProps {
  steps: PipelineStep[];
  className?: string;
}

const statusConfig: Record<
  PipelineStepStatus,
  { color: string; bgColor: string; ringColor: string }
> = {
  pending: {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    ringColor: "",
  },
  running: {
    color: "text-primary",
    bgColor: "bg-primary/10",
    ringColor: "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
  },
  complete: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    ringColor: "",
  },
  error: {
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    ringColor: "",
  },
  skipped: {
    color: "text-muted-foreground/50",
    bgColor: "bg-muted/50",
    ringColor: "",
  },
};

function StepIcon({
  step,
}: {
  step: PipelineStep;
}) {
  const config = statusConfig[step.status];

  if (step.status === "running") {
    return (
      <div className={cn("flex size-9 items-center justify-center rounded-full", config.bgColor, config.ringColor)}>
        <Loader2 className={cn("size-4 animate-spin", config.color)} />
      </div>
    );
  }

  if (step.status === "complete") {
    return (
      <div className={cn("flex size-9 items-center justify-center rounded-full", config.bgColor, config.ringColor)}>
        <CheckCircle2 className={cn("size-4", config.color)} />
      </div>
    );
  }

  const Icon = step.status === "pending" ? Circle : step.icon;

  return (
    <div className={cn("flex size-9 items-center justify-center rounded-full", config.bgColor, config.ringColor)}>
      <Icon className={cn("size-4", config.color)} />
    </div>
  );
}

export function ProcessingPipeline({ steps, className }: ProcessingPipelineProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <StepIcon step={step} />
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-px flex-1 min-h-[20px] my-1 transition-colors",
                  step.status === "complete"
                    ? "bg-green-300 dark:bg-green-700"
                    : "bg-border"
                )}
              />
            )}
          </div>
          <div className="pb-4 pt-1.5 min-w-0">
            <p
              className={cn(
                "text-sm font-medium leading-none",
                step.status === "running" && "text-primary",
                step.status === "complete" && "text-green-700 dark:text-green-400",
                step.status === "pending" && "text-muted-foreground",
                step.status === "skipped" && "text-muted-foreground/50 line-through"
              )}
            >
              {step.label}
            </p>
            {step.description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Pre-built step definitions for the meeting processing pipeline
export function createPipelineSteps(mode: "paste" | "audio" | "file" | "record"): PipelineStep[] {
  const steps: PipelineStep[] = [];

  if (mode === "audio" || mode === "record") {
    steps.push({
      id: "upload",
      label: "Upload Recording",
      description: "Reading audio file",
      status: "pending",
      icon: Upload,
    });
    steps.push({
      id: "transcribe",
      label: "AI Transcription",
      description: "Converting speech to text",
      status: "pending",
      icon: AudioLines,
    });
  } else if (mode === "file") {
    steps.push({
      id: "upload",
      label: "Upload Document",
      description: "Extracting text content",
      status: "pending",
      icon: Upload,
    });
  }

  steps.push(
    {
      id: "pii",
      label: "PII Redaction",
      description: "Scanning for sensitive data",
      status: "pending",
      icon: ShieldCheck,
    },
    {
      id: "ai",
      label: "AI Analysis",
      description: "Generating summary, tasks & email",
      status: "pending",
      icon: Brain,
    },
    {
      id: "compliance",
      label: "Compliance Scan",
      description: "FINRA & SEC review",
      status: "pending",
      icon: Scale,
    },
    {
      id: "done",
      label: "Complete",
      description: "Ready for review",
      status: "pending",
      icon: CheckCircle2,
    }
  );

  return steps;
}
