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

export default function ReceptionEmergenciesPage() {
  const queryClient = useQueryClient();

  const { data: emergencies, isLoading } = useQuery<Emergency[]>({
    queryKey: ["emergencies", "reception"],
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

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-red-600 dark:text-red-400">
        <HeartPulse className="size-5" /> Emergencies
        {open.length > 0 && <Badge variant="destructive">{open.length} open</Badge>}
      </h1>

      {(emergencies ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No emergency requests</p>
            <p className="mt-1 text-sm text-muted-foreground">Alerts from patients appear here instantly.</p>
          </CardContent>
        </Card>
      ) : open.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">All clear</p>
            <p className="mt-1 text-sm text-muted-foreground">No open emergency requests right now.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {open.map((e) => (
            <li key={e.id}>
              <Card className={cn("border-l-4", e.triage_level === "red" ? "border-l-red-500" : "border-l-orange-500")}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Badge className={cn("border", priorityColor(e.triage_level))}>{e.triage_level.toUpperCase()}</Badge>
                        <span className="text-xs font-normal text-muted-foreground">{formatTime(e.created_at)}</span>
                      </CardTitle>
                      <CardDescription>
                        {e.hospital_name ?? "This hospital"}
                        {e.location ? ` · ${e.location}` : ""}
                      </CardDescription>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => resolve.mutate(e.id)} disabled={resolve.isPending}>
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
    </div>
  );
}
