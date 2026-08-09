"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatTime } from "@/lib/utils";
import { useState } from "react";

interface AuditLog {
  id: string;
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  details: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
  user_email?: string | null;
}

export default function AuditLogsPage() {
  const [filter, setFilter] = useState("");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs", filter],
    queryFn: () =>
      api<AuditLog[]>(`/superadmin/audit-logs${filter ? `?action=${encodeURIComponent(filter)}` : ""}`),
  });

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <ScrollText className="size-5 text-primary" /> Audit logs
      </h1>
      <div className="relative max-w-sm">
        <Input
          placeholder="Filter by action (e.g. user.create)…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter audit logs"
        />
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" />
        </div>
      ) : (logs ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No audit log entries.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {logs!.map((log) => (
                <li key={log.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{log.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {log.user_email ?? "system"}
                        {log.entity ? ` · ${log.entity}${log.entity_id ? `:${log.entity_id.slice(0, 8)}` : ""}` : ""}
                        {log.ip_address ? ` · ${log.ip_address}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {Object.keys(log.details).length > 0 && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {JSON.stringify(log.details).slice(0, 60)}
                        </Badge>
                      )}
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(log.created_at, { hour: "2-digit", minute: "2-digit" })} · {formatTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
