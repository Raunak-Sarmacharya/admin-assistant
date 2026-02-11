export const APP_NAME = "Admin Assistant";
export const APP_DESCRIPTION = "AI Admin Assistant for Wealth Management";

export const API_KEY_STORAGE_KEY = "admin-assistant-api-key";
export const MODEL_STORAGE_KEY = "admin-assistant-model";
export const PROVIDER_STORAGE_KEY = "admin-assistant-provider";

export type ProviderOption = "openai" | "google";

export const PROVIDERS = [
  {
    id: "google" as const,
    name: "Google Gemini",
    description: "Free tier available",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai" as const,
    name: "OpenAI",
    description: "Requires billing",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
] as const;

export const RISK_TOLERANCE_COLORS: Record<string, string> = {
  Conservative: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Balanced: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Growth: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Aggressive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export const STATUS_COLORS: Record<string, string> = {
  processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  review_needed: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300",
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-stone-100 text-stone-600 dark:bg-stone-900/30 dark:text-stone-400",
};

export const MOCK_INTEGRATIONS = [
  { name: "Wealthbox CRM", connected: true, icon: "database" },
  { name: "Charles Schwab", connected: true, icon: "landmark" },
  { name: "Fidelity", connected: true, icon: "landmark" },
  { name: "SharePoint", connected: false, icon: "folder" },
  { name: "Zoom", connected: true, icon: "video" },
] as const;
