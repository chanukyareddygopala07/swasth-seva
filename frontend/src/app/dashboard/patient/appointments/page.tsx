"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface Appointment {
  id: string;
  hospital_name?: string | null;
  department_name?: string | null;
  doctor_name?: string | null;
  scheduled_at: string;
  status: string;
  token_number?: number | null;
  reason?: string | null;
}

export default function AppointmentsPage() {
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments"],
    queryFn: () => api<Appointment[]>("/appointments"),
  });

  const sorted = (appointments ?? []).slice().sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Appointments</h1>
        <Button asChild><Link href="/dashboard/patient/book">Book new OP</Link></Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" /> <Skeleton className="h-32" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <CalendarDays className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No appointments yet</p>
            <p className="text-sm text-muted-foreground">Book an OP visit to see it here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{a.hospital_name}</CardTitle>
                    <CardDescription>
                      {a.department_name}
                      {a.doctor_name ? ` · Dr. ${a.doctor_name.replace(/^Dr\.\s*/, "")}` : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="capitalize">{a.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{formatDate(a.scheduled_at)}</span>
                {a.token_number != null && <span className="font-semibold">Token #{a.token_number}</span>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
