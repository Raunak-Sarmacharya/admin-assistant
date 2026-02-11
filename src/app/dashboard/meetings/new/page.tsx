"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiKey } from "@/hooks/use-api-key";
import { createClient } from "@/lib/supabase/client";
import { redactPII, getPIISummary } from "@/lib/utils/pii-redaction";
import { SAMPLE_TRANSCRIPTS } from "@/data/sample-transcripts";
import { toast } from "sonner";
import { Loader2, Shield, ShieldAlert, FileText, Sparkles, Lock } from "lucide-react";
import type { Client } from "@/types/database";
import Link from "next/link";

export default function NewMeetingPage() {
  const router = useRouter();
  const { apiKey, model, isKeySet, isLoaded } = useApiKey();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  useEffect(() => {
    async function loadClients() {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      setClients((data || []) as Client[]);
    }
    loadClients();
  }, []);

  function handleLoadSample(index: number) {
    const sample = SAMPLE_TRANSCRIPTS[index];
    setTranscript(sample.transcript);
    setTitle(sample.title);
    const match = clients.find((c) =>
      c.name.toLowerCase().includes(sample.clientHint.toLowerCase()) ||
      sample.clientHint.toLowerCase().includes(c.name.toLowerCase())
    );
    if (match) setSelectedClientId(match.id);
    toast.info(`Loaded sample: ${sample.title}`);
  }

  async function handleProcess() {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    if (!transcript.trim()) {
      toast.error("Please enter a transcript");
      return;
    }
    if (!isKeySet) {
      toast.error("Please configure your API key in Settings");
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    setIsProcessing(true);
    const supabase = createClient();

    try {
      // Step 1: PII Redaction
      setProcessingStep("Scanning for PII...");
      const { redactedText, entities } = redactPII(transcript);

      // Step 2: Create meeting record
      setProcessingStep("Creating meeting record...");
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          client_id: selectedClientId,
          title: title || "Untitled Meeting",
          transcript_text: transcript,
          transcript_redacted: redactedText,
          pii_entities: entities,
          status: "processing",
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Step 3: AI Processing
      setProcessingStep("AI is analyzing transcript...");
      const aiRes = await fetch("/api/ai/process-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          transcript: redactedText,
          clientName: client.name,
          riskTolerance: client.risk_tolerance,
          aumValue: Number(client.aum_value),
          model,
        }),
      });

      if (!aiRes.ok) {
        const errData = await aiRes.json();
        if (errData.isQuota) {
          // Clean up the meeting record since AI failed
          await supabase.from("meetings").delete().eq("id", meeting.id);
          toast.error(errData.error, {
            description: "Go to Settings → switch to Google Gemini (free).",
            duration: 8000,
          });
          return;
        }
        throw new Error(errData.error || "AI processing failed");
      }

      const { data: aiOutput } = await aiRes.json();

      // Step 4: Save meeting output
      setProcessingStep("Saving AI outputs...");
      const { data: output, error: outputError } = await supabase
        .from("meeting_outputs")
        .insert({
          meeting_id: meeting.id,
          summary_text: aiOutput.summary,
          key_topics: aiOutput.key_topics,
          client_email_draft: aiOutput.email_draft,
        })
        .select()
        .single();

      if (outputError) throw outputError;

      // Step 5: Save tasks
      if (aiOutput.tasks && aiOutput.tasks.length > 0) {
        const taskInserts = aiOutput.tasks.map((t: { description: string; priority: string; due_date_suggestion: string | null }) => ({
          meeting_id: meeting.id,
          client_id: selectedClientId,
          description: t.description,
          priority: t.priority,
          due_date: t.due_date_suggestion,
        }));
        await supabase.from("tasks").insert(taskInserts);
      }

      // Step 6: Compliance check
      setProcessingStep("Running compliance scan...");
      const complianceRes = await fetch("/api/ai/compliance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          emailDraft: aiOutput.email_draft,
          clientRiskTolerance: client.risk_tolerance,
          model,
        }),
      });

      if (complianceRes.ok) {
        const { data: complianceData } = await complianceRes.json();
        if (complianceData.flags && complianceData.flags.length > 0) {
          const flagInserts = complianceData.flags.map((f: { flagged_text: string; risk_category: string; severity: string; explanation: string }) => ({
            meeting_output_id: output.id,
            flagged_text: f.flagged_text,
            risk_category: f.risk_category,
            severity: f.severity,
            explanation: f.explanation,
          }));
          await supabase.from("compliance_flags").insert(flagInserts);
        }
      }

      // Step 7: Update meeting status
      await supabase
        .from("meetings")
        .update({ status: "review_needed" })
        .eq("id", meeting.id);

      toast.success("Meeting processed successfully!");
      router.push(`/dashboard/meetings/${meeting.id}`);
    } catch (error) {
      console.error("Processing error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to process meeting"
      );
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  }

  if (!isLoaded) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Process Meeting
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste a meeting transcript to generate a summary, tasks, and
          client email.
        </p>
      </div>

      {!isKeySet && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20">
          <ShieldAlert className="size-5 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              API Key Required
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400">
              Configure your OpenAI API key to use AI features.
            </p>
          </div>
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center mr-1">
          Quick load:
        </span>
        {SAMPLE_TRANSCRIPTS.map((sample, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => handleLoadSample(i)}
          >
            <FileText className="size-3 mr-1" />
            {sample.title}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meeting Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={selectedClientId}
                    onValueChange={setSelectedClientId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Meeting Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Q1 Portfolio Review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transcript">Transcript</Label>
                <Textarea
                  id="transcript"
                  placeholder="Paste the meeting transcript here..."
                  className="min-h-[300px] font-mono text-sm"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="size-4" />
                PII Vault
              </CardTitle>
              <CardDescription>
                PII is automatically redacted before AI processing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transcript.trim() ? (
                (() => {
                  const { entities } = redactPII(transcript);
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="size-4 text-green-600" />
                        <span className="text-sm font-medium">
                          {entities.length === 0
                            ? "No PII detected"
                            : `${entities.length} item${entities.length !== 1 ? "s" : ""} to redact`}
                        </span>
                      </div>
                      {entities.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            {getPIISummary(entities)}
                          </p>
                          {entities.map((e, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs"
                            >
                              <code className="text-red-600 dark:text-red-400 line-through">
                                {e.original}
                              </code>
                              <Badge variant="secondary" className="text-[10px]">
                                {e.replacement}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter a transcript to scan for PII.
                </p>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleProcess}
            disabled={isProcessing || !isKeySet || !transcript.trim() || !selectedClientId}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                {processingStep}
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Process with AI
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
