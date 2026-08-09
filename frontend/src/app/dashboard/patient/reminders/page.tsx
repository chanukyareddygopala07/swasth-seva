"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Reminder {
  id: string;
  medicine: string;
  dosage?: string | null;
  reminder_time: string;
  active: boolean;
}

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const [medicine, setMedicine] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("20:00");

  const { data: reminders, isLoading } = useQuery<Reminder[]>({
    queryKey: ["reminders"],
    queryFn: () => api<Reminder[]>("/medication-reminders"),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api<Reminder>("/medication-reminders", { method: "POST", body: JSON.stringify({ medicine, dosage, reminder_time: time }) }),
    onSuccess: () => {
      setMedicine("");
      setDosage("");
      toast.success("Reminder added");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add reminder"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api(`/medication-reminders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Reminder removed");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const sorted = (reminders ?? []).slice().sort((a, b) => a.reminder_time.localeCompare(b.reminder_time));

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Bell className="size-5 text-primary" /> Medication reminders
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a reminder</CardTitle>
          <CardDescription>You&apos;ll get a push notification at the set time.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (medicine.trim()) addMutation.mutate();
            }}
          >
            <div className="flex-1 space-y-1" style={{ minWidth: 160 }}>
              <Label htmlFor="r-medicine">Medicine</Label>
              <Input id="r-medicine" value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="e.g. Paracetamol 650mg" required />
            </div>
            <div className="space-y-1" style={{ minWidth: 120 }}>
              <Label htmlFor="r-dosage">Dosage</Label>
              <Input id="r-dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="1 tablet" />
            </div>
            <div className="w-32 space-y-1">
              <Label htmlFor="r-time">Time</Label>
              <Input id="r-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <Button type="submit" disabled={addMutation.isPending}>
              <Plus className="size-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reminders yet. Add one above to get started.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => (
            <li key={r.id}>
              <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="size-4 text-primary" />
                  </span>
                  <div>
                    <p className="font-medium">{r.medicine}</p>
                    {r.dosage && <p className="text-sm text-muted-foreground">{r.dosage}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.reminder_time}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`Delete reminder for ${r.medicine}`}
                    onClick={() => removeMutation.mutate(r.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
