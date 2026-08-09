"use client";

import { LayoutDashboard, CalendarClock, Ticket, HeartPulse, MapPin, Users, Pill, Settings, FileText } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { RequireAuth } from "@/components/dashboard/require-auth";

const items = [
  { href: "/dashboard/patient", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/patient/book", label: "Book OP visit", icon: CalendarClock },
  { href: "/dashboard/patient/queue", label: "My token & queue", icon: Ticket },
  { href: "/dashboard/patient/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/dashboard/patient/records", label: "Health passport", icon: FileText },
  { href: "/dashboard/patient/nearby", label: "Nearby hospitals", icon: MapPin },
  { href: "/dashboard/patient/family", label: "Family", icon: Users },
  { href: "/dashboard/patient/reminders", label: "Medication reminders", icon: Pill },
  { href: "/dashboard/patient/emergency", label: "Emergency", icon: HeartPulse },
  { href: "/dashboard/patient/settings", label: "Settings", icon: Settings },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="patient">
      <DashboardShell items={items} title="Patient Portal" subtitle="Your health workspace">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
