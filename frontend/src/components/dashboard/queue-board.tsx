"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowRightLeft, CheckCircle2, PhoneCall, SkipForward,
} from "lucide-react";
import { api, getWsUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, priorityColor, tokenStatusLabel } from "@/lib/utils";
import { toast } from "sonner";

interface QueueToken {
  id: string;
  token_number: number;
  priority: string;
  status: string;
  symptoms: string[];
  predicted_wait_minutes?: number | null;
  created_at: string;
}

interface QueueInfo {
  id: string;
  hospital_id: string;
  hospital_name?: string | null;
  department_id: string;
  department_name?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  date: string;
  is_active: boolean;
  next_token: number;
  current_token?: number | null;
  current_token_priority?: string | null;
  waiting_count: number;
  called_count: number;
  completed_count: number;
  avg_wait_minutes?: number | null;
  tokens: QueueToken[];
}

const PRIORITY_ORDER: Record<string, number> = { red: 0, orange: 1, yellow: 2, green: 3 };

export function QueueBoard({ queueId }: { queueId: string }) {
  const queryClient = useQueryClient();
  const [transferToken, setTransferToken] = useState<QueueToken | null>(null);

  const { data: queue, isLoading } = useQuery<QueueInfo>({
    queryKey: ["queue", queueId],
    queryFn: () => api<QueueInfo>(`/queues/${queueId}`),
  });

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ["queue", queueId] });
    await queryClient.invalidateQueries({ queryKey: ["queues"] });
  };

  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    const ws = new WebSocket(getWsUrl("queue", queueId));
    wsRef.current = ws;
    ws.onmessage = () => void refetch();
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueId]);

  const act = (fn: () => Promise<unknown>, message: string) =>
    fn()
      .then(() => {
        toast.success(message);
        void refetch();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Action failed"));

  const callNext = useMutation({
    mutationFn: () => api(`/queues/${queueId}/call-next`, { method: "POST" }),
    onSuccess: () => { toast.success("Next token called"); void refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Call failed"),
  });

  const complete = (tokenId: string) =>
    act(() => api(`/tokens/${tokenId}/complete`, { method: "POST" }), "Token completed");

  const skip = (tokenId: string) =>
    act(() => api(`/tokens/${tokenId}/skip`, { method: "POST" }), "Token skipped");

  const override = useMutation({
    mutationFn: () => api(`/queues/${queueId}/emergency-override`, { method: "POST" }),
    onSuccess: () => { toast.success("Emergency token prioritised"); void refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Override failed"),
  });

  const close = useMutation({
    mutationFn: () => api(`/queues/${queueId}/close`, { method: "POST" }),
    onSuccess: () => { toast.success("Queue closed for the day"); void refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Close failed"),
  });

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (!queue) return <p className="text-sm text-muted-foreground">Queue not found.</p>;

  const waiting = queue.tokens
    .filter((t) => t.status === "waiting" || t.status === "emergency")
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || +new Date(a.created_at) - +new Date(b.created_at));
  const called = queue.tokens.filter((t) => t.status === "called");
  const done = queue.tokens.filter((t) => t.status === "completed");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {queue.department_name ?? "Queue"}
                {queue.doctor_name && <span className="font-normal text-muted-foreground">· Dr. {queue.doctor_name}</span>}
                <Badge variant={queue.is_active ? "success" : "outline"}>{queue.is_active ? "Active" : "Closed"}</Badge>
              </CardTitle>
              <CardDescription>
                {queue.hospital_name ?? "Hospital"} · {queue.date}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="gradient"
                disabled={!queue.is_active || waiting.length === 0 || callNext.isPending}
                onClick={() => callNext.mutate()}
              >
                <PhoneCall className="size-4" /> Call next
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!queue.is_active || override.isPending}
                onClick={() => override.mutate()}
              >
                <AlertTriangle className="size-4" /> Emergency override
              </Button>
              {queue.is_active && (
                <Button size="sm" variant="outline" onClick={() => close.mutate()} disabled={close.isPending}>
                  Close queue
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Now serving" value={queue.current_token != null ? `#${queue.current_token}` : "—"} />
            <Metric label="Next token" value={queue.next_token != null ? `#${queue.next_token}` : "—"} />
            <Metric label="Waiting" value={String(queue.waiting_count)} />
            <Metric label="Avg wait" value={queue.avg_wait_minutes != null ? `${queue.avg_wait_minutes} min` : "—"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="In consultation">
          <h2 className="mb-3 font-semibold">In consultation</h2>
          {called.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No patient in consultation right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {called.map((t) => (
                <TokenCard key={t.id} token={t} onComplete={complete} onSkip={skip} onTransfer={setTransferToken} />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Waiting queue">
          <h2 className="mb-3 font-semibold">Waiting queue ({waiting.length})</h2>
          {waiting.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Queue is empty — call next when ready.
            </p>
          ) : (
            <ul className="space-y-3">
              {waiting.map((t) => (
                <TokenCard key={t.id} token={t} onComplete={complete} onSkip={skip} onTransfer={setTransferToken} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {done.length > 0 && (
        <section aria-label="Completed tokens">
          <h2 className="mb-3 font-semibold">Completed today ({done.length})</h2>
          <div className="flex flex-wrap gap-2">
            {done.map((t) => (
              <Badge key={t.id} variant="outline" className="font-mono">#{t.token_number}</Badge>
            ))}
          </div>
        </section>
      )}

      <TransferDialog
        token={transferToken}
        queue={queue}
        onClose={() => setTransferToken(null)}
        onDone={() => {
          setTransferToken(null);
          void refetch();
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function TokenCard({
  token,
  onComplete,
  onSkip,
  onTransfer,
}: {
  token: QueueToken;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onTransfer: (t: QueueToken) => void;
}) {
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-12 items-center justify-center rounded-2xl text-lg font-extrabold", priorityColor(token.priority))}>
            {token.token_number}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">#{token.token_number}</p>
              <Badge className={cn("border", priorityColor(token.priority))}>{token.priority.toUpperCase()}</Badge>
              <span className="text-xs text-muted-foreground">{tokenStatusLabel(token.status)}</span>
            </div>
            {token.symptoms.length > 0 && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{token.symptoms.join(", ")}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {token.status === "waiting" || token.status === "emergency" ? (
            <Button size="sm" variant="outline" onClick={() => onSkip(token.id)}>
              <SkipForward className="size-3.5" /> Skip
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onTransfer(token)}>
              <ArrowRightLeft className="size-3.5" /> Transfer
            </Button>
          )}
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={token.status !== "called"} onClick={() => onComplete(token.id)}>
            <CheckCircle2 className="size-3.5" /> Complete
          </Button>
        </div>
      </div>
    </li>
  );
}

function TransferDialog({
  token,
  queue,
  onClose,
  onDone,
}: {
  token: QueueToken | null;
  queue: QueueInfo;
  onClose: () => void;
  onDone: () => void;
}) {
  const [departmentId, setDepartmentId] = useState("");
  const { data: departments } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["departments", queue.hospital_id],
    queryFn: () => api<Array<{ id: string; name: string }>>(`/hospitals/${queue.hospital_id}/departments`),
    enabled: !!token,
  });

  const transfer = useMutation({
    mutationFn: () => api(`/tokens/${token!.id}/transfer`, { method: "POST", body: JSON.stringify({ department_id: departmentId }) }),
    onSuccess: () => {
      toast.success(`Token #${token!.token_number} transferred`);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transfer failed"),
  });

  return (
    <Dialog open={!!token} onClose={onClose} title={`Transfer token #${token?.token_number ?? ""}`} description="Reassign this patient to another department.">
      {token && (
        <div className="space-y-4 p-2">
          <div className="space-y-2">
            <label htmlFor="transfer-dept" className="text-xs font-medium text-muted-foreground">Target department</label>
            <Select id="transfer-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Select department…</option>
              {(departments ?? [])
                .filter((d) => d.id !== queue.department_id)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </Select>
          </div>
          <Button className="w-full" disabled={!departmentId || transfer.isPending} onClick={() => transfer.mutate()}>
            <ArrowRightLeft className="size-4" /> {transfer.isPending ? "Transferring…" : "Transfer patient"}
          </Button>
        </div>
      )}
    </Dialog>
  );
}
