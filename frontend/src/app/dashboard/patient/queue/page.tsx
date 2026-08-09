"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { QrCode, Radio, Ticket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, getWsUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, priorityColor, tokenStatusLabel } from "@/lib/utils";

interface TokenInfo {
  id: string;
  token_number: number;
  priority: string;
  status: string;
  predicted_wait_minutes?: number | null;
  actual_wait_minutes?: number | null;
  patients_ahead?: number | null;
  current_token?: number | null;
  queue_id: string;
  hospital_name?: string | null;
  department_name?: string | null;
  doctor_name?: string | null;
}

export default function QueuePage() {
  const { data: token, isLoading, refetch } = useQuery<TokenInfo | null>({
    queryKey: ["my-token"],
    queryFn: () => api<TokenInfo>("/tokens/mine/latest").catch(() => null),
  });
  const [live, setLive] = useState<TokenInfo | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token?.queue_id) return;
    const ws = new WebSocket(getWsUrl("queue", token.queue_id));
    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data?.id === token.id || msg.event === "current_token") {
          setLive((prev) => ({ ...(prev ?? token), ...msg.data }));
          refetch();
        }
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [token, refetch]);

  const active = live ?? token;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Live queue tracking</h1>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !active ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Ticket className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No active token</p>
            <p className="text-sm text-muted-foreground">Book an OP visit to get your token and track the queue here.</p>
            <Button asChild className="mt-4"><Link href="/dashboard/patient/book">Book an OP visit</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Token #{active.token_number}
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase",
                    connected ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                  )}
                  role="status"
                >
                  <span className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                  {connected ? "Live" : "Reconnecting"}
                </span>
              </CardTitle>
              <CardDescription>
                {active.hospital_name} · {active.department_name} {active.doctor_name ? `· Dr. ${active.doctor_name}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-2xl font-bold capitalize">{tokenStatusLabel(active.status)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Predicted wait</p>
                  <p className="text-2xl font-bold">{active.predicted_wait_minutes ?? "—"} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Patients ahead</p>
                  <p className="text-2xl font-bold">{active.patients_ahead ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Now serving</p>
                  <p className="text-2xl font-bold">{active.current_token ?? "—"}</p>
                </div>
              </div>
              <div className="mt-6 rounded-xl bg-muted p-4 text-sm">
                <Radio className="mb-1 inline size-4 text-primary" aria-hidden />
                Updates arrive in real time over WebSocket. When your token is called, you&apos;ll get a notification.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-5 text-primary" /> Check-in QR
              </CardTitle>
              <CardDescription>Show this at the hospital desk</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <QRCodeSVG value={`swasth-seva://token/${active.id}`} size={176} />
              <Badge className={`border ${priorityColor(active.priority)}`}>
                Priority {active.priority?.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
