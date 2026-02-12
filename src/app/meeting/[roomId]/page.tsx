"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AudioRecorder } from "@/components/meeting/audio-recorder";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useWebRTCMeeting } from "@/hooks/use-webrtc-meeting";
import type { MeetingRole } from "@/hooks/use-webrtc-meeting";
import { useApiKey } from "@/hooks/use-api-key";
import { toast } from "sonner";
import {
  Video,
  Copy,
  Check,
  Users,
  Wifi,
  WifiOff,
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  ArrowRight,
  Shield,
} from "lucide-react";

export default function MeetingRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { isKeySet } = useApiKey();

  const [hasJoined, setHasJoined] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MeetingRole>("host");
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const meeting = useWebRTCMeeting();
  // Record from the mixed stream when both are connected, else from local stream
  const recordingStream =
    meeting.connectionState === "connected" && meeting.mixedStream
      ? meeting.mixedStream
      : meeting.localStream;
  const recorder = useAudioRecorder(recordingStream);

  // Auto-detect role from URL hash
  useEffect(() => {
    if (window.location.hash === "#guest") {
      setSelectedRole("guest");
    }
  }, []);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/meeting/${roomId}#guest`
      : "";

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Meeting link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [shareUrl]);

  const handleJoin = useCallback(async () => {
    await meeting.join(roomId, selectedRole);
    setHasJoined(true);
  }, [meeting, roomId, selectedRole]);

  const handleLeave = useCallback(() => {
    if (recorder.state === "recording" || recorder.state === "paused") {
      recorder.stopRecording();
    }
    meeting.leave();
    setHasJoined(false);
  }, [meeting, recorder]);

  const handleToggleMute = useCallback(() => {
    if (meeting.localStream) {
      meeting.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, [meeting.localStream]);

  const connectionColor = {
    idle: "text-muted-foreground",
    waiting: "text-yellow-600",
    connecting: "text-yellow-600",
    connected: "text-green-600",
    disconnected: "text-orange-600",
    failed: "text-destructive",
  }[meeting.connectionState];

  const connectionLabel = {
    idle: "Not connected",
    waiting: "Waiting for peer...",
    connecting: "Connecting...",
    connected: "Connected",
    disconnected: "Peer disconnected",
    failed: "Connection failed",
  }[meeting.connectionState];

  // ── Pre-join screen ──
  if (!hasJoined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 mb-2">
              <Video className="size-6 text-primary" />
            </div>
            <CardTitle>Join Meeting Room</CardTitle>
            <CardDescription>
              Room: {roomId.slice(0, 8)}...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Your Role</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedRole === "host" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRole("host")}
                  className="gap-1.5"
                >
                  <Shield className="size-3.5" />
                  Host (Advisor)
                </Button>
                <Button
                  variant={selectedRole === "guest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRole("guest")}
                  className="gap-1.5"
                >
                  <Users className="size-3.5" />
                  Guest (Client)
                </Button>
              </div>
            </div>

            {selectedRole === "host" && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Share with client</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedRole === "host" ? (
                  <>
                    <strong>As host:</strong> You control recording. Share the
                    link with your client, then join. Once both are connected,
                    record the meeting and process it through the AI pipeline.
                  </>
                ) : (
                  <>
                    <strong>As guest:</strong> Your audio will be captured and
                    recorded by the host. The meeting is end-to-end encrypted
                    via WebRTC peer-to-peer connection.
                  </>
                )}
              </p>
            </div>

            <Button className="w-full gap-2" onClick={handleJoin}>
              <Mic className="size-4" />
              Join Meeting
            </Button>

            {meeting.error && (
              <p className="text-xs text-destructive text-center">
                {meeting.error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── In-meeting screen ──
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Video className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium">
              Meeting Room
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {roomId.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`gap-1.5 text-xs ${connectionColor}`}>
            {meeting.connectionState === "connected" ? (
              <Wifi className="size-3" />
            ) : meeting.connectionState === "waiting" ||
              meeting.connectionState === "connecting" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <WifiOff className="size-3" />
            )}
            {connectionLabel}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {selectedRole === "host" ? "Host" : "Guest"}
          </Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Connection status card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary/10">
                      <Mic className="size-4 text-primary" />
                    </div>
                    <div
                      className={`flex size-9 items-center justify-center rounded-full border-2 border-background ${
                        meeting.peerJoined
                          ? "bg-green-100 dark:bg-green-900/30"
                          : "bg-muted"
                      }`}
                    >
                      <Users
                        className={`size-4 ${
                          meeting.peerJoined
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {meeting.peerJoined
                        ? "Both participants connected"
                        : "Waiting for the other participant..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meeting.peerJoined
                        ? "Audio is flowing between both sides"
                        : "Share the meeting link to invite them"}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="icon"
                    className="size-9"
                    onClick={handleToggleMute}
                  >
                    {isMuted ? (
                      <MicOff className="size-4" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="size-9"
                    onClick={handleLeave}
                  >
                    <PhoneOff className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Share link (host only, before peer joins) */}
          {selectedRole === "host" && !meeting.peerJoined && (
            <Card>
              <CardContent className="pt-6">
                <Label className="text-xs font-medium">
                  Share this link with your client
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recording (host only) */}
          {selectedRole === "host" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Meeting Recording</CardTitle>
                <CardDescription>
                  {meeting.connectionState === "connected"
                    ? "Recording captures both sides of the conversation."
                    : "Start recording once your client has joined."}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  compact
                />
              </CardContent>
            </Card>
          )}

          {/* Guest view - simple status */}
          {selectedRole === "guest" && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">
                    {meeting.connectionState === "connected"
                      ? "You are connected to the meeting"
                      : "Connecting to the meeting host..."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The host is recording this meeting. Your audio is being
                    transmitted via a secure peer-to-peer connection.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Process recording (host only, after recording stopped) */}
          {selectedRole === "host" &&
            recorder.state === "stopped" &&
            recorder.base64Data && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Recording ready to process
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Send this recording through the AI pipeline for
                        transcription, analysis, and compliance review.
                      </p>
                    </div>
                    <Button
                      className="gap-1.5 shrink-0"
                      onClick={() => {
                        // Store recording data in sessionStorage for the process page
                        sessionStorage.setItem(
                          "meeting-recording",
                          JSON.stringify({
                            base64: recorder.base64Data,
                            mimeType: recorder.mimeType,
                            duration: recorder.duration,
                          })
                        );
                        window.open("/dashboard/meetings/new?source=room", "_blank");
                      }}
                      disabled={!isKeySet}
                    >
                      Process with AI
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          <Separator />

          <p className="text-center text-[10px] text-muted-foreground">
            Audio is transmitted peer-to-peer via WebRTC. No audio data passes
            through our servers. Signaling is handled via Supabase Realtime.
          </p>
        </div>
      </div>
    </div>
  );
}
