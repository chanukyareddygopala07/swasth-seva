"use client";

import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QueueBoard } from "@/components/dashboard/queue-board";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DoctorProfile {
  id: string;
  hospital_id?: string | null;
  department_id?: string | null;
}

interface QueueSummary {
  id: string;
  department_name?: string | null;
  doctor_name?: string | null;
  is_active: boolean;
  waiting_count: number;
  current_token?: number | null;
}

export default function DoctorQueuePage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: doctor } = useQuery<DoctorProfile>({
    queryKey: ["doctor-me"],
    queryFn: () => api<DoctorProfile>("/doctors/me"),
  });

  const { data: queues, isLoading } = useQuery<QueueSummary[]>({
    queryKey: ["queues", "doctor", doctor?.hospital_id],
    queryFn: () =>
      api<QueueSummary[]>(`/queues?hospital_id=${doctor!.hospital_id}&active_only=true`),
    enabled: !!doctor?.hospital_id,
  });

  const active = selected ?? queues?.[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Ticket className="size-5 text-primary" /> Queue board
        </h1>
        <div className="flex flex-wrap gap-2">
          {(queues ?? []).map((q) => (
            <button
              key={q.id}
              onClick={() => setSelected(q.id)}
              aria-pressed={active === q.id}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors focus-ring",
                active === q.id ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent"
              )}
            >
              {q.department_name ?? "Queue"}
              <span className="ml-2 text-xs text-muted-foreground">{q.waiting_count}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : !active ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No active queue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your queue opens when the hospital reception starts the day&apos;s OP line.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Badge variant="info">Waiting</Badge>
              <Badge variant="success">Called</Badge>
              <Badge variant="outline">Completed</Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <QueueBoard queueId={active} />
      )}
    </div>
  );
}
