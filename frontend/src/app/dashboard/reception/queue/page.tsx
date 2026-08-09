"use client";

import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QueueBoard } from "@/components/dashboard/queue-board";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface QueueSummary {
  id: string;
  department_name?: string | null;
  doctor_name?: string | null;
  is_active: boolean;
  waiting_count: number;
  current_token?: number | null;
}

export default function ReceptionQueuePage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: queues, isLoading } = useQuery<QueueSummary[]>({
    queryKey: ["queues", "reception", user?.hospital_id],
    queryFn: () => api<QueueSummary[]>(`/queues?hospital_id=${user!.hospital_id}`),
    enabled: !!user?.hospital_id,
  });

  const active = selected ?? queues?.find((q) => q.is_active)?.id ?? queues?.[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Ticket className="size-5 text-primary" /> Queue board
      </h1>
      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : !queues || queues.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No queues yet today</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Queues are created automatically when the first token is issued.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {queues.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelected(q.id)}
                aria-pressed={active === q.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-ring",
                  active === q.id ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent"
                )}
              >
                {q.department_name ?? "Queue"}
                {q.doctor_name && <span className="text-xs text-muted-foreground">Dr. {q.doctor_name}</span>}
                <Badge variant={q.is_active ? "success" : "outline"}>{q.is_active ? "Live" : "Closed"}</Badge>
              </button>
            ))}
          </div>
          {active && <QueueBoard queueId={active} />}
        </>
      )}
    </div>
  );
}
