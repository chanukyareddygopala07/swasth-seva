"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search, Stethoscope, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface PatientHit {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface PrescriptionItem {
  medicine: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

interface MedicalRecord {
  id: string;
  diagnosis?: string | null;
  notes?: string | null;
  doctor_name?: string | null;
  hospital_name?: string | null;
  symptoms: string[];
  vitals: Record<string, unknown>;
  prescriptions: PrescriptionItem[];
  created_at: string;
}

const SYMPTOM_SUGGESTIONS = ["fever", "cough", "cold", "headache", "chest pain", "nausea", "fatigue", "dizziness", "rash", "sore throat"];

export default function ConsultationPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [vitals, setVitals] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  const { data: results, isFetching } = useQuery<{ patients: PatientHit[] }>({
    queryKey: ["search-patients", search],
    queryFn: () => api<{ patients: PatientHit[] }>(`/search?q=${encodeURIComponent(search)}`),
    enabled: search.length > 0,
  });

  const { data: records, isLoading: recordsLoading } = useQuery<MedicalRecord[]>({
    queryKey: ["patient-records", patient?.id],
    queryFn: () => api<MedicalRecord[]>(`/patients/${patient!.id}/records`),
    enabled: !!patient,
  });

  const save = useMutation({
    mutationFn: () =>
      api("/records", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patient!.id,
          diagnosis,
          notes,
          symptoms,
          vitals: parseVitals(vitals),
          prescriptions,
        }),
      }),
    onSuccess: () => {
      toast.success("Record saved to the patient's health passport");
      setDiagnosis("");
      setNotes("");
      setSymptoms([]);
      setVitals("");
      setPrescriptions([]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const toggleSymptom = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const addPrescription = () => setPrescriptions((prev) => [...prev, { medicine: "" }]);
  const updatePrescription = (i: number, patch: Partial<PrescriptionItem>) =>
    setPrescriptions((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePrescription = (i: number) => setPrescriptions((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Stethoscope className="size-5 text-primary" /> Consultation
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Find patient</CardTitle>
              <CardDescription>Search by name, phone or email.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Patient name or phone…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearch(query);
                  }}
                />
                <Button variant="outline" onClick={() => setSearch(query)} disabled={!query.trim() || isFetching}>
                  <Search className="size-4" /> {isFetching ? "…" : "Search"}
                </Button>
              </div>
              {results && (
                <ul className="mt-3 space-y-2">
                  {results.patients.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setPatient(p)}
                        className={`w-full rounded-xl border p-3 text-left transition-colors focus-ring ${
                          patient?.id === p.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                        }`}
                      >
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.phone ?? p.email ?? "—"}</p>
                      </button>
                    </li>
                  ))}
                  {results.patients.length === 0 && (
                    <p className="text-sm text-muted-foreground">No patients found.</p>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {patient && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Previous records — {patient.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : records && records.length > 0 ? (
                  <ul className="space-y-3">
                    {records.map((r) => (
                      <li key={r.id} className="rounded-xl border p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{r.diagnosis ?? "Consultation"}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                        </div>
                        {r.symptoms.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.symptoms.map((s) => (
                              <Badge key={s} variant="secondary">{s}</Badge>
                            ))}
                          </div>
                        )}
                        {r.prescriptions.length > 0 && (
                          <p className="mt-2 text-muted-foreground">
                            {r.prescriptions.map((p) => p.medicine).join(", ")}
                          </p>
                        )}
                        {r.notes && <p className="mt-2 text-muted-foreground">{r.notes}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No previous records.</p>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        {patient && (
          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New consultation — {patient.name}</CardTitle>
                <CardDescription>Saved instantly to the patient&apos;s health passport.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-diagnosis">Diagnosis</Label>
                  <Input id="c-diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Viral fever" />
                </div>
                <div className="space-y-1.5">
                  <Label>Symptoms</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SYMPTOM_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleSymptom(s)}
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
                <div className="space-y-1.5">
                  <Label htmlFor="c-vitals">Vitals (key: value, comma separated)</Label>
                  <Input
                    id="c-vitals"
                    value={vitals}
                    onChange={(e) => setVitals(e.target.value)}
                    placeholder="bp: 120/80, pulse: 72, temp: 98.6F"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-notes">Clinical notes</Label>
                  <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Examination findings, advice…" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Prescription</Label>
                    <Button size="sm" variant="outline" onClick={addPrescription}>
                      <Plus className="size-3.5" /> Add medicine
                    </Button>
                  </div>
                  {prescriptions.map((p, i) => (
                    <div key={i} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
                      <Input
                        value={p.medicine}
                        onChange={(e) => updatePrescription(i, { medicine: e.target.value })}
                        placeholder="Medicine"
                        aria-label="Medicine name"
                      />
                      <Input
                        value={p.dosage ?? ""}
                        onChange={(e) => updatePrescription(i, { dosage: e.target.value })}
                        placeholder="Dosage (e.g. 1 tab)"
                        aria-label="Dosage"
                      />
                      <Input
                        value={p.frequency ?? ""}
                        onChange={(e) => updatePrescription(i, { frequency: e.target.value })}
                        placeholder="Frequency (e.g. 3x daily)"
                        aria-label="Frequency"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={p.duration ?? ""}
                          onChange={(e) => updatePrescription(i, { duration: e.target.value })}
                          placeholder="Duration (e.g. 5 days)"
                          aria-label="Duration"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0 text-destructive"
                          aria-label="Remove medicine"
                          onClick={() => removePrescription(i)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full"
                  variant="gradient"
                  size="lg"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                >
                  <FileText className="size-4" /> {save.isPending ? "Saving…" : "Save medical record"}
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}

function parseVitals(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of text.split(",")) {
    const [k, v] = pair.split(":").map((s) => s.trim());
    if (k && v) result[k] = v;
  }
  return result;
}
