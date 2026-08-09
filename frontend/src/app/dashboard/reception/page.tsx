"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, HeartPulse, PhoneCall, Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface QueueSummary {
  id: string;
  department_name?: string | null;
  doctor_name?: string | null;
  is_active: boolean;
  waiting_count: number;
  current_token?: number | null;
  next_token: number;
}

export default function ReceptionOverview() {
  const { user } = useAuth();

  const { data: queues, isLoading } = useQuery<QueueSummary[]>({
    queryKey: ["queues", "reception", user?.hospital_id],
    queryFn: () => api<QueueSummary[]>(`/queues?hospital_id=${user!.hospital_id}`),
    enabled: !!user?.hospital_id,
  });

  const { data: emergencies } = useQuery<Array<{ id: string; status: string }>>({
    queryKey: ["emergencies", "reception"],
    queryFn: () => api<Array<{ id: string; status: string }>>("/emergency"),
  });

  const { data: appointments } = useQuery<unknown[]>({
    queryKey: ["appointments", "reception", "scheduled"],
    queryFn: () => api<unknown[]>("/appointments?status=scheduled"),
  });

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  const activeQueues = (queues ?? []).filter((q) => q.is_active);
  const totalWaiting = activeQueues.reduce((sum, q) => sum + q.waiting_count, 0);
  const openEmergencies = (emergencies ?? []).filter((e) => e.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome to the front desk</h1>
        <p className="text-sm text-muted-foreground">
          {user?.hospital_id ? "Manage queues, issue walk-in tokens and book appointments." : "Complete your hospital profile to activate desk operations."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <Ticket className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-extrabold">{totalWaiting}</p>
            <p className="text-xs text-muted-foreground">Patients waiting across {activeQueues.length} queues</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/dashboard/reception/queue">
                <PhoneCall className="size-3.5" /> Open queue board
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <CalendarClock className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-extrabold">{appointments?.length ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Scheduled appointments today</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/dashboard/reception/appointments">Manage appointments</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <HeartPulse className="size-5 text-red-600 dark:text-red-400" />
            <p className="mt-3 text-2xl font-extrabold">{openEmergencies}</p>
            <p className="text-xs text-muted-foreground">Open emergency requests</p>
            {openEmergencies > 0 && (
              <Button asChild variant="destructive" size="sm" className="mt-3">
                <Link href="/dashboard/reception/emergencies">Respond now</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live queues</CardTitle>
          <CardDescription>Current status of every department line</CardDescription>
        </CardHeader>
        <CardContent>
          {activeQueues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active queues right now.</p>
          ) : (
            <ul className="divide-y">
              {activeQueues.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{q.department_name ?? "Queue"}</p>
                    {q.doctor_name && <p className="text-sm text-muted-foreground">Dr. {q.doctor_name}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="info">Now: #{q.current_token ?? "—"}</Badge>
                    <Badge variant="warning">{q.waiting_count} waiting</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
