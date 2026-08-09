"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
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
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  description?: string | null;
  avg_consultation_minutes?: number | null;
  is_active?: boolean;
  doctors_count?: number | null;
  waiting_count?: number | null;
}

export default function AdminDepartmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avgConsult, setAvgConsult] = useState("15");

  const { data: departments, isLoading } = useQuery<Department[]>({
    queryKey: ["departments", user?.hospital_id],
    queryFn: () => api<Department[]>(`/hospitals/${user!.hospital_id}/departments`),
    enabled: !!user?.hospital_id,
  });

  const create = useMutation({
    mutationFn: () =>
      api(`/hospitals/${user!.hospital_id}/departments`, {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          avg_consultation_minutes: avgConsult ? Number(avgConsult) : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Department added");
      setOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Building2 className="size-5 text-primary" /> Departments
        </h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add department
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" /> <Skeleton className="h-36" /> <Skeleton className="h-36" />
        </div>
      ) : (departments ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-medium">No departments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first department to start managing queues.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments!.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <Badge variant={d.is_active === false ? "outline" : "success"}>
                    {d.is_active === false ? "Inactive" : "Active"}
                  </Badge>
                </div>
                {d.description && <CardDescription>{d.description}</CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-xs">
                {d.avg_consultation_minutes != null && (
                  <Badge variant="outline">⏱ ~{d.avg_consultation_minutes} min/patient</Badge>
                )}
                {d.doctors_count != null && <Badge variant="info">👨‍⚕️ {d.doctors_count} doctors</Badge>}
                {d.waiting_count != null && d.waiting_count > 0 && <Badge variant="warning">⏳ {d.waiting_count} waiting</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add department" description="A new consultation line for your hospital.">
        <form
          className="space-y-4 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Department name</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cardiology" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-desc">Description (optional)</Label>
            <Input id="dept-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Heart & vascular care" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-avg">Avg consultation (minutes)</Label>
            <Select id="dept-avg" value={avgConsult} onChange={(e) => setAvgConsult(e.target.value)}>
              {["10", "15", "20", "30", "45", "60"].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            <Plus className="size-4" /> {create.isPending ? "Adding…" : "Add department"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
