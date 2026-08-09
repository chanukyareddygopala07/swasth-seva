"use client";

import { LayoutDashboard, Ticket, Stethoscope, CalendarClock, UserCog } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { RequireAuth } from "@/components/dashboard/require-auth";

const items = [
  { href: "/dashboard/doctor", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/doctor/queue", label: "Queue board", icon: Ticket },
  { href: "/dashboard/doctor/consultation", label: "Consultation", icon: Stethoscope },
  { href: "/dashboard/doctor/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/dashboard/doctor/profile", label: "Profile", icon: UserCog },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="doctor">
      <DashboardShell items={items} title="Doctor Portal" subtitle="Your consultation workspace">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
