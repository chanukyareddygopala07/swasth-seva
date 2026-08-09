"use client";

import { LayoutDashboard, Ticket, UserPlus, CalendarClock, HeartPulse } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { RequireAuth } from "@/components/dashboard/require-auth";

const items = [
  { href: "/dashboard/reception", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/reception/queue", label: "Queue board", icon: Ticket },
  { href: "/dashboard/reception/walk-in", label: "Walk-in token", icon: UserPlus },
  { href: "/dashboard/reception/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/dashboard/reception/emergencies", label: "Emergencies", icon: HeartPulse },
];

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="receptionist">
      <DashboardShell items={items} title="Reception Desk" subtitle="Front desk operations">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
