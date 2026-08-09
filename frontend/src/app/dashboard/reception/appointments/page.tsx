"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatTime } from "@/lib/utils";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  reason?: string | null;
  doctor_name?: string | null;
  department_name?: string | null;
  token_number?: number | null;
}

export default function ReceptionAppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["departments", user?.hospital_id],
    queryFn: () => api<Department[]>(`/hospitals/${user!.hospital_id}/departments`),
    enabled: !!user?.hospital_id,
  });

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments", "reception"],
    queryFn: () => api<Appointment[]>("/appointments?status=scheduled"),
  });

  const create = useMutation({
    mutationFn: () =>
      api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          hospital_id: user!.hospital_id,
          department_id: departmentId || undefined,
          patient_phone: phone,
          scheduled_at: new Date(scheduledAt).toISOString(),
          reason: reason || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Appointment booked");
      setOpen(false);
      setPhone("");
      setReason("");
      setScheduledAt("");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Booking failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <CalendarClock className="size-5 text-primary" /> Appointments
        </h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Book appointment
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (appointments ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No scheduled appointments</p>
            <p className="mt-1 text-sm text-muted-foreground">Book one for a patient using their phone number.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {appointments!.map((a) => (
            <li key={a.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {formatDate(a.scheduled_at)} · {formatTime(a.scheduled_at)}
                      </CardTitle>
                      <CardDescription>
                        {a.department_name ?? "Department"}
                        {a.doctor_name ? ` · Dr. ${a.doctor_name}` : ""}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.token_number != null && <Badge variant="info">Token #{a.token_number}</Badge>}
                      <Badge variant="outline" className="capitalize">{a.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Book appointment" description="Create an appointment for a walk-in patient using their phone number.">
        <form
          className="space-y-4 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (phone && scheduledAt) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="r-phone">Patient phone</Label>
            <Input id="r-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-dept">Department (optional)</Label>
            <Select id="r-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Any / first available</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-time">Date & time</Label>
            <Input id="r-time" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-reason">Reason (optional)</Label>
            <Input id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Follow-up, check-up…" />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            <Plus className="size-4" /> {create.isPending ? "Booking…" : "Book appointment"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
