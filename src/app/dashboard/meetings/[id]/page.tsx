"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDueDate } from "@/lib/utils/formatters";
import { PRIORITY_COLORS, STATUS_COLORS } from "@/lib/constants";
import { toast } from "sonner";
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Lock,
  FileText,
  ListChecks,
  Mail,
  Loader2,
  Mic,
  FileUp,
  ClipboardPaste,
} from "lucide-react";
import Link from "next/link";
import type {
  Meeting,
  MeetingOutput,
  Task,
  ComplianceFlag,
  Client,
  PIIEntity,
} from "@/types/database";

export default function MeetingWorkbenchPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [output, setOutput] = useState<MeetingOutput | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [flags, setFlags] = useState<ComplianceFlag[]>([]);
  const [editedEmail, setEditedEmail] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const { data: meetingData } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (!meetingData) {
      router.push("/dashboard");
      return;
    }

    setMeeting(meetingData as Meeting);

    const [clientRes, outputRes, tasksRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", meetingData.client_id).single(),
      supabase.from("meeting_outputs").select("*").eq("meeting_id", meetingId).single(),
      supabase.from("tasks").select("*").eq("meeting_id", meetingId).order("priority"),
    ]);

    setClient(clientRes.data as Client | null);
    setTasks((tasksRes.data || []) as Task[]);

    if (outputRes.data) {
      const o = outputRes.data as MeetingOutput;
      setOutput(o);
      setEditedEmail(o.client_email_draft || "");

      const { data: flagsData } = await supabase
        .from("compliance_flags")
        .select("*")
        .eq("meeting_output_id", o.id)
        .order("severity");
      setFlags((flagsData || []) as ComplianceFlag[]);
    }

    setLoading(false);
  }, [meetingId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleApprove() {
    if (!output) return;
    const unresolvedHigh = flags.filter(
      (f) => f.severity === "high" && !f.is_resolved
    );
    if (unresolvedHigh.length > 0) {
      toast.error("Please resolve all high-severity compliance flags before approving.");
      return;
    }

    setIsApproving(true);
    const supabase = createClient();

    try {
      await supabase
        .from("meeting_outputs")
        .update({
          client_email_draft: editedEmail,
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq("id", output.id);

      await supabase
        .from("meetings")
        .update({ status: "approved" })
        .eq("id", meetingId);

      toast.success("Meeting approved and email draft saved!");
      loadData();
    } catch {
      toast.error("Failed to approve meeting");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleResolveFlag(flagId: string) {
    const supabase = createClient();
    await supabase
      .from("compliance_flags")
      .update({ is_resolved: true })
      .eq("id", flagId);
    setFlags((prev) =>
      prev.map((f) => (f.id === flagId ? { ...f, is_resolved: true } : f))
    );
    toast.success("Flag resolved");
  }

  function highlightCompliance(text: string): React.ReactNode {
    if (flags.length === 0) return text;

    const unresolvedFlags = flags.filter((f) => !f.is_resolved);
    if (unresolvedFlags.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    const sortedFlags = [...unresolvedFlags].sort((a, b) => {
      const aIdx = text.toLowerCase().indexOf(a.flagged_text.toLowerCase());
      const bIdx = text.toLowerCase().indexOf(b.flagged_text.toLowerCase());
      return aIdx - bIdx;
    });

    for (const flag of sortedFlags) {
      const idx = text.toLowerCase().indexOf(flag.flagged_text.toLowerCase(), lastIndex);
      if (idx === -1) continue;

      if (idx > lastIndex) {
        parts.push(text.slice(lastIndex, idx));
      }

      const severityColor =
        flag.severity === "high"
          ? "bg-red-200 dark:bg-red-900/50"
          : flag.severity === "medium"
          ? "bg-orange-200 dark:bg-orange-900/50"
          : "bg-yellow-200 dark:bg-yellow-900/50";

      parts.push(
        <Tooltip key={flag.id}>
          <TooltipTrigger asChild>
            <span
              className={`${severityColor} underline decoration-wavy cursor-help px-0.5 rounded-sm`}
            >
              {text.slice(idx, idx + flag.flagged_text.length)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-3" />
                <span className="font-semibold text-xs">
                  {flag.risk_category} — {flag.severity}
                </span>
              </div>
              <p className="text-xs">{flag.explanation}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );

      lastIndex = idx + flag.flagged_text.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meeting) return null;

  const piiEntities = (meeting.pii_entities || []) as PIIEntity[];
  const unresolvedCount = flags.filter((f) => !f.is_resolved).length;
  const hasHighFlags = flags.some((f) => f.severity === "high" && !f.is_resolved);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex size-8 items-center justify-center rounded-md border hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {meeting.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-muted-foreground">
                {client?.name}
              </span>
              <span className="text-muted-foreground">&middot;</span>
              <span className="text-sm text-muted-foreground">
                {formatDate(meeting.created_at)}
              </span>
              <Badge
                variant="secondary"
                className={`text-xs ${STATUS_COLORS[meeting.status] || ""}`}
              >
                {meeting.status.replace("_", " ")}
              </Badge>
              {meeting.source_type && meeting.source_type !== "paste" && (
                <Badge variant="outline" className="gap-1 text-xs">
                  {meeting.source_type === "audio_upload" ? (
                    <Mic className="size-2.5" />
                  ) : (
                    <FileUp className="size-2.5" />
                  )}
                  {meeting.source_type === "audio_upload"
                    ? "Audio"
                    : "File Upload"}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {output && !output.is_approved && (
          <Button
            onClick={handleApprove}
            disabled={isApproving || hasHighFlags}
          >
            {isApproving ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="size-4 mr-2" />
            )}
            Approve & Save
          </Button>
        )}
        {output?.is_approved && (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 gap-1">
            <CheckCircle2 className="size-3" />
            Approved
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Column 1: Transcript + PII */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="size-4" />
              Transcript
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {piiEntities.length > 0 && (
              <div className="rounded-md border border-green-200 bg-green-50 p-2.5 dark:border-green-900/50 dark:bg-green-950/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lock className="size-3 text-green-600" />
                  <span className="text-xs font-medium text-green-800 dark:text-green-300">
                    {piiEntities.length} PII item{piiEntities.length !== 1 ? "s" : ""} redacted
                  </span>
                </div>
                <div className="space-y-1">
                  {piiEntities.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <code className="text-red-600 dark:text-red-400 line-through">
                        {e.original}
                      </code>
                      <span className="text-green-700 dark:text-green-400 font-mono">
                        {e.replacement}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ScrollArea className="h-[500px]">
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground font-mono">
                {meeting.transcript_text}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Column 2: Summary + Tasks */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="size-4" />
              Summary & Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {output ? (
              <ScrollArea className="h-[550px]">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Summary
                    </h3>
                    <p className="text-sm leading-relaxed">
                      {output.summary_text}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Key Topics
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {(output.key_topics || []).map((topic, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Action Items ({tasks.length})
                    </h3>
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-2 rounded-md border p-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs">{task.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDueDate(task.due_date)}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] shrink-0 ${PRIORITY_COLORS[task.priority] || ""}`}
                          >
                            {task.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                No AI output yet. Process this meeting first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Email Draft + Compliance */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="size-4" />
              Email Draft
              {unresolvedCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-auto text-[10px] gap-1"
                >
                  <AlertTriangle className="size-2.5" />
                  {unresolvedCount} flag{unresolvedCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {output ? (
              <ScrollArea className="h-[550px]">
                <div className="space-y-4">
                  {flags.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Shield className="size-3.5 text-orange-600" />
                        <span className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                          Compliance Alerts
                        </span>
                      </div>
                      {flags.map((flag) => (
                        <div
                          key={flag.id}
                          className={`rounded-md border p-2.5 text-xs ${
                            flag.is_resolved
                              ? "opacity-50 bg-muted/30"
                              : flag.severity === "high"
                              ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
                              : flag.severity === "medium"
                              ? "border-orange-300 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20"
                              : "border-yellow-300 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/20"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${
                                  flag.severity === "high"
                                    ? "bg-red-200 text-red-800"
                                    : flag.severity === "medium"
                                    ? "bg-orange-200 text-orange-800"
                                    : "bg-yellow-200 text-yellow-800"
                                }`}
                              >
                                {flag.severity}
                              </Badge>
                              <span className="font-medium">
                                {flag.risk_category}
                              </span>
                            </div>
                            {!flag.is_resolved && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-1.5"
                                onClick={() => handleResolveFlag(flag.id)}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            &ldquo;{flag.flagged_text}&rdquo;
                          </p>
                          {flag.explanation && (
                            <p className="mt-1 text-muted-foreground italic">
                              {flag.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                      <Separator />
                    </div>
                  )}

                  {output.is_approved ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {highlightCompliance(editedEmail)}
                    </div>
                  ) : (
                    <Textarea
                      className="min-h-[350px] text-sm border-0 shadow-none resize-none focus-visible:ring-0 p-0"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                    />
                  )}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                No email draft yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
