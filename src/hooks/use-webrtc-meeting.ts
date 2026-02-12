"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type MeetingRole = "host" | "guest";
export type ConnectionState =
  | "idle"
  | "waiting"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export interface WebRTCMeetingResult {
  connectionState: ConnectionState;
  role: MeetingRole;
  peerJoined: boolean;
  localStream: MediaStream | null;
  mixedStream: MediaStream | null;
  error: string | null;
  join: (roomId: string, role: MeetingRole) => Promise<void>;
  leave: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function useWebRTCMeeting(): WebRTCMeetingResult {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [role, setRole] = useState<MeetingRole>("host");
  const [peerJoined, setPeerJoined] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mixedStream, setMixedStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescRef = useRef(false);

  // Cleanup everything
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    mixedDestRef.current = null;
    hasRemoteDescRef.current = false;
    iceCandidateQueueRef.current = [];
    setLocalStream(null);
    setMixedStream(null);
    setPeerJoined(false);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Process queued ICE candidates once remote description is set
  const processIceCandidateQueue = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !hasRemoteDescRef.current) return;

    for (const candidate of iceCandidateQueueRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Failed to add queued ICE candidate:", e);
      }
    }
    iceCandidateQueueRef.current = [];
  }, []);

  // Create mixed audio stream from local + remote
  const createMixedStream = useCallback(
    (local: MediaStream, remote: MediaStream) => {
      try {
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        mixedDestRef.current = dest;

        const localSource = ctx.createMediaStreamSource(local);
        localSource.connect(dest);

        const remoteSource = ctx.createMediaStreamSource(remote);
        remoteSource.connect(dest);

        setMixedStream(dest.stream);
      } catch (e) {
        console.error("Failed to mix audio streams:", e);
      }
    },
    []
  );

  const join = useCallback(
    async (roomId: string, meetingRole: MeetingRole) => {
      setError(null);
      setRole(meetingRole);
      setConnectionState("waiting");

      try {
        // 1. Get local mic stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        // 2. Create RTCPeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local audio tracks to the connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle incoming remote tracks
        pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
          if (remoteStream && localStreamRef.current) {
            createMixedStream(localStreamRef.current, remoteStream);
          }
        };

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
          switch (pc.connectionState) {
            case "connected":
              setConnectionState("connected");
              setPeerJoined(true);
              break;
            case "disconnected":
              setConnectionState("disconnected");
              break;
            case "failed":
              setConnectionState("failed");
              setError("Connection failed. The other party may have left.");
              break;
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            setConnectionState("connected");
            setPeerJoined(true);
          }
        };

        // 3. Set up Supabase Realtime channel for signaling
        const supabase = createClient();
        const channel = supabase.channel(`meeting-${roomId}`, {
          config: { broadcast: { ack: false, self: false } },
        });
        channelRef.current = channel;

        // Handle ICE candidates via broadcast
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: {
                candidate: event.candidate.toJSON(),
                from: meetingRole,
              },
            });
          }
        };

        // Listen for signaling messages
        channel.on(
          "broadcast",
          { event: "sdp-offer" },
          async ({ payload }) => {
            if (meetingRole === "guest" && payload?.sdp) {
              try {
                setConnectionState("connecting");
                await pc.setRemoteDescription(
                  new RTCSessionDescription(payload.sdp)
                );
                hasRemoteDescRef.current = true;
                await processIceCandidateQueue();

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                channel.send({
                  type: "broadcast",
                  event: "sdp-answer",
                  payload: { sdp: answer, from: "guest" },
                });
              } catch (e) {
                console.error("Failed to handle SDP offer:", e);
                setError("Failed to establish connection.");
              }
            }
          }
        );

        channel.on(
          "broadcast",
          { event: "sdp-answer" },
          async ({ payload }) => {
            if (meetingRole === "host" && payload?.sdp) {
              try {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(payload.sdp)
                );
                hasRemoteDescRef.current = true;
                await processIceCandidateQueue();
              } catch (e) {
                console.error("Failed to handle SDP answer:", e);
              }
            }
          }
        );

        channel.on(
          "broadcast",
          { event: "ice-candidate" },
          async ({ payload }) => {
            if (payload?.from !== meetingRole && payload?.candidate) {
              if (hasRemoteDescRef.current) {
                try {
                  await pc.addIceCandidate(
                    new RTCIceCandidate(payload.candidate)
                  );
                } catch (e) {
                  console.warn("Failed to add ICE candidate:", e);
                }
              } else {
                // Queue candidate until remote description is set
                iceCandidateQueueRef.current.push(payload.candidate);
              }
            }
          }
        );

        // Listen for peer presence
        channel.on(
          "broadcast",
          { event: "peer-joined" },
          async ({ payload }) => {
            if (payload?.role !== meetingRole) {
              setPeerJoined(true);
              // Host creates the offer when guest joins
              if (meetingRole === "host") {
                try {
                  setConnectionState("connecting");
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);

                  channel.send({
                    type: "broadcast",
                    event: "sdp-offer",
                    payload: { sdp: offer, from: "host" },
                  });
                } catch (e) {
                  console.error("Failed to create SDP offer:", e);
                  setError("Failed to initiate connection.");
                }
              }
            }
          }
        );

        channel.on("broadcast", { event: "peer-left" }, ({ payload }) => {
          if (payload?.role !== meetingRole) {
            setPeerJoined(false);
            setConnectionState("disconnected");
          }
        });

        // Subscribe and announce presence
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Announce our presence
            await channel.send({
              type: "broadcast",
              event: "peer-joined",
              payload: { role: meetingRole },
            });
          }
        });
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Microphone access denied. Please allow mic access."
            : err instanceof DOMException && err.name === "NotFoundError"
            ? "No microphone found. Please connect a mic."
            : "Failed to join meeting.";
        setError(message);
        setConnectionState("failed");
        cleanup();
      }
    },
    [cleanup, createMixedStream, processIceCandidateQueue]
  );

  const leave = useCallback(() => {
    // Notify peer we're leaving
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "peer-left",
        payload: { role },
      });
    }
    cleanup();
    setConnectionState("idle");
  }, [role, cleanup]);

  return {
    connectionState,
    role,
    peerJoined,
    localStream,
    mixedStream,
    error,
    join,
    leave,
  };
}
