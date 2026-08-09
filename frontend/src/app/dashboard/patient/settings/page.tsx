"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface PatientProfile {
  dob?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  emergency_contact?: string | null;
  allergies: string[];
  chronic_conditions: string[];
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const [name, setName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  const { data: profile, isLoading } = useQuery<PatientProfile>({
    queryKey: ["patient-profile"],
    queryFn: () => api<PatientProfile>("/patients/me"),
  });
  const [form, setForm] = useState<PatientProfile>({
    dob: "",
    gender: "",
    blood_group: "",
    emergency_contact: "",
    allergies: [],
    chronic_conditions: [],
  });
  const [loaded, setLoaded] = useState(false);
  if (profile && !loaded) {
    setForm({
      dob: profile.dob ?? "",
      gender: profile.gender ?? "",
      blood_group: profile.blood_group ?? "",
      emergency_contact: profile.emergency_contact ?? "",
      allergies: profile.allergies ?? [],
      chronic_conditions: profile.chronic_conditions ?? [],
    });
    setLoaded(true);
  }

  const saveProfile = useMutation({
    mutationFn: () => api("/users/me", { method: "PATCH", body: JSON.stringify({ full_name: name, phone }) }),
    onSuccess: (res) => {
      updateUser(res as { full_name: string; phone?: string | null });
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const saveMedical = useMutation({
    mutationFn: () => api("/patients/me", { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-profile"] });
      toast.success("Medical profile saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const setCommaList = (key: "allergies" | "chronic_conditions", value: string) =>
    setForm((f) => ({ ...f, [key]: value.split(",").map((s) => s.trim()).filter(Boolean) }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Full name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-phone">Phone</Label>
            <Input id="s-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            <Save className="size-4" /> {saveProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medical profile</CardTitle>
          <CardDescription>Used by doctors and AI triage to personalize your care.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-dob">Date of birth</Label>
                  <Input id="s-dob" type="date" value={form.dob ?? ""} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-gender">Gender</Label>
                  <Select id="s-gender" value={form.gender ?? ""} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-blood">Blood group</Label>
                  <Select id="s-blood" value={form.blood_group ?? ""} onChange={(e) => setForm((f) => ({ ...f, blood_group: e.target.value }))}>
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-emergency">Emergency contact</Label>
                  <Input id="s-emergency" value={form.emergency_contact ?? ""} onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-allergies">Allergies (comma separated)</Label>
                  <Input id="s-allergies" value={form.allergies.join(", ")} onChange={(e) => setCommaList("allergies", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-chronic">Chronic conditions</Label>
                  <Input id="s-chronic" value={form.chronic_conditions.join(", ")} onChange={(e) => setCommaList("chronic_conditions", e.target.value)} />
                </div>
              </div>
              <Button onClick={() => saveMedical.mutate()} disabled={saveMedical.isPending}>
                <Save className="size-4" /> {saveMedical.isPending ? "Saving…" : "Save medical profile"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="font-medium">Dark mode</p>
              <p className="text-sm text-muted-foreground">Toggle the color theme</p>
            </div>
            <Switch checked={dark} onCheckedChange={toggleDark} aria-label="Toggle dark mode" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
