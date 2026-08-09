"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { HeartPulse, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, priorityColor } from "@/lib/utils";
import { toast } from "sonner";

const EMERGENCY_SYMPTOMS = [
  "chest pain", "breathing difficulty", "unconsciousness", "severe bleeding",
  "seizure", "stroke symptoms", "severe allergic reaction", "high fever",
];

interface EmergencyResult {
  triage_level: string;
  hospital_name?: string | null;
}

export default function EmergencyPage() {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [result, setResult] = useState<EmergencyResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api<EmergencyResult>("/emergency", {
        method: "POST",
        body: JSON.stringify({ symptoms, location }),
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("Emergency alert sent to nearest hospital");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send alert"),
  });

  const toggle = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-red-600 dark:text-red-400">
        <HeartPulse className="size-5" /> Emergency
      </h1>
      {result ? (
        <Card className={cn("border-2", priorityColor(result.triage_level))}>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI triage level</p>
                <p className="text-3xl font-extrabold uppercase">{result.triage_level}</p>
              </div>
              <Badge className="text-base">{result.triage_level === "red" ? "Immediate help notified" : "Nearest hospital notified"}</Badge>
            </div>
            <p className="text-sm">
              {result.triage_level === "red" && "CRITICAL: Emergency services and the nearest hospital have been notified. If possible, call 108 (ambulance) or proceed to the nearest ER immediately."}
              {result.triage_level === "orange" && "URGENT: Go to the nearest hospital emergency desk now. You will be prioritised ahead of the queue."}
              {result.triage_level === "yellow" && "Please proceed to the nearest hospital. Monitor the patient closely."}
              {result.triage_level === "green" && "Non-urgent. Routine consultation is sufficient. Take care."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="destructive">
                <a href="tel:108"><Phone className="size-4" /> Call 108</a>
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setSymptoms([]); }}>
                New request
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What&apos;s happening?</CardTitle>
            <CardDescription>Select all symptoms that apply. This is shared instantly with the nearest hospital.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {EMERGENCY_SYMPTOMS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  aria-pressed={symptoms.includes(s)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors focus-ring",
                    symptoms.includes(s) ? "border-red-500 bg-red-500/10 text-red-600" : "hover:bg-accent"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-location">Your current location</Label>
              <Input
                id="e-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Street, landmark, or pin"
              />
            </div>
            <Button
              variant="destructive"
              size="lg"
              className="w-full"
              disabled={symptoms.length === 0 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              <HeartPulse className="size-4" /> {mutation.isPending ? "Sending…" : "Send emergency alert"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              If this is life-threatening, call <a className="font-semibold text-destructive" href="tel:108">108</a> now.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
