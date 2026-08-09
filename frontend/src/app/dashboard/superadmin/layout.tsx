"use client";

import { LayoutDashboard, ScrollText, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { RequireAuth } from "@/components/dashboard/require-auth";

const items = [
  { href: "/dashboard/superadmin", label: "Global overview", icon: LayoutDashboard },
  { href: "/dashboard/superadmin/users", label: "Users", icon: Users },
  { href: "/dashboard/superadmin/audit-logs", label: "Audit logs", icon: ScrollText },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="super_admin">
      <DashboardShell items={items} title="Platform Admin" subtitle="Swasth Seva network">
        {children}
      </DashboardShell>
    </RequireAuth>
  );
}
