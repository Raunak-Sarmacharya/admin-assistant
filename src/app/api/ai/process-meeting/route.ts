import { createAIProvider, parseAIError } from "@/lib/ai/provider";
import { getMeetingProcessorPrompt } from "@/lib/ai/prompts";
import { MeetingOutputSchema } from "@/lib/ai/schemas";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, transcript, clientName, riskTolerance, aumValue, model } =
      await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401 }
      );
    }

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    const selectedModel = model || "gemini-2.0-flash";
    const aiModel = createAIProvider(apiKey, selectedModel);
    const systemPrompt = getMeetingProcessorPrompt(
      clientName || "Client",
      riskTolerance || "Balanced",
      aumValue || 0
    );

    const result = await generateObject({
      model: aiModel,
      schema: MeetingOutputSchema,
      system: systemPrompt,
      prompt: `Process this meeting transcript:\n\n${transcript}`,
    });

    return NextResponse.json({ data: result.object });
  } catch (error: unknown) {
    const { message, isQuota } = parseAIError(error);
    console.error("Process meeting error:", message);
    return NextResponse.json(
      { error: message, isQuota },
      { status: isQuota ? 402 : 500 }
    );
  }
}
