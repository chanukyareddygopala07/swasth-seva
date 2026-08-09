"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Globe, Star, Stethoscope, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface GlobalAnalytics {
  totals: {
    hospitals: number;
    users: number;
    doctors: number;
    patients: number;
  };
  top_hospitals: Array<{
    id: string;
    name: string;
    city?: string | null;
    occupancy_pct?: number | null;
    rating?: number | null;
  }>;
}

export default function SuperAdminOverview() {
  const { data, isLoading } = useQuery<GlobalAnalytics>({
    queryKey: ["global-analytics"],
    queryFn: () => api<GlobalAnalytics>("/superadmin/global-analytics"),
  });

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  const stats = [
    { label: "Hospitals", value: data?.totals.hospitals ?? 0, icon: Building2, tone: "text-blue-600 dark:text-blue-400" },
    { label: "Users", value: data?.totals.users ?? 0, icon: Users, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Doctors", value: data?.totals.doctors ?? 0, icon: Stethoscope, tone: "text-indigo-600 dark:text-indigo-400" },
    { label: "Patients", value: data?.totals.patients ?? 0, icon: Globe, tone: "text-yellow-600 dark:text-yellow-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Swasth Seva network</h1>
        <p className="text-sm text-muted-foreground">Platform-wide usage and hospital performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <s.icon className={`size-5 ${s.tone}`} />
              <p className="mt-3 text-3xl font-extrabold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" /> Top hospitals by occupancy
          </CardTitle>
          <CardDescription>Busiest hospitals across the network</CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.top_hospitals ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active hospitals yet.</p>
          ) : (
            <ul className="divide-y">
              {data!.top_hospitals.map((h, i) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{h.name}</p>
                      <p className="text-sm text-muted-foreground">{h.city ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.rating != null && (
                      <Badge variant="success">
                        <Star className="size-3 fill-current" /> {h.rating}
                      </Badge>
                    )}
                    {h.occupancy_pct != null && (
                      <Badge variant={h.occupancy_pct > 70 ? "warning" : "info"}>{h.occupancy_pct}% occupied</Badge>
                    )}
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
