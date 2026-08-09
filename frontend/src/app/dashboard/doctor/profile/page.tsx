"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Stethoscope } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface DoctorProfile {
  id: string;
  full_name?: string | null;
  specialization?: string | null;
  experience_years?: number | null;
  avg_consultation_minutes?: number | null;
  rating?: number | null;
  is_available: boolean;
  bio?: string | null;
  hospital_name?: string | null;
}

export default function DoctorProfilePage() {
  const queryClient = useQueryClient();
  const { data: doctor, isLoading } = useQuery<DoctorProfile>({
    queryKey: ["doctor-me"],
    queryFn: () => api<DoctorProfile>("/doctors/me"),
  });
  const [form, setForm] = useState({ specialization: "", bio: "", experience_years: "", avg_consultation_minutes: "" });
  const [loaded, setLoaded] = useState(false);
  if (doctor && !loaded) {
    setForm({
      specialization: doctor.specialization ?? "",
      bio: doctor.bio ?? "",
      experience_years: doctor.experience_years != null ? String(doctor.experience_years) : "",
      avg_consultation_minutes: doctor.avg_consultation_minutes != null ? String(doctor.avg_consultation_minutes) : "",
    });
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () =>
      api<DoctorProfile>("/doctors/me", {
        method: "PATCH",
        body: JSON.stringify({
          specialization: form.specialization || undefined,
          bio: form.bio || undefined,
          experience_years: form.experience_years ? Number(form.experience_years) : undefined,
          avg_consultation_minutes: form.avg_consultation_minutes ? Number(form.avg_consultation_minutes) : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["doctor-me"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const availability = useMutation({
    mutationFn: (is_available: boolean) =>
      api("/doctors/me/availability", { method: "PATCH", body: JSON.stringify({ is_available }) }),
    onSuccess: () => {
      toast.success("Availability updated");
      queryClient.invalidateQueries({ queryKey: ["doctor-me"] });
    },
  });

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Stethoscope className="size-5 text-primary" /> Profile
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About you</CardTitle>
          <CardDescription>
            {doctor?.full_name} {doctor?.hospital_name ? `· ${doctor.hospital_name}` : ""}
            {doctor?.rating != null && ` · ★ ${doctor.rating}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-spec">Specialization</Label>
              <Input id="d-spec" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Cardiologist" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-exp">Experience (years)</Label>
              <Input id="d-exp" type="number" min={0} value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="d-avg">Avg consultation (minutes)</Label>
              <Input id="d-avg" type="number" min={1} value={form.avg_consultation_minutes} onChange={(e) => setForm({ ...form, avg_consultation_minutes: e.target.value })} />
              <p className="text-xs text-muted-foreground">Used by the AI wait-time predictor to estimate queue delays.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="d-bio">Bio</Label>
              <Textarea id="d-bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4} placeholder="Education, areas of interest…" />
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-4" /> {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consultation status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="font-medium">{doctor?.is_available ? "Available" : "Off duty"}</p>
              <p className="text-sm text-muted-foreground">
                Patients can only book when you&apos;re marked available.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={doctor?.is_available ? "success" : "outline"}>
                {doctor?.is_available ? "Accepting patients" : "Not accepting"}
              </Badge>
              <Switch
                checked={doctor?.is_available ?? false}
                onCheckedChange={(v) => availability.mutate(v)}
                aria-label="Toggle availability"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
