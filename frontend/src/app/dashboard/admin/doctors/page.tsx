"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Doctor {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  specialization?: string | null;
  experience_years?: number | null;
  avg_consultation_minutes?: number | null;
  rating?: number | null;
  is_available: boolean;
  department_id?: string | null;
  hospital_name?: string | null;
}

interface Workload {
  doctor_id: string;
  doctor_name?: string | null;
  predicted_patients: number;
  load_percent: number;
  status: string;
  recommendation?: string | null;
}

export default function AdminDoctorsPage() {
  const { user } = useAuth();

  const { data: doctors, isLoading } = useQuery<Doctor[]>({
    queryKey: ["doctors", user?.hospital_id],
    queryFn: () => api<Doctor[]>(`/doctors?hospital_id=${user!.hospital_id}`),
    enabled: !!user?.hospital_id,
  });

  const { data: workloads } = useQuery<Workload[]>({
    queryKey: ["doctor-workloads", user?.hospital_id],
    queryFn: async () => {
      const list = await api<Doctor[]>(`/doctors?hospital_id=${user!.hospital_id}`);
      return Promise.all(
        list.map(async (d) => {
          try {
            return await api<Workload>(`/admin/doctor-workload/${d.id}`);
          } catch {
            return null;
          }
        })
      ).then((rows) => rows.filter((r): r is Workload => r !== null));
    },
    enabled: !!user?.hospital_id,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Users className="size-5 text-primary" /> Doctors
      </h1>
      {(doctors ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No doctors on staff yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Doctor accounts registered at your hospital will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {doctors!.map((d) => {
            const w = workloads?.find((wl) => wl.doctor_id === d.id);
            return (
              <Card key={d.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar name={d.full_name ?? undefined} src={d.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="truncate">Dr. {d.full_name}</span>
                        <Badge variant={d.is_available ? "success" : "outline"}>
                          {d.is_available ? "Online" : "Offline"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {d.specialization ?? "General"}
                        {d.experience_years != null ? ` · ${d.experience_years} yrs` : ""}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {d.rating != null && <Badge variant="success">★ {d.rating}</Badge>}
                    {d.avg_consultation_minutes != null && <Badge variant="outline">⏱ {d.avg_consultation_minutes} min/patient</Badge>}
                    {d.phone && <Badge variant="outline">{d.phone}</Badge>}
                  </div>
                  {w && (
                    <div className="rounded-xl bg-muted p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">AI predicted load</span>
                        <span className="font-semibold">{w.predicted_patients} patients · {Math.round(w.load_percent)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-600"
                          style={{ width: `${Math.min(100, w.load_percent)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
