import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AIProviderType = "openai" | "google";

export function detectProvider(model: string): AIProviderType {
  if (model.startsWith("gemini")) return "google";
  return "openai";
}

export function createAIProvider(apiKey: string, model: string) {
  const providerType = detectProvider(model);

  if (providerType === "google") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  }

  const openai = createOpenAI({ apiKey });
  return openai(model);
}

export function parseAIError(error: unknown): { message: string; isQuota: boolean } {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota exceeded") ||
    lower.includes("rate_limit") ||
    lower.includes("429")
  ) {
    return {
      message:
        "Quota exceeded for this model. Try a different model (e.g. gemini-2.0-flash) or wait a minute and retry.",
      isQuota: true,
    };
  }

  if (lower.includes("invalid api key") || lower.includes("invalid_api_key") || lower.includes("api_key_invalid")) {
    return {
      message: "Invalid API key. Please check your key in Settings.",
      isQuota: false,
    };
  }

  if (lower.includes("model_not_found") || lower.includes("not found")) {
    return {
      message: "The selected model is not available. Try a different model.",
      isQuota: false,
    };
  }

  return { message: raw || "An unexpected AI error occurred.", isQuota: false };
}
