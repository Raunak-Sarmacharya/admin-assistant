import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/utils/formatters";
import { RISK_TOLERANCE_COLORS } from "@/lib/constants";
import Link from "next/link";
import type { Client } from "@/types/database";
import { Users } from "lucide-react";

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  const clients = (data || []) as Client[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          {clients.length} clients in your book of business.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Link key={client.id} href={`/dashboard/clients/${client.id}`}>
            <Card className="transition-colors hover:bg-accent/50 cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrencyCompact(Number(client.aum_value))} AUM
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${RISK_TOLERANCE_COLORS[client.risk_tolerance] || ""}`}
                  >
                    {client.risk_tolerance}
                  </Badge>
                </div>
                {client.notes && (
                  <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                    {client.notes}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Badge
                    variant={client.status === "Active" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {client.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
