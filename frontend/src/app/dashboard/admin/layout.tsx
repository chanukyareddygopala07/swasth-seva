"use client";

import { LayoutDashboard, Ticket, Building2, Users, HeartPulse, CalendarClock } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { RequireAuth } from "@/components/dashboard/require-auth";

const items = [
  { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/admin/queues", label: "Queues", icon: Ticket },
  { href: "/dashboard/admin/departments", label: "Departments", icon: Building2 },
  { href: "/dashboard/admin/doctors", label: "Doctors", icon: Users },
  { href: "/dashboard/admin/emergencies", label: "Emergencies", icon: HeartPulse },
  { href: "/dashboard/admin/appointments", label: "Appointments", icon: CalendarClock },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="admin">
      <DashboardShell items={items} title="Hospital Admin" subtitle="Operations & analytics">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
