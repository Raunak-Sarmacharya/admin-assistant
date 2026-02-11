import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDueDate } from "@/lib/utils/formatters";
import { RISK_TOLERANCE_COLORS, PRIORITY_COLORS, STATUS_COLORS } from "@/lib/constants";
import { ArrowLeft, Mail, Phone, DollarSign } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Client, Meeting, Task } from "@/types/database";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [clientRes, meetingsRes, tasksRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("meetings")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!clientRes.data) notFound();
  const client = clientRes.data as Client;
  const meetings = (meetingsRes.data || []) as Meeting[];
  const tasks = (tasksRes.data || []) as Task[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/clients"
          className="flex size-8 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="secondary"
              className={`text-xs ${RISK_TOLERANCE_COLORS[client.risk_tolerance] || ""}`}
            >
              {client.risk_tolerance}
            </Badge>
            <Badge
              variant={client.status === "Active" ? "default" : "outline"}
              className="text-xs"
            >
              {client.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="size-4" />
              <span className="text-sm">Assets Under Management</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(Number(client.aum_value))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              <span className="text-sm">Email</span>
            </div>
            <p className="mt-1 text-sm font-medium">
              {client.email || "Not on file"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" />
              <span className="text-sm">Phone</span>
            </div>
            <p className="mt-1 text-sm font-medium">
              {client.phone || "Not on file"}
            </p>
          </CardContent>
        </Card>
      </div>

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Meetings ({meetings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings yet.</p>
            ) : (
              <div className="space-y-3">
                {meetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/dashboard/meetings/${m.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(m.created_at)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${STATUS_COLORS[m.status] || ""}`}
                    >
                      {m.status.replace("_", " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDueDate(t.due_date)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${PRIORITY_COLORS[t.priority] || ""}`}
                    >
                      {t.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
