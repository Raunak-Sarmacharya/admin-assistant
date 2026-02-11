import { createAIProvider, parseAIError } from "@/lib/ai/provider";
import { getChatSystemPrompt } from "@/lib/ai/prompts";
import { streamText } from "ai";
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function buildClientContext(): Promise<string> {
  const supabase = await createServerSupabaseClient();

  const [clientsRes, meetingsRes, tasksRes] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase
      .from("meetings")
      .select("id, title, client_id, status, created_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("tasks")
      .select("*, clients(name)")
      .eq("status", "pending")
      .order("due_date", { ascending: true }),
  ]);

  const clients = clientsRes.data || [];
  const meetings = meetingsRes.data || [];
  const tasks = tasksRes.data || [];

  let context = "## Client Book\n";
  for (const c of clients) {
    context += `- **${c.name}**: AUM $${Number(c.aum_value).toLocaleString()}, Risk: ${c.risk_tolerance}, Status: ${c.status}`;
    if (c.notes) context += `, Notes: ${c.notes}`;
    context += "\n";
  }

  context += "\n## Recent Meetings\n";
  for (const m of meetings) {
    const clientName = (m.clients as unknown as { name: string } | null)?.name || "Unknown";
    context += `- "${m.title}" with ${clientName} (${m.status}) — ${new Date(m.created_at).toLocaleDateString()}\n`;
  }

  context += "\n## Pending Tasks\n";
  for (const t of tasks) {
    const clientName = (t.clients as unknown as { name: string } | null)?.name || "Unknown";
    context += `- [${t.priority}] ${t.description} — for ${clientName}`;
    if (t.due_date) context += ` (due ${new Date(t.due_date).toLocaleDateString()})`;
    context += "\n";
  }

  return context;
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, messages, model } = await req.json();

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const selectedModel = model || "gemini-2.0-flash";
    const aiModel = createAIProvider(apiKey, selectedModel);
    const clientContext = await buildClientContext();
    const systemPrompt = getChatSystemPrompt(clientContext);

    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      messages,
    });

    // Wrap the stream to catch mid-stream errors (e.g. 429 quota)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (streamError) {
          const { message } = parseAIError(streamError);
          controller.enqueue(
            encoder.encode(`\n\n[STREAM_ERROR]${message}`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: unknown) {
    const { message, isQuota } = parseAIError(error);
    console.error("Chat error:", message);
    return new Response(JSON.stringify({ error: message, isQuota }), {
      status: isQuota ? 402 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
