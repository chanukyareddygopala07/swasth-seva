"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatTime } from "@/lib/utils";
import { useState } from "react";

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

export default function AdminAppointmentsPage() {
  const [status, setStatus] = useState("scheduled");

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments", "admin", status],
    queryFn: () => api<Appointment[]>(`/appointments?status=${status}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <CalendarClock className="size-5 text-primary" /> Appointments
        </h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Filter by status">
          {["scheduled", "completed", "cancelled"].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" /> <Skeleton className="h-20 w-full" />
        </div>
      ) : (appointments ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No {status} appointments.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {appointments!.map((a) => (
            <li key={a.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {formatDate(a.scheduled_at)} · {formatTime(a.scheduled_at)}
                      </CardTitle>
                      <CardDescription>
                        {a.hospital_name}
                        {a.doctor_name ? ` · Dr. ${a.doctor_name}` : ""}
                        {a.department_name ? ` · ${a.department_name}` : ""}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.priority && <Badge variant="warning">{a.priority}</Badge>}
                      {a.token_number != null && <Badge variant="info">Token #{a.token_number}</Badge>}
                      <Badge variant="outline" className="capitalize">{a.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
