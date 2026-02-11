"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useApiKey } from "@/hooks/use-api-key";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { isKeySet, isLoaded, provider } = useApiKey();
  const providerLabel = provider === "google" ? "Gemini" : "OpenAI";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-end gap-2">
        {isLoaded && !isKeySet && (
          <Link href="/dashboard/settings">
            <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
              <Key className="size-3" />
              Set API Key
            </Badge>
          </Link>
        )}
        {isLoaded && isKeySet && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <div className="size-1.5 rounded-full bg-green-500" />
            {providerLabel} Connected
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
