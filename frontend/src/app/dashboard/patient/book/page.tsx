"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, Brain, Check, MapPin, Search, Star, Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, priorityColor } from "@/lib/utils";
import { toast } from "sonner";

interface Hospital {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  rating: number;
  distance_km?: number | null;
  eta_minutes?: number | null;
  doctors_count?: number | null;
  waiting_count?: number | null;
}

interface Department {
  id: string;
  name: string;
  avg_consultation_minutes: number;
  doctors_count?: number | null;
  waiting_count?: number | null;
}

interface TriageResult {
  level: string;
  score: number;
  recommendation: string;
  priority_order: number;
}

interface TokenResult {
  id: string;
  token_number: number;
  priority: string;
  status: string;
  predicted_wait_minutes?: number | null;
  patients_ahead?: number | null;
  hospital_name?: string | null;
  department_name?: string | null;
  triage_reason?: string | null;
}

const SYMPTOM_SUGGESTIONS = [
  "fever", "cough", "cold", "headache", "chest pain", "breathing difficulty", "dizziness",
  "fatigue", "nausea", "vomiting", "abdominal pain", "joint pain", "back pain", "rash",
  "sore throat", "body ache", "burning urination", "diarrhea", "insomnia",
];

export default function BookOpPage() {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState("");
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [token, setToken] = useState<TokenResult | null>(null);
  const [predicting, setPredicting] = useState(false);

  const { data: hospitals, isLoading } = useQuery<Hospital[]>({
    queryKey: ["hospitals", search],
    queryFn: () => api<Hospital[]>(`/hospitals?search=${encodeURIComponent(search)}`),
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["departments", hospitalId],
    queryFn: () => api<Department[]>(`/hospitals/${hospitalId}/departments`),
    enabled: !!hospitalId,
  });

  const tokenMutation = useMutation({
    mutationFn: () =>
      api<TokenResult>("/tokens", {
        method: "POST",
        body: JSON.stringify({ hospital_id: hospitalId, department_id: departmentId, symptoms }),
      }),
    onSuccess: (data) => {
      setToken(data);
      queryClient.invalidateQueries({ queryKey: ["my-token"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to issue token"),
  });

  const runTriage = async () => {
    if (symptoms.length === 0) return;
    setPredicting(true);
    try {
      const res = await api<TriageResult>("/ai/triage", { method: "POST", body: JSON.stringify({ symptoms }) });
      setTriage(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Triage failed");
    } finally {
      setPredicting(false);
    }
  };

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep(Math.max(1, step - 1))} aria-label="Previous step" disabled={step === 1}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Book OP visit</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 4</p>
        </div>
      </div>

      <ol className="flex items-center gap-2 text-xs" aria-label="Progress">
        {["Hospital", "Department", "Symptom check", "Token"].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                step > i ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {step > i + 1 ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn("hidden sm:block", step >= i + 1 ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {i < 3 && <span className="h-px w-4 bg-border" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search hospitals by name or city…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search hospitals"
            />
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40" /> <Skeleton className="h-40" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(hospitals ?? []).map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setHospitalId(h.id); setStep(2); }}
                  className={cn(
                    "rounded-2xl border bg-card p-5 text-left transition-all hover:shadow-lg focus-ring",
                    hospitalId === h.id && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{h.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" /> {h.city ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="size-4 fill-yellow-400 text-yellow-400" /> {h.rating ?? "—"}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {h.distance_km != null && <Badge variant="outline">🚗 {h.distance_km} km{h.eta_minutes ? ` · ${h.eta_minutes} min` : ""}</Badge>}
                    {h.waiting_count != null && <Badge variant="warning">⏳ {h.waiting_count} waiting</Badge>}
                    {h.doctors_count != null && <Badge variant="success">👨‍⚕️ {h.doctors_count} doctors</Badge>}
                  </div>
                </button>
              ))}
              {hospitals && hospitals.length === 0 && (
                <p className="text-sm text-muted-foreground">No hospitals found. Try a different search.</p>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Choose the department you need. Waiting counts update live.</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(departments ?? []).map((d) => (
              <button
                key={d.id}
                onClick={() => { setDepartmentId(d.id); setStep(3); }}
                className={cn(
                  "rounded-2xl border bg-card p-5 text-left transition-all hover:shadow-lg focus-ring",
                  departmentId === d.id && "ring-2 ring-primary"
                )}
              >
                <p className="font-semibold">{d.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">~{d.avg_consultation_minutes} min per patient</p>
                <div className="mt-3 flex gap-2">
                  {d.waiting_count != null && <Badge variant="warning">{d.waiting_count} waiting</Badge>}
                  {d.doctors_count != null && <Badge variant="success">{d.doctors_count} doctors</Badge>}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-300">
            <Brain className="mb-1 size-4" />
            Tip: not sure which department? Skip ahead and let the AI symptom checker suggest one.
          </div>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-5 text-primary" /> AI Symptom Checker
            </CardTitle>
            <CardDescription>
              Select your symptoms. Our triage model assesses urgency — {triage ? "already done ✓" : "Green / Yellow / Orange / Red"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  aria-pressed={symptoms.includes(s)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors focus-ring",
                    symptoms.includes(s) ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type another symptom and press Add"
                value={symptomInput}
                onChange={(e) => setSymptomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && symptomInput.trim()) {
                    toggleSymptom(symptomInput.trim().toLowerCase());
                    setSymptomInput("");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (symptomInput.trim()) {
                    toggleSymptom(symptomInput.trim().toLowerCase());
                    setSymptomInput("");
                  }
                }}
              >
                Add
              </Button>
            </div>
            {triage && (
              <div className={cn("rounded-2xl border p-5", priorityColor(triage.level))}>
                <div className="flex items-center justify-between">
                  <p className="font-bold uppercase">Triage: {triage.level}</p>
                  <Badge variant="outline">AI confidence {Math.round(triage.score * 100)}%</Badge>
                </div>
                <p className="mt-2 text-sm">{triage.recommendation}</p>
              </div>
            )}
            <Button onClick={runTriage} disabled={symptoms.length === 0 || predicting} variant={triage ? "outline" : "default"}>
              {predicting ? "Analyzing…" : triage ? "Re-analyze" : "Analyze symptoms"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <div className="space-y-6">
          {tokenMutation.isPending ? (
            <div className="rounded-2xl border p-8 text-center">
              <Skeleton className="mx-auto h-24 w-24 rounded-full" />
              <p className="mt-4 text-sm text-muted-foreground">Issuing your digital token…</p>
            </div>
          ) : token ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 p-6 text-white">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm opacity-85">
                      {token.hospital_name} · {token.department_name}
                    </p>
                    <p className="mt-1 text-5xl font-extrabold">#{token.token_number}</p>
                    <p className="mt-1 text-sm opacity-85">Token {token.priority?.toUpperCase()} priority</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <QRCodeSVG value={`swasth-seva://token/${token.id}`} size={128} aria-label="Token QR code" />
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/15 p-3">
                    <p className="text-xs opacity-85">Predicted wait</p>
                    <p className="text-xl font-bold">{token.predicted_wait_minutes} min</p>
                  </div>
                  <div className="rounded-xl bg-white/15 p-3">
                    <p className="text-xs opacity-85">Patients ahead</p>
                    <p className="text-xl font-bold">{token.patients_ahead ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-white/15 p-3">
                    <p className="text-xs opacity-85">Status</p>
                    <p className="text-xl font-bold capitalize">{token.status}</p>
                  </div>
                </div>
              </div>
              {token.triage_reason && (
                <p className="rounded-xl bg-muted p-4 text-sm">🩺 {token.triage_reason}</p>
              )}
              <Button asChild variant="gradient" className="w-full" size="lg">
                <a href="/dashboard/patient/queue">
                  <Ticket className="size-4" /> Track my queue live
                </a>
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm text-muted-foreground">Ready to issue your token?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {symptoms.length > 0 ? `Triage assessed from ${symptoms.join(", ")}` : "No symptoms — will be marked as routine (Green)."}
              </p>
              <Button className="mt-5" onClick={() => tokenMutation.mutate()} disabled={!hospitalId || !departmentId}>
                Issue my digital token
              </Button>
            </div>
          )}
        </div>
      )}

      {step < 4 && (
        <div className="flex justify-end gap-3">
          {step === 3 && triage && (
            <Button onClick={() => { setStep(4); tokenMutation.mutate(); }} variant="gradient">
              Get my token <ArrowRight className="size-4" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} variant="gradient">
              Continue to symptom check <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
