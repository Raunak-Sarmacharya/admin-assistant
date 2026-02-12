export interface AIModel {
  id: string;
  name: string;
  provider: "google" | "openai";
}

// Models known to have free tier quota on Google AI Studio
const GOOGLE_FREE_TIER_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-pro-preview-05-06",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash-thinking-exp",
]);

export async function fetchGoogleModels(apiKey: string): Promise<AIModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error("Failed to fetch Google models");

  const data = await res.json();
  const models: AIModel[] = [];

  for (const m of data.models || []) {
    const methods: string[] = m.supportedGenerationMethods || [];
    if (!methods.includes("generateContent")) continue;

    const id: string = m.baseModelId || m.name?.replace("models/", "") || "";
    if (!id) continue;

    // Skip embedding-only, vision-only, and deprecated models
    if (id.includes("embedding") || id.includes("aqa")) continue;

    // Check known free tier — but exclude "lite" variants which often have 0 quota
    const isLite = id.includes("lite");
    const isFree = !isLite && (
      GOOGLE_FREE_TIER_MODELS.has(id) ||
      id.startsWith("gemini-2.5") ||
      id === "gemini-2.0-flash" ||
      id === "gemini-1.5-flash" ||
      id === "gemini-1.5-pro");

    models.push({
      id,
      name: (m.displayName || id) + (isFree ? "" : " (may require billing)"),
      provider: "google",
    });
  }

  // Sort: gemini-2.5-flash first, then free-tier, then alphabetical
  models.sort((a, b) => {
    const aIs25Flash = a.id === "gemini-2.5-flash";
    const bIs25Flash = b.id === "gemini-2.5-flash";
    if (aIs25Flash !== bIs25Flash) return aIs25Flash ? -1 : 1;
    const aIs25 = a.id.startsWith("gemini-2.5");
    const bIs25 = b.id.startsWith("gemini-2.5");
    if (aIs25 !== bIs25) return aIs25 ? -1 : 1;
    const aFree = !a.name.includes("may require billing");
    const bFree = !b.name.includes("may require billing");
    if (aFree !== bFree) return aFree ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return models;
}

export async function fetchOpenAIModels(apiKey: string): Promise<AIModel[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error("Failed to fetch OpenAI models");

  const data = await res.json();
  const models: AIModel[] = [];

  const chatPrefixes = ["gpt-4", "gpt-3.5", "o1", "o3", "o4"];

  for (const m of data.data || []) {
    const id: string = m.id || "";
    if (!chatPrefixes.some((p) => id.startsWith(p))) continue;
    if (id.includes("realtime") || id.includes("audio") || id.includes("transcribe")) continue;

    models.push({
      id,
      name: id,
      provider: "openai",
    });
  }

  models.sort((a, b) => a.name.localeCompare(b.name));
  return models;
}

export async function fetchModels(
  provider: "google" | "openai",
  apiKey: string
): Promise<AIModel[]> {
  if (provider === "google") return fetchGoogleModels(apiKey);
  return fetchOpenAIModels(apiKey);
}

export const DEFAULT_MODELS: Record<string, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o",
};
