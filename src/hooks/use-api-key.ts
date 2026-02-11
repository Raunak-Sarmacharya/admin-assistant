"use client";

import { useState, useEffect, useCallback } from "react";
import {
  API_KEY_STORAGE_KEY,
  MODEL_STORAGE_KEY,
  PROVIDER_STORAGE_KEY,
} from "@/lib/constants";
import type { ProviderOption } from "@/lib/constants";
import { DEFAULT_MODELS } from "@/lib/ai/models";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>("");
  const [model, setModelState] = useState<string>("");
  const [provider, setProviderState] = useState<ProviderOption>("google");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY) || "";
    const storedProvider =
      (localStorage.getItem(PROVIDER_STORAGE_KEY) as ProviderOption) || "google";
    setApiKeyState(storedKey);
    setModelState(storedModel || DEFAULT_MODELS[storedProvider] || "");
    setProviderState(storedProvider);
    setIsLoaded(true);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }, []);

  const setModel = useCallback((m: string) => {
    setModelState(m);
    localStorage.setItem(MODEL_STORAGE_KEY, m);
  }, []);

  const setProvider = useCallback((p: ProviderOption) => {
    setProviderState(p);
    localStorage.setItem(PROVIDER_STORAGE_KEY, p);
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyState("");
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }, []);

  return {
    apiKey,
    model,
    provider,
    setApiKey,
    setModel,
    setProvider,
    clearApiKey,
    isKeySet: isLoaded && apiKey.length > 0,
    isLoaded,
  };
}
