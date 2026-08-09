"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, HeartPulse, Ticket, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface Overview {
  hospital_id?: string | null;
  occupancy_pct: number;
  doctors_online: number;
  patients_waiting: number;
  emergencies_open: number;
  departments: number;
  generated_at: string;
}

interface Analytics {
  total_patients: number;
  avg_wait_minutes: number;
  avg_consultation_minutes: number;
  no_show_count: number;
  peak_hours: Array<{ hour?: number; count?: number }>;
  patients_per_hour: Array<{ hour?: number; count?: number }>;
  daily_trend: Array<{ date: string; count: number }>;
  predicted_crowd?: {
    current_occupancy: number;
    peak_hour: string;
    recommendation: string;
    predictions?: Array<{ hour?: number; occupancy?: number }>;
  } | null;
}

export default function AdminOverview() {
  const { user } = useAuth();

  const { data: overview, isLoading } = useQuery<Overview>({
    queryKey: ["admin-overview"],
    queryFn: () => api<Overview>("/admin/overview"),
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["analytics"],
    queryFn: () => api<Analytics>(`/analytics${user?.hospital_id ? `?hospital_id=${user.hospital_id}` : ""}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stats = [
    { label: "Occupancy", value: `${overview?.occupancy_pct ?? 0}%`, icon: Activity, tone: "text-blue-600 dark:text-blue-400" },
    { label: "Doctors online", value: String(overview?.doctors_online ?? 0), icon: Users, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Patients waiting", value: String(overview?.patients_waiting ?? 0), icon: Ticket, tone: "text-yellow-600 dark:text-yellow-400" },
    { label: "Open emergencies", value: String(overview?.emergencies_open ?? 0), icon: HeartPulse, tone: "text-red-600 dark:text-red-400" },
    { label: "Departments", value: String(overview?.departments ?? 0), icon: Building2, tone: "text-indigo-600 dark:text-indigo-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations overview</h1>
        <p className="text-sm text-muted-foreground">
          Live hospital metrics · refreshed {overview?.generated_at ? formatDate(overview.generated_at, { hour: "2-digit", minute: "2-digit" }) : "just now"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <s.icon className={`size-5 ${s.tone}`} />
              <p className="mt-3 text-2xl font-extrabold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" /> Patient flow by hour
            </CardTitle>
            <CardDescription>Today&apos;s patient arrival pattern</CardDescription>
          </CardHeader>
          <CardContent>
            {(analytics?.patients_per_hour ?? []).length > 0 ? (
              <BarChart data={analytics!.patients_per_hour.map((p) => ({ label: `${p.hour ?? "?"}:00`, value: p.count ?? 0 }))} />
            ) : (
              <p className="text-sm text-muted-foreground">No hourly data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" /> Daily trend
            </CardTitle>
            <CardDescription>Patients per day over recent days</CardDescription>
          </CardHeader>
          <CardContent>
            {(analytics?.daily_trend ?? []).length > 0 ? (
              <BarChart data={analytics!.daily_trend.map((d) => ({ label: formatDate(d.date, { day: "numeric", month: "short" }), value: d.count }))} />
            ) : (
              <p className="text-sm text-muted-foreground">No trend data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" /> Efficiency metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricBox label="Total patients" value={String(analytics?.total_patients ?? 0)} />
              <MetricBox label="Avg wait" value={`${analytics?.avg_wait_minutes ?? 0} min`} />
              <MetricBox label="Avg consultation" value={`${analytics?.avg_consultation_minutes ?? 0} min`} />
              <MetricBox label="No-shows" value={String(analytics?.no_show_count ?? 0)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" /> AI crowd prediction
            </CardTitle>
            <CardDescription>Forecasted occupancy for this hospital</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.predicted_crowd ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Current occupancy: <span className="font-bold">{analytics.predicted_crowd.current_occupancy}%</span> ·
                  Peak at <span className="font-bold">{analytics.predicted_crowd.peak_hour}</span>
                </p>
                <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{analytics.predicted_crowd.recommendation}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No prediction available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-4 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Bar chart">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.value}`}>
          <span className="text-[10px] text-muted-foreground">{d.value}</span>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-emerald-500"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
          />
          <span className="rotate-0 text-[9px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
