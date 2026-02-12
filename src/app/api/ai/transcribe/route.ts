import { createAIProvider, parseAIError } from "@/lib/ai/provider";
import { TRANSCRIPTION_PROMPT } from "@/lib/ai/prompts";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — Gemini inline limit

const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
]);

const SUPPORTED_TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export async function POST(req: NextRequest) {
  try {
    const { apiKey, fileData, mimeType, fileName, model, mode } =
      await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401 }
      );
    }

    if (!fileData) {
      return NextResponse.json(
        { error: "File data is required" },
        { status: 400 }
      );
    }

    // Validate file size (base64 is ~33% larger than binary)
    const estimatedSize = (fileData.length * 3) / 4;
    if (estimatedSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 413 }
      );
    }

    const selectedModel = model || "gemini-2.0-flash";
    const aiModel = createAIProvider(apiKey, selectedModel);

    // Mode: "audio" for audio transcription, "text" for text extraction
    if (mode === "text") {
      // For text files, decode base64 directly
      const textContent = Buffer.from(fileData, "base64").toString("utf-8");
      return NextResponse.json({
        data: {
          transcript: textContent,
          source: "file_upload",
          fileName,
        },
      });
    }

    // Audio transcription via multimodal AI
    // Strip codec params (e.g. "audio/webm;codecs=opus" → "audio/webm")
    const baseMime = mimeType.split(";")[0].trim();
    if (!SUPPORTED_AUDIO_TYPES.has(baseMime)) {
      return NextResponse.json(
        {
          error: `Unsupported audio format: ${mimeType}. Supported: MP3, WAV, WebM, OGG, M4A.`,
        },
        { status: 400 }
      );
    }

    const result = await generateText({
      model: aiModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TRANSCRIPTION_PROMPT },
            {
              type: "file",
              mediaType: baseMime as `audio/${string}`,
              data: fileData,
            },
          ],
        },
      ],
    });

    if (!result.text || result.text.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not transcribe audio. The recording may be empty or unclear." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      data: {
        transcript: result.text.trim(),
        source: "audio_transcription",
        fileName,
        tokensUsed: result.usage?.totalTokens || 0,
      },
    });
  } catch (error: unknown) {
    const { message, isQuota } = parseAIError(error);
    console.error("Transcription error:", message);
    return NextResponse.json(
      { error: message, isQuota },
      { status: isQuota ? 402 : 500 }
    );
  }
}
