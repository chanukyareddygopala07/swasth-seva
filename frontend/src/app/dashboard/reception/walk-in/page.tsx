"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Ticket, UserPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, priorityColor } from "@/lib/utils";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
}

interface TokenResult {
  id: string;
  token_number: number;
  priority: string;
  status: string;
  predicted_wait_minutes?: number | null;
  patients_ahead?: number | null;
  current_token?: number | null;
  hospital_name?: string | null;
  department_name?: string | null;
}

const SYMPTOMS = ["fever", "cough", "cold", "headache", "chest pain", "breathing difficulty", "dizziness", "nausea", "vomiting", "abdominal pain", "joint pain", "rash", "sore throat", "fatigue"];

export default function WalkInPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [token, setToken] = useState<TokenResult | null>(null);

  const { data: departments, isLoading } = useQuery<Department[]>({
    queryKey: ["departments", user?.hospital_id],
    queryFn: () => api<Department[]>(`/hospitals/${user!.hospital_id}/departments`),
    enabled: !!user?.hospital_id,
  });

  const issue = useMutation({
    mutationFn: () =>
      api<TokenResult>("/tokens", {
        method: "POST",
        body: JSON.stringify({
          hospital_id: user!.hospital_id,
          department_id: departmentId,
          symptoms,
          is_walk_in: true,
        }),
      }),
    onSuccess: (data) => {
      setToken(data);
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      toast.success(`Token #${data.token_number} issued`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to issue token"),
  });

  const toggle = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  if (token) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-emerald-600 p-6 text-center text-white">
            <p className="text-sm opacity-90">Walk-in token issued</p>
            <p className="mt-1 text-6xl font-extrabold">#{token.token_number}</p>
            <p className="mt-2 text-sm opacity-90">{token.hospital_name}</p>
            <p className="text-xs opacity-75">{token.department_name}</p>
          </div>
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Predicted wait</p>
                <p className="text-lg font-bold">{token.predicted_wait_minutes ?? "—"} min</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Patients ahead</p>
                <p className="text-lg font-bold">{token.patients_ahead ?? 0}</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Now serving</p>
                <p className="text-lg font-bold">{token.current_token ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <span className="text-sm">Priority</span>
              <Badge className={cn("border", priorityColor(token.priority))}>{token.priority?.toUpperCase()}</Badge>
            </div>
            <div className="flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={`swasth-seva://token/${token.id}`} size={128} aria-label="Token QR code" />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Hand this to the patient — the QR enables live queue tracking on their phone.
            </p>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setToken(null);
                setSymptoms([]);
              }}
            >
              Issue another token
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <UserPlus className="size-5 text-primary" /> Walk-in token
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="size-4 text-primary" /> Issue a token at the desk
          </CardTitle>
          <CardDescription>For patients who arrive without booking. AI triage runs automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="walkin-dept" className="text-xs font-medium text-muted-foreground">Department</label>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select id="walkin-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Select department…</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Brain className="size-3.5" /> Symptoms (optional, improves triage & wait prediction)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOMS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  aria-pressed={symptoms.includes(s)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors focus-ring ${
                    symptoms.includes(s) ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            variant="gradient"
            size="lg"
            disabled={!departmentId || issue.isPending}
            onClick={() => issue.mutate()}
          >
            <Ticket className="size-4" /> {issue.isPending ? "Issuing…" : "Issue token"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
