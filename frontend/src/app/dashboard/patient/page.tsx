"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, HeartPulse, MapPin, Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { priorityColor } from "@/lib/utils";

interface TokenInfo {
  token_number: number;
  priority: string;
  status: string;
  predicted_wait_minutes?: number | null;
  patients_ahead?: number | null;
  current_token?: number | null;
  hospital_name?: string | null;
  department_name?: string | null;
}

export default function PatientOverview() {
  const { user } = useAuth();
  const { data: token, isLoading } = useQuery<TokenInfo | null>({
    queryKey: ["my-token"],
    queryFn: () => api<TokenInfo>("/tokens/mine/latest").catch(() => null),
  });
  const { data: appointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<unknown[]>("/appointments").catch(() => []),
  });

  return (
    <div className="space-y-6">
      <section aria-label="Welcome" className="rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 p-6 text-white md:p-8">
        <h1 className="text-2xl font-bold md:text-3xl">Namaste, {user?.full_name?.split(" ")[0]} 👋</h1>
        <p className="mt-2 max-w-lg text-sm text-white/85">
          Manage your OP visits, track live queues, and let AI predict your waiting time.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild className="bg-white text-blue-700 hover:bg-white/90">
            <Link href="/dashboard/patient/book">
              Book an OP visit <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25 backdrop-blur"
          >
            <Link href="/dashboard/patient/emergency">Emergency help</Link>
          </Button>
        </div>
      </section>

      <section aria-label="Active token" className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="size-5 text-primary" /> Active token
            </CardTitle>
            <CardDescription>Your latest issued token and its live status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : token ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {token.hospital_name ?? "Hospital"} · {token.department_name ?? "Department"}
                    </p>
                    <p className="mt-1 text-4xl font-extrabold text-primary">Token #{token.token_number}</p>
                  </div>
                  <Badge className={`border ${priorityColor(token.priority)}`}>Priority: {token.priority?.toUpperCase()}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Predicted wait</p>
                    <p className="text-lg font-bold">{token.predicted_wait_minutes ?? "—"} min</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Patients ahead</p>
                    <p className="text-lg font-bold">{token.patients_ahead ?? "—"}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Now serving</p>
                    <p className="text-lg font-bold">{token.current_token ?? "—"}</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/patient/queue">Track live queue →</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">No active token. Book an OP visit to get your digital token.</p>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/patient/book">Book now</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                  <Clock className="size-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">AI predicts your wait</p>
                  <p className="font-bold">within minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
                  <MapPin className="size-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Find</p>
                  <Link href="/dashboard/patient/nearby" className="font-bold hover:underline">
                    nearby hospitals →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-red-500/15 text-red-600">
                  <HeartPulse className="size-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">In emergency?</p>
                  <Link href="/dashboard/patient/emergency" className="font-bold text-red-600 hover:underline dark:text-red-400">
                    Request help →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments && appointments.length > 0 ? (
            <ul className="space-y-3">
              {(appointments as Array<Record<string, unknown>>).slice(0, 4).map((a) => (
                <li key={String(a.id)} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{String(a.hospital_name ?? "Hospital")}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(String(a.scheduled_at)).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Badge variant="info">{String(a.status)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
