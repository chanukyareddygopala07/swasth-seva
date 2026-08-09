"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, QrCode } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

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
  prescriptions: PrescriptionItem[];
  created_at: string;
}

export default function RecordsPage() {
  const [qrOpen, setQrOpen] = useState(false);
  const { data: records, isLoading } = useQuery<MedicalRecord[]>({
    queryKey: ["records"],
    queryFn: () => api<MedicalRecord[]>("/patients/me/records"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Medical records</h1>
        <Button variant="outline" onClick={() => setQrOpen(true)}>
          <QrCode className="size-4" /> My QR
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" /> <Skeleton className="h-40" />
        </div>
      ) : (records ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No records yet</p>
            <p className="text-sm text-muted-foreground">Consultations and prescriptions will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {records!.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{r.diagnosis ?? "Consultation"}</CardTitle>
                    <CardDescription>
                      {r.hospital_name}
                      {r.doctor_name ? ` · Dr. ${r.doctor_name.replace(/^Dr\.\s*/, "")}` : ""} · {formatDate(r.created_at)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{r.symptoms.length} symptoms</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.symptoms.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                )}
                {r.prescriptions.length > 0 && (
                  <div className="rounded-xl border p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prescription</p>
                    <ul className="space-y-2 text-sm">
                      {r.prescriptions.map((p, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{p.medicine}</span>
                          {p.dosage && <Badge variant="outline">{p.dosage}</Badge>}
                          {p.frequency && <Badge variant="outline">{p.frequency}</Badge>}
                          {p.duration && <Badge variant="outline">{p.duration}</Badge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title="Health pass QR">
        <div className="flex flex-col items-center gap-3 p-4">
          <QRCodeSVG value="swasth-seva://patient" size={192} />
          <p className="text-sm text-muted-foreground">Scan at the registration desk for instant check-in.</p>
        </div>
      </Dialog>
    </div>
  );
}
