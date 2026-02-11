import { createAIProvider, parseAIError } from "@/lib/ai/provider";
import { COMPLIANCE_SENTINEL_PROMPT } from "@/lib/ai/prompts";
import { ComplianceFlagSchema } from "@/lib/ai/schemas";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, emailDraft, clientRiskTolerance, model } = await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401 }
      );
    }

    if (!emailDraft) {
      return NextResponse.json(
        { error: "Email draft is required" },
        { status: 400 }
      );
    }

    const selectedModel = model || "gemini-2.0-flash";
    const aiModel = createAIProvider(apiKey, selectedModel);

    const result = await generateObject({
      model: aiModel,
      schema: ComplianceFlagSchema,
      system: COMPLIANCE_SENTINEL_PROMPT,
      prompt: `Client risk tolerance: ${clientRiskTolerance || "Balanced"}\n\nReview this email draft for compliance issues:\n\n${emailDraft}`,
    });

    return NextResponse.json({ data: result.object });
  } catch (error: unknown) {
    const { message, isQuota } = parseAIError(error);
    console.error("Compliance check error:", message);
    return NextResponse.json(
      { error: message, isQuota },
      { status: isQuota ? 402 : 500 }
    );
  }
}
