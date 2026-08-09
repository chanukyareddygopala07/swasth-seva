"use client";

import { useQuery } from "@tanstack/react-query";
import { Phone, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FamilyMember {
  id: string;
  full_name: string;
  relation?: string | null;
  blood_group?: string | null;
  phone?: string | null;
}

interface PatientProfile {
  full_name: string;
  family_members: FamilyMember[];
  emergency_contact?: string | null;
}

export default function FamilyPage() {
  const { data: profile, isLoading } = useQuery<PatientProfile>({
    queryKey: ["patient-profile"],
    queryFn: () => api<PatientProfile>("/patients/me"),
  });

  const members = profile?.family_members ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Family</h1>
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Users className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No family members linked</p>
            <p className="text-sm text-muted-foreground">Ask your hospital to link family members to your account.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {members.map((m) => (
            <Card key={m.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar name={m.full_name} />
                  <div>
                    <CardTitle className="text-base">{m.full_name}</CardTitle>
                    <CardDescription>{m.relation ?? "Family member"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                {m.blood_group && <Badge variant="outline">🩸 {m.blood_group}</Badge>}
                {m.phone && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`tel:${m.phone}`}>
                      <Phone className="size-3.5" /> {m.phone}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {profile?.emergency_contact && (
        <p className="text-sm text-muted-foreground">
          Emergency contact: <a className="font-medium text-primary" href={`tel:${profile.emergency_contact}`}>{profile.emergency_contact}</a>
        </p>
      )}
    </div>
  );
}
