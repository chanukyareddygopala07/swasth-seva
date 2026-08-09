"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CalendarClock, Gauge, PhoneCall, Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatTime } from "@/lib/utils";
import { toast } from "sonner";

interface DoctorProfile {
  id: string;
  full_name?: string | null;
  specialization?: string | null;
  experience_years?: number | null;
  avg_consultation_minutes?: number | null;
  rating?: number | null;
  is_available: boolean;
  hospital_id?: string | null;
  hospital_name?: string | null;
  department_id?: string | null;
  workload?: {
    predicted_patients: number;
    load_percent: number;
    status: string;
    recommendation?: string | null;
  } | null;
}

interface Appointment {
  id: string;
  patient_id: string;
  scheduled_at: string;
  status: string;
  reason?: string | null;
  hospital_name?: string | null;
  doctor_name?: string | null;
  department_name?: string | null;
  token_number?: number | null;
  priority?: string | null;
}

export default function DoctorOverview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: doctor, isLoading } = useQuery<DoctorProfile>({
    queryKey: ["doctor-me"],
    queryFn: () => api<DoctorProfile>("/doctors/me"),
  });

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["appointments", "doctor"],
    queryFn: () => api<Appointment[]>("/appointments?status=scheduled"),
  });

  const { data: queues } = useQuery<Array<{ id: string; department_name?: string | null; waiting_count: number; current_token?: number | null; is_active: boolean }>>({
    queryKey: ["queues", "doctor", doctor?.hospital_id],
    queryFn: () =>
      api<Array<{ id: string; department_name?: string | null; waiting_count: number; current_token?: number | null; is_active: boolean }>>(
        `/queues?hospital_id=${doctor!.hospital_id}`
      ),
    enabled: !!doctor?.hospital_id,
  });

  const availability = useMutation({
    mutationFn: (is_available: boolean) =>
      api<DoctorProfile>("/doctors/me/availability", { method: "PATCH", body: JSON.stringify({ is_available }) }),
    onSuccess: () => {
      toast.success("Availability updated");
      queryClient.invalidateQueries({ queryKey: ["doctor-me"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 p-6 text-white md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Dr. {doctor?.full_name ?? user?.full_name}</h1>
            <p className="mt-1 text-sm text-white/85">
              {doctor?.specialization ?? "General"} {doctor?.experience_years ? `· ${doctor.experience_years} yrs exp` : ""}
            </p>
            <p className="mt-1 text-sm text-white/70">{doctor?.hospital_name}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/15 p-4 backdrop-blur">
            <div>
              <p className="text-sm opacity-85">{doctor?.is_available ? "Available for consults" : "Off duty"}</p>
              <p className="text-xs opacity-70">~{doctor?.avg_consultation_minutes ?? "—"} min per patient</p>
            </div>
            <Switch
              checked={doctor?.is_available ?? false}
              onCheckedChange={(v) => availability.mutate(v)}
              aria-label="Toggle availability"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="size-4 text-primary" /> Predicted workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            {doctor?.workload ? (
              <div className="space-y-3">
                <p className="text-3xl font-extrabold">{doctor.workload.predicted_patients} patients</p>
                <div className="flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-600"
                      style={{ width: `${Math.min(100, doctor.workload.load_percent)}%` }}
                    />
                  </span>
                  <span className="text-sm font-semibold">{Math.round(doctor.workload.load_percent)}%</span>
                </div>
                {doctor.workload.recommendation && (
                  <p className="text-sm text-muted-foreground">{doctor.workload.recommendation}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Workload prediction unavailable.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" /> Today&apos;s appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold">{appointments?.length ?? "—"}</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/dashboard/doctor/appointments">View all →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="size-4 text-primary" /> Your queues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queues && queues.length > 0 ? (
              queues.map((q) => (
                <div key={q.id} className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                  <span className="font-medium">{q.department_name ?? "Queue"}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{q.waiting_count} waiting</span>
                    <Badge variant="info">Now: #{q.current_token ?? "—"}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No active queues.</p>
            )}
            <Button asChild size="sm" className="mt-2 w-full">
              <Link href="/dashboard/doctor/queue">
                <PhoneCall className="size-4" /> Open queue board
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-primary" /> Upcoming appointments
          </CardTitle>
          <CardDescription>Your scheduled consultations</CardDescription>
        </CardHeader>
        <CardContent>
          {(appointments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled appointments.</p>
          ) : (
            <ul className="divide-y">
              {(appointments ?? []).slice(0, 5).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{formatDate(a.scheduled_at)} · {formatTime(a.scheduled_at)}</p>
                    <p className="text-sm text-muted-foreground">{a.reason ?? "Consultation"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.priority && <Badge variant="warning">Priority: {a.priority}</Badge>}
                    <Badge variant="outline" className="capitalize">{a.status}</Badge>
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
