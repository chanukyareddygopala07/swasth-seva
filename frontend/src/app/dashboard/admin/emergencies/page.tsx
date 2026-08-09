"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatTime, priorityColor } from "@/lib/utils";
import { toast } from "sonner";

interface Emergency {
  id: string;
  triage_level: string;
  symptoms: string[];
  description?: string | null;
  location?: string | null;
  status: string;
  created_at: string;
  hospital_name?: string | null;
}

export default function AdminEmergenciesPage() {
  const queryClient = useQueryClient();

  const { data: emergencies, isLoading } = useQuery<Emergency[]>({
    queryKey: ["emergencies"],
    queryFn: () => api<Emergency[]>("/emergency"),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => api(`/emergency/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Emergency resolved");
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const open = (emergencies ?? []).filter((e) => e.status === "open");
  const resolved = (emergencies ?? []).filter((e) => e.status === "resolved");

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-red-600 dark:text-red-400">
        <HeartPulse className="size-5" /> Emergencies
        {open.length > 0 && <Badge variant="destructive">{open.length} open</Badge>}
      </h1>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (emergencies ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No emergency requests</p>
            <p className="mt-1 text-sm text-muted-foreground">Patient emergency alerts will appear here in real time.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Open emergencies">
            <h2 className="mb-3 font-semibold">Open requests ({open.length})</h2>
            {open.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">All clear — no open emergencies.</p>
            ) : (
              <ul className="space-y-4">
                {open.map((e) => (
                  <li key={e.id}>
                    <Card className={cn("border-l-4", e.triage_level === "red" ? "border-l-red-500" : "border-l-orange-500")}>
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Badge className={cn("border", priorityColor(e.triage_level))}>
                                {e.triage_level.toUpperCase()} · URGENT
                              </Badge>
                              <span className="text-xs font-normal text-muted-foreground">{formatTime(e.created_at)}</span>
                            </CardTitle>
                            <CardDescription>
                              {e.hospital_name ?? "Nearest hospital"}
                              {e.location ? ` · ${e.location}` : ""}
                            </CardDescription>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => resolve.mutate(e.id)}
                            disabled={resolve.isPending}
                          >
                            Mark resolved
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          {e.symptoms.map((s) => (
                            <Badge key={s} variant="outline">{s}</Badge>
                          ))}
                        </div>
                        {e.description && <p className="text-muted-foreground">{e.description}</p>}
                        {e.location && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3.5" /> {e.location}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {resolved.length > 0 && (
            <section aria-label="Resolved emergencies">
              <h2 className="mb-3 font-semibold">Resolved ({resolved.length})</h2>
              <div className="flex flex-wrap gap-2">
                {resolved.map((e) => (
                  <Badge key={e.id} variant="outline" className="capitalize">
                    {e.triage_level} · {formatTime(e.created_at)}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
