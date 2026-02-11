"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiKey } from "@/hooks/use-api-key";
import { PROVIDERS, MOCK_INTEGRATIONS } from "@/lib/constants";
import type { ProviderOption } from "@/lib/constants";
import { fetchModels, DEFAULT_MODELS } from "@/lib/ai/models";
import type { AIModel } from "@/lib/ai/models";
import { toast } from "sonner";
import {
  Key, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  Database, Landmark, Video, Folder, RefreshCw,
} from "lucide-react";

const INTEGRATION_ICONS: Record<string, React.ElementType> = {
  database: Database,
  landmark: Landmark,
  video: Video,
  folder: Folder,
};

export default function SettingsPage() {
  const { apiKey, model, provider, setApiKey, setModel, setProvider, clearApiKey, isKeySet } =
    useApiKey();
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const activeProvider = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];

  const loadModels = useCallback(
    async (prov: ProviderOption, key: string) => {
      if (!key) {
        setAvailableModels([]);
        return;
      }
      setIsLoadingModels(true);
      try {
        const models = await fetchModels(prov, key);
        setAvailableModels(models);
      } catch {
        setAvailableModels([]);
        toast.error("Could not fetch models. Your key may be invalid.");
      } finally {
        setIsLoadingModels(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isKeySet && apiKey) {
      loadModels(provider, apiKey);
    }
  }, [isKeySet, apiKey, provider, loadModels]);

  function handleProviderChange(newProvider: ProviderOption) {
    setProvider(newProvider);
    setModel(DEFAULT_MODELS[newProvider] || "");
    setAvailableModels([]);
    if (isKeySet) {
      clearApiKey();
      toast.info("Provider changed — please enter a new API key.");
    }
  }

  async function handleSaveKey() {
    const key = keyInput.trim();
    if (!key) {
      toast.error("Please enter an API key");
      return;
    }
    setIsValidating(true);
    try {
      const models = await fetchModels(provider, key);
      if (models.length === 0) {
        toast.error("Invalid API key or no models available.");
        return;
      }
      setApiKey(key);
      setKeyInput("");
      setAvailableModels(models);
      const defaultId = DEFAULT_MODELS[provider];
      const hasDefault = models.some((m) => m.id === defaultId);
      setModel(hasDefault ? defaultId : models[0].id);
      toast.success(`Key validated — ${models.length} models available`);
    } catch {
      toast.error("Could not validate key. Check your network connection.");
    } finally {
      setIsValidating(false);
    }
  }

  function handleClear() {
    clearApiKey();
    setAvailableModels([]);
    toast.info("API key removed");
  }

  function getMaskedKey() {
    if (showKey) return apiKey;
    if (apiKey.length <= 8) return "•".repeat(apiKey.length);
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your AI provider and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Provider</CardTitle>
          <CardDescription>
            Choose between Google Gemini (free tier) or OpenAI (requires billing).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  provider === p.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-accent"
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                {provider === p.id && (
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="size-4" />
            API Key (BYOK)
          </CardTitle>
          <CardDescription>
            Your API key is stored locally in your browser and never sent to our
            servers. It&apos;s used only for direct API calls to {activeProvider.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isKeySet ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {activeProvider.name} key configured
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                {getMaskedKey()}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-7"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <XCircle className="size-3.5 mr-1.5" />
                Remove Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="api-key">{activeProvider.name} API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder={activeProvider.keyPlaceholder}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                  />
                  <Button onClick={handleSaveKey} disabled={isValidating}>
                    {isValidating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href={activeProvider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {provider === "google" ? "aistudio.google.com" : "platform.openai.com"}
                </a>
                {provider === "google" && (
                  <span className="ml-1 text-green-700 dark:text-green-400 font-medium">
                    — free API key available
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Model Selection</CardTitle>
              <CardDescription>
                {isKeySet
                  ? `${availableModels.length} models available from ${activeProvider.name}`
                  : "Connect your API key to see available models"}
              </CardDescription>
            </div>
            {isKeySet && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => loadModels(provider, apiKey)}
                disabled={isLoadingModels}
              >
                <RefreshCw
                  className={`size-4 ${isLoadingModels ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isKeySet ? (
            <p className="text-sm text-muted-foreground">
              Enter your API key above to load available models.
            </p>
          ) : isLoadingModels ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Fetching models...
            </div>
          ) : availableModels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No models found. Try refreshing or check your API key.
            </p>
          ) : (
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Integrations</CardTitle>
          <CardDescription>
            Data sources connected to your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_INTEGRATIONS.map((integration) => {
              const Icon = INTEGRATION_ICONS[integration.icon] || Database;
              return (
                <div
                  key={integration.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4" />
                    </div>
                    <span className="text-sm font-medium">
                      {integration.name}
                    </span>
                  </div>
                  {integration.connected ? (
                    <Badge variant="secondary" className="gap-1 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      <div className="size-1.5 rounded-full bg-green-500" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Not connected
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
