"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  phone?: string | null;
  full_name: string;
  role: string;
  is_verified: boolean;
  is_active?: boolean;
  hospital_id?: string | null;
  created_at: string;
}

interface HospitalOption {
  id: string;
  name: string;
}

const ROLE_TONES: Record<string, string> = {
  super_admin: "text-purple-600 dark:text-purple-400 border-purple-500/30",
  admin: "text-blue-600 dark:text-blue-400 border-blue-500/30",
  doctor: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  receptionist: "text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  patient: "text-muted-foreground",
};

export default function SuperAdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [open, setOpen] = useState(false);

  const { data: users, isLoading } = useQuery<UserRow[]>({
    queryKey: ["superadmin-users", search, roleFilter],
    queryFn: () =>
      api<UserRow[]>(
        `/superadmin/users?${new URLSearchParams({
          ...(search ? { search } : {}),
          ...(roleFilter ? { role: roleFilter } : {}),
        })}`
      ),
  });

  const { data: hospitals } = useQuery<HospitalOption[]>({
    queryKey: ["hospitals", "options"],
    queryFn: () => api<HospitalOption[]>("/hospitals?page_size=100"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api(`/superadmin/users/${id}?${new URLSearchParams({ is_active: String(is_active) })}`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Users className="size-5 text-primary" /> Users
        </h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Create user
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-40" aria-label="Filter by role">
          <option value="">All roles</option>
          {["patient", "doctor", "receptionist", "admin", "super_admin"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" />
        </div>
      ) : (users ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">No users found.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {users!.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.full_name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.full_name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ""} · joined {formatDate(u.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`border ${ROLE_TONES[u.role] ?? ""}`}>
                      {u.role === "super_admin" && <ShieldCheck className="size-3" />}
                      {u.role}
                    </Badge>
                    {u.is_verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
                    <Button
                      size="sm"
                      variant="ghost"
                      className={u.is_active === false ? "text-emerald-600" : "text-destructive"}
                      onClick={() => toggleActive.mutate({ id: u.id, is_active: u.is_active === false })}
                      disabled={toggleActive.isPending}
                    >
                      {u.is_active === false ? "Activate" : "Deactivate"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CreateUserDialog
        open={open}
        onClose={() => setOpen(false)}
        hospitals={hospitals ?? []}
        onCreated={() => {
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
        }}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onClose,
  hospitals,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  hospitals: HospitalOption[];
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("patient");
  const [hospitalId, setHospitalId] = useState("");
  const [password, setPassword] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<{ temporary_password?: string | null }>(
        `/superadmin/users?${new URLSearchParams({
          full_name: fullName,
          email,
          role,
          ...(phone ? { phone } : {}),
          ...(hospitalId ? { hospital_id: hospitalId } : {}),
          ...(password ? { password } : {}),
        })}`,
        { method: "POST" }
      ),
    onSuccess: (res) => {
      toast.success("User created");
      if (res.temporary_password) setTempPassword(res.temporary_password);
      else {
        onCreated();
        setFullName("");
        setEmail("");
        setPhone("");
        setPassword("");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Create user" description="Provision an account for staff or patients.">
      <div className="space-y-4 p-1">
        {tempPassword ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-500/10 p-4 text-sm">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">User created with a temporary password:</p>
              <p className="mt-2 font-mono text-lg font-bold">{tempPassword}</p>
              <p className="mt-1 text-xs text-muted-foreground">Share this securely with the user. They can change it after logging in.</p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                onCreated();
                setTempPassword(null);
                setFullName("");
                setEmail("");
                setPhone("");
                setPassword("");
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (fullName && email) create.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full name</Label>
              <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-phone">Phone (optional)</Label>
              <Input id="u-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Role</Label>
                <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {["patient", "doctor", "receptionist", "admin"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-hospital">Hospital (staff only)</Label>
                <Select id="u-hospital" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
                  <option value="">None</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-password">Password (optional — auto-generated if empty)</Label>
              <Input id="u-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              <Plus className="size-4" /> {create.isPending ? "Creating…" : "Create user"}
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
