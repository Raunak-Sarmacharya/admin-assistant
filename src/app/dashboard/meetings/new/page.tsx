"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiKey } from "@/hooks/use-api-key";
import { createClient } from "@/lib/supabase/client";
import { redactPII, getPIISummary } from "@/lib/utils/pii-redaction";
import { SAMPLE_TRANSCRIPTS } from "@/data/sample-transcripts";
import { FileUploadZone } from "@/components/meeting/file-upload-zone";
import type { UploadedFile } from "@/components/meeting/file-upload-zone";
import {
  ProcessingPipeline,
  createPipelineSteps,
} from "@/components/meeting/processing-pipeline";
import type { PipelineStep } from "@/components/meeting/processing-pipeline";
import { AudioRecorder } from "@/components/meeting/audio-recorder";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  ShieldAlert,
  FileText,
  Sparkles,
  Lock,
  Mic,
  FileUp,
  ClipboardPaste,
  Radio,
  Video,
} from "lucide-react";
import type { Client, MeetingSourceType } from "@/types/database";
import Link from "next/link";

type InputMode = "paste" | "audio" | "file" | "record";

export default function NewMeetingPage() {
  const router = useRouter();
  const { apiKey, model, isKeySet, isLoaded } = useApiKey();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const recorder = useAudioRecorder();

  // Load clients
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

  // Pick up recording from online meeting room via sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "room") return;

    const stored = sessionStorage.getItem("meeting-recording");
    if (!stored) return;

    try {
      const data = JSON.parse(stored) as {
        base64: string;
        mimeType: string;
        duration: number;
      };
      // Synthesize an UploadedFile-like object for the audio tab flow
      setUploadedFile({
        file: new File([], "online-meeting-recording.webm"),
        base64: data.base64,
        mimeType: data.mimeType,
        preview: {
          name: `online-meeting-recording.webm`,
          size: `${Math.round((data.base64.length * 3) / 4 / 1024)} KB`,
          type: "audio",
        },
      });
      setInputMode("audio");
      if (!title) setTitle("Online Meeting Recording");
      sessionStorage.removeItem("meeting-recording");
      toast.info("Recording loaded from online meeting room");
    } catch {
      console.error("Failed to load meeting recording from sessionStorage");
    }
  }, [title]);

  const updateStep = useCallback(
    (stepId: string, status: PipelineStep["status"], description?: string) => {
      setPipelineSteps((prev) =>
        prev.map((s) =>
          s.id === stepId
            ? { ...s, status, ...(description ? { description } : {}) }
            : s
        )
      );
    },
    []
  );

  function handleLoadSample(index: number) {
    const sample = SAMPLE_TRANSCRIPTS[index];
    setTranscript(sample.transcript);
    setTitle(sample.title);
    setInputMode("paste");
    const match = clients.find(
      (c) =>
        c.name.toLowerCase().includes(sample.clientHint.toLowerCase()) ||
        sample.clientHint.toLowerCase().includes(c.name.toLowerCase())
    );
    if (match) setSelectedClientId(match.id);
    toast.info(`Loaded sample: ${sample.title}`);
  }

  function handleFileReady(uploaded: UploadedFile) {
    setUploadedFile(uploaded);
    if (!title) {
      const nameWithoutExt = uploaded.preview.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExt);
    }
  }

  function handleFileClear() {
    setUploadedFile(null);
    if (inputMode !== "paste") setTranscript("");
  }

  function handleTabChange(value: string) {
    const mode = value as InputMode;
    setInputMode(mode);
    if (mode === "paste") {
      setUploadedFile(null);
    } else {
      // Keep transcript if switching between upload modes
    }
  }

  function getSourceType(): MeetingSourceType {
    if (inputMode === "audio" || inputMode === "record") return "audio_upload";
    if (inputMode === "file") return "file_upload";
    return "paste";
  }

  function hasValidInput(): boolean {
    if (inputMode === "paste") return transcript.trim().length > 0;
    if (inputMode === "record") return recorder.base64Data !== null;
    return uploadedFile !== null;
  }

  async function handleProcess() {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    if (!hasValidInput()) {
      toast.error(
        inputMode === "paste"
          ? "Please enter a transcript"
          : "Please upload a file"
      );
      return;
    }
    if (!isKeySet) {
      toast.error("Please configure your API key in Settings");
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    setIsProcessing(true);

    // Initialize pipeline steps based on mode
    const steps = createPipelineSteps(inputMode);
    setPipelineSteps(steps);

    const supabase = createClient();
    let workingTranscript = transcript;

    try {
      // ── Step: Upload + Transcribe (for audio/file/record modes) ──
      if (inputMode === "record" && recorder.base64Data) {
        updateStep("upload", "running", "Preparing recording...");
        await new Promise((r) => setTimeout(r, 300));
        updateStep("upload", "complete", "Recording ready");

        updateStep("transcribe", "running", "AI is transcribing recording...");
        const transcribeRes = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            fileData: recorder.base64Data,
            mimeType: recorder.mimeType,
            fileName: `recording-${new Date().toISOString().slice(0, 10)}.webm`,
            model,
            mode: "audio",
          }),
        });

        if (!transcribeRes.ok) {
          const errData = await transcribeRes.json();
          if (errData.isQuota) {
            toast.error(errData.error, {
              description: "Go to Settings → switch to Google Gemini (free).",
              duration: 8000,
            });
            updateStep("transcribe", "error", "Quota exceeded");
            return;
          }
          throw new Error(errData.error || "Transcription failed");
        }

        const { data: recTranscribeData } = await transcribeRes.json();
        workingTranscript = recTranscribeData.transcript;
        setTranscript(workingTranscript);
        updateStep(
          "transcribe",
          "complete",
          `${workingTranscript.split(/\s+/).length} words transcribed`
        );
      } else if (inputMode === "audio" && uploadedFile) {
        updateStep("upload", "running", "Reading audio file...");
        // Small delay for visual feedback
        await new Promise((r) => setTimeout(r, 300));
        updateStep("upload", "complete", `${uploadedFile.preview.name} ready`);

        updateStep("transcribe", "running", "AI is transcribing audio...");
        const transcribeRes = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            fileData: uploadedFile.base64,
            mimeType: uploadedFile.mimeType,
            fileName: uploadedFile.preview.name,
            model,
            mode: "audio",
          }),
        });

        if (!transcribeRes.ok) {
          const errData = await transcribeRes.json();
          if (errData.isQuota) {
            toast.error(errData.error, {
              description: "Go to Settings → switch to Google Gemini (free).",
              duration: 8000,
            });
            updateStep("transcribe", "error", "Quota exceeded");
            return;
          }
          throw new Error(errData.error || "Transcription failed");
        }

        const { data: transcribeData } = await transcribeRes.json();
        workingTranscript = transcribeData.transcript;
        setTranscript(workingTranscript);
        updateStep(
          "transcribe",
          "complete",
          `${workingTranscript.split(/\s+/).length} words transcribed`
        );
      } else if (inputMode === "file" && uploadedFile) {
        updateStep("upload", "running", "Extracting text content...");
        const transcribeRes = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            fileData: uploadedFile.base64,
            mimeType: uploadedFile.mimeType,
            fileName: uploadedFile.preview.name,
            model,
            mode: "text",
          }),
        });

        if (!transcribeRes.ok) {
          const errData = await transcribeRes.json();
          throw new Error(errData.error || "File extraction failed");
        }

        const { data: fileData } = await transcribeRes.json();
        workingTranscript = fileData.transcript;
        setTranscript(workingTranscript);
        updateStep(
          "upload",
          "complete",
          `${workingTranscript.split(/\s+/).length} words extracted`
        );
      }

      // ── Step: PII Redaction ──
      updateStep("pii", "running", "Scanning for sensitive data...");
      const { redactedText, entities } = redactPII(workingTranscript);
      updateStep(
        "pii",
        "complete",
        entities.length > 0
          ? `${entities.length} PII item${entities.length !== 1 ? "s" : ""} redacted`
          : "No PII detected"
      );

      // ── Create meeting record ──
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          client_id: selectedClientId,
          title: title || "Untitled Meeting",
          transcript_text: workingTranscript,
          transcript_redacted: redactedText,
          pii_entities: entities,
          source_type: getSourceType(),
          source_file_name: uploadedFile?.preview.name || null,
          status: "processing",
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // ── Step: AI Analysis ──
      updateStep("ai", "running", "Generating summary, tasks & email...");
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
          await supabase.from("meetings").delete().eq("id", meeting.id);
          toast.error(errData.error, {
            description: "Go to Settings → switch to Google Gemini (free).",
            duration: 8000,
          });
          updateStep("ai", "error", "Quota exceeded");
          return;
        }
        throw new Error(errData.error || "AI processing failed");
      }

      const { data: aiOutput } = await aiRes.json();
      updateStep(
        "ai",
        "complete",
        `${aiOutput.tasks?.length || 0} tasks extracted`
      );

      // Save meeting output
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

      // Save tasks
      if (aiOutput.tasks && aiOutput.tasks.length > 0) {
        const taskInserts = aiOutput.tasks.map(
          (t: {
            description: string;
            priority: string;
            due_date_suggestion: string | null;
          }) => ({
            meeting_id: meeting.id,
            client_id: selectedClientId,
            description: t.description,
            priority: t.priority,
            due_date: t.due_date_suggestion,
          })
        );
        await supabase.from("tasks").insert(taskInserts);
      }

      // ── Step: Compliance Scan ──
      updateStep("compliance", "running", "Running FINRA & SEC review...");
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
          const flagInserts = complianceData.flags.map(
            (f: {
              flagged_text: string;
              risk_category: string;
              severity: string;
              explanation: string;
            }) => ({
              meeting_output_id: output.id,
              flagged_text: f.flagged_text,
              risk_category: f.risk_category,
              severity: f.severity,
              explanation: f.explanation,
            })
          );
          await supabase.from("compliance_flags").insert(flagInserts);
          updateStep(
            "compliance",
            "complete",
            `${complianceData.flags.length} flag${complianceData.flags.length !== 1 ? "s" : ""} found`
          );
        } else {
          updateStep("compliance", "complete", "No compliance issues");
        }
      } else {
        updateStep("compliance", "complete", "Scan complete");
      }

      // ── Step: Complete ──
      await supabase
        .from("meetings")
        .update({ status: "review_needed" })
        .eq("id", meeting.id);

      updateStep("done", "complete", "Meeting ready for review");
      toast.success("Meeting processed successfully!");

      // Brief pause to show the completed pipeline before navigating
      await new Promise((r) => setTimeout(r, 800));
      router.push(`/dashboard/meetings/${meeting.id}`);
    } catch (error) {
      console.error("Processing error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to process meeting"
      );
      // Mark current running step as error
      setPipelineSteps((prev) =>
        prev.map((s) =>
          s.status === "running"
            ? { ...s, status: "error" as const, description: "Failed" }
            : s
        )
      );
    } finally {
      setIsProcessing(false);
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
          Record, paste, or upload — AI handles the rest.
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
              Configure your API key to use AI features.
            </p>
          </div>
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: Input Area ── */}
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Tabs
                value={inputMode}
                onValueChange={handleTabChange}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="paste" className="flex-1 gap-1.5">
                    <ClipboardPaste className="size-3.5" />
                    Paste
                  </TabsTrigger>
                  <TabsTrigger value="record" className="flex-1 gap-1.5">
                    <Radio className="size-3.5" />
                    Record
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="flex-1 gap-1.5">
                    <Mic className="size-3.5" />
                    Upload Audio
                  </TabsTrigger>
                  <TabsTrigger value="file" className="flex-1 gap-1.5">
                    <FileUp className="size-3.5" />
                    Upload Notes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="mt-4 space-y-3">
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
                        disabled={isProcessing}
                      >
                        <FileText className="size-3 mr-1" />
                        {sample.title}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Paste the meeting transcript here..."
                    className="min-h-[300px] font-mono text-sm"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    disabled={isProcessing}
                  />
                </TabsContent>

                <TabsContent value="audio" className="mt-4 space-y-3">
                  <FileUploadZone
                    accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                    maxSizeMB={20}
                    fileType="audio"
                    onFileReady={handleFileReady}
                    onFileClear={handleFileClear}
                    uploadedFile={uploadedFile}
                    disabled={isProcessing}
                  />
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>How it works:</strong> Your audio file is sent to
                      the AI model for transcription. The transcript is then
                      processed through our full pipeline — PII redaction, AI
                      analysis, and compliance scan. Supports MP3, WAV, M4A,
                      WebM, and OGG formats up to 20MB.
                    </p>
                  </div>
                  {transcript && inputMode === "audio" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Transcribed Text</Label>
                      <Textarea
                        className="min-h-[200px] font-mono text-xs"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="record" className="mt-4 space-y-3">
                  <AudioRecorder
                    state={recorder.state}
                    duration={recorder.duration}
                    audioUrl={recorder.audioUrl}
                    error={recorder.error}
                    analyserNode={recorder.analyserNode}
                    onStart={recorder.startRecording}
                    onPause={recorder.pauseRecording}
                    onResume={recorder.resumeRecording}
                    onStop={recorder.stopRecording}
                    onReset={recorder.resetRecording}
                    disabled={isProcessing}
                  />
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>How it works:</strong> Record directly from your
                      device microphone. When you stop, the recording is sent
                      to AI for transcription, then processed through the full
                      pipeline. Ideal for in-person meetings.
                    </p>
                  </div>
                  {transcript && inputMode === "record" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Transcribed Text</Label>
                      <Textarea
                        className="min-h-[200px] font-mono text-xs"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="file" className="mt-4 space-y-3">
                  <FileUploadZone
                    accept=".txt,.md,.csv"
                    maxSizeMB={5}
                    fileType="text"
                    onFileReady={handleFileReady}
                    onFileClear={handleFileClear}
                    uploadedFile={uploadedFile}
                    disabled={isProcessing}
                  />
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>How it works:</strong> Upload meeting notes or
                      exported transcripts. Text is extracted and processed
                      through our full pipeline. Supports TXT, Markdown, and CSV
                      files up to 5MB.
                    </p>
                  </div>
                  {transcript && inputMode === "file" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Extracted Text</Label>
                      <Textarea
                        className="min-h-[200px] font-mono text-xs"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Pipeline + PII Vault ── */}
        <div className="space-y-4">
          {/* Processing Pipeline — shows during/after processing */}
          {pipelineSteps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4" />
                  Processing Pipeline
                </CardTitle>
                <CardDescription>
                  {isProcessing
                    ? "AI is analyzing your meeting..."
                    : "Pipeline complete"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProcessingPipeline steps={pipelineSteps} />
              </CardContent>
            </Card>
          )}

          {/* PII Vault */}
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
                  {inputMode === "paste"
                    ? "Enter a transcript to scan for PII."
                    : "Upload a file to scan for PII."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Source Badge */}
          {(inputMode !== "paste" || uploadedFile) && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              {inputMode === "audio" ? (
                <Mic className="size-3.5 text-muted-foreground" />
              ) : inputMode === "file" ? (
                <FileUp className="size-3.5 text-muted-foreground" />
              ) : (
                <ClipboardPaste className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                Source:{" "}
                <span className="font-medium text-foreground">
                  {inputMode === "audio"
                    ? "Audio Recording"
                    : inputMode === "file"
                    ? "Uploaded Document"
                    : "Pasted Text"}
                </span>
              </span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleProcess}
            disabled={
              isProcessing ||
              !isKeySet ||
              !hasValidInput() ||
              !selectedClientId
            }
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Process with AI
              </>
            )}
          </Button>

          {/* Start Online Meeting */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Video className="size-3.5" />
              Online Meeting
            </p>
            <p className="text-xs text-muted-foreground">
              Start a live meeting room with a shareable link. Both sides are
              recorded and transcribed.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={() => {
                const roomId = crypto.randomUUID();
                window.open(`/meeting/${roomId}`, "_blank");
              }}
              disabled={!isKeySet}
            >
              <Video className="size-3" />
              Start Online Meeting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
