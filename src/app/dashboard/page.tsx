import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, FileText, CheckSquare, AlertTriangle } from "lucide-react";
import { formatCurrencyCompact, formatDate, formatDueDate } from "@/lib/utils/formatters";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/constants";
import Link from "next/link";
import type { Client, MeetingWithClient, TaskWithClient } from "@/types/database";

async function getDashboardData() {
  const supabase = await createServerSupabaseClient();

  const [clientsRes, meetingsRes, tasksRes, flagsRes] = await Promise.all([
    supabase.from("clients").select("*").order("aum_value", { ascending: false }),
    supabase
      .from("meetings")
      .select("*, clients(id, name, risk_tolerance, aum_value)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("*, clients(id, name)")
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(8),
    supabase.from("compliance_flags").select("id").eq("is_resolved", false),
  ]);

  const clients = (clientsRes.data || []) as Client[];
  const totalAum = clients.reduce((sum, c) => sum + Number(c.aum_value), 0);

  return {
    totalAum,
    clientCount: clients.length,
    meetings: (meetingsRes.data || []) as MeetingWithClient[],
    tasks: (tasksRes.data || []) as TaskWithClient[],
    unresolvedFlags: flagsRes.data?.length || 0,
  };
}

export default async function DashboardPage() {
  const { totalAum, clientCount, meetings, tasks, unresolvedFlags } =
    await getDashboardData();

  const stats = [
    {
      label: "Total AUM",
      value: formatCurrencyCompact(totalAum),
      icon: DollarSign,
      description: "Across all clients",
    },
    {
      label: "Active Clients",
      value: clientCount.toString(),
      icon: Users,
      description: "In your book",
    },
    {
      label: "Recent Meetings",
      value: meetings.length.toString(),
      icon: FileText,
      description: "Last 30 days",
    },
    {
      label: "Pending Tasks",
      value: tasks.length.toString(),
      icon: CheckSquare,
      description: "Action items",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Your wealth management dashboard at a glance.
        </p>
      </div>

      {unresolvedFlags > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-900/50 dark:bg-orange-950/20">
          <AlertTriangle className="size-4 text-orange-600" />
          <span className="text-orange-800 dark:text-orange-300">
            <strong>{unresolvedFlags}</strong> unresolved compliance{" "}
            {unresolvedFlags === 1 ? "flag" : "flags"} require attention.
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings yet.</p>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/dashboard/meetings/${meeting.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {meeting.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {meeting.clients?.name} &middot;{" "}
                        {formatDate(meeting.created_at)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`ml-2 text-xs ${STATUS_COLORS[meeting.status] || ""}`}
                    >
                      {meeting.status.replace("_", " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All caught up! No pending tasks.
              </p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{task.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.clients?.name} &middot;{" "}
                        {formatDueDate(task.due_date)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${PRIORITY_COLORS[task.priority] || ""}`}
                    >
                      {task.priority}
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
