"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface AudioRecorderResult {
  state: RecordingState;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  base64Data: string | null;
  mimeType: string;
  error: string | null;
  analyserNode: AnalyserNode | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
}

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "audio/webm";
}

export function useAudioRecorder(
  externalStream?: MediaStream | null
): AudioRecorderResult {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("audio/webm");
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close();
      }
      // Only stop stream if we own it (not external)
      if (!externalStream && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [externalStream, audioUrl]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedDurationRef.current * 1000;
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Strip the data:audio/...;base64, prefix
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setBase64Data(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;

    try {
      // Use external stream if provided, otherwise get mic
      let stream: MediaStream;
      if (externalStream) {
        stream = externalStream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          },
        });
      }
      streamRef.current = stream;

      // Set up Web Audio API for waveform analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      setAnalyserNode(analyser);

      // Set up MediaRecorder
      const mime = getSupportedMimeType();
      setMimeType(mime);
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 128000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        try {
          const b64 = await blobToBase64(blob);
          setBase64Data(b64);
        } catch {
          console.error("Failed to convert recording to base64");
        }

        setState("stopped");
      };

      // Collect data every 250ms for responsive stopping
      recorder.start(250);
      setState("recording");
      setDuration(0);
      startTimer();
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow mic access and try again."
          : err instanceof DOMException && err.name === "NotFoundError"
          ? "No microphone found. Please connect a mic and try again."
          : "Failed to start recording. Please check your microphone.";
      setError(message);
      setState("idle");
    }
  }, [externalStream, blobToBase64, startTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      pausedDurationRef.current = duration;
      stopTimer();
      setState("paused");
    }
  }, [duration, stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimer();
      setState("recording");
    }
  }, [startTimer]);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    // Only stop our own stream, not external
    if (!externalStream && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
      setAnalyserNode(null);
    }
  }, [externalStream, stopTimer]);

  const resetRecording = useCallback(() => {
    stopTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (!externalStream && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
      setAnalyserNode(null);
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setBase64Data(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
    setState("idle");
  }, [externalStream, audioUrl, stopTimer]);

  return {
    state,
    duration,
    audioBlob,
    audioUrl,
    base64Data,
    mimeType,
    error,
    analyserNode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}
