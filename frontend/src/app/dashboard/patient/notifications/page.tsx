"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  body?: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications"),
  });

  const unread = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Bell className="size-5 text-primary" /> Notifications
          {unread > 0 && <Badge variant="info">{unread} new</Badge>}
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/patient/book">Book OP visit</Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" /> <Skeleton className="h-20 w-full" />
        </div>
      ) : (notifications ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            You&apos;re all caught up. Notifications for token calls, appointments and reminders will appear here.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {notifications!.map((n) => (
            <li key={n.id}>
              <Card className={n.is_read ? "opacity-70" : "border-primary/40"}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-medium">{n.title}</CardTitle>
                      {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {!n.is_read && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
                      {formatTime(n.created_at)}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
