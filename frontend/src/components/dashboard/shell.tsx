"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function DashboardShell({
  items,
  title,
  subtitle,
  children,
  actions,
}: {
  items: NavItem[];
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ss_theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ss_theme", next ? "dark" : "light");
  };

  const nav = (
    <nav aria-label="Dashboard navigation" className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-ring",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="size-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2" aria-label="Swasth Seva home">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-600 text-white">
                <Activity className="size-5" />
              </span>
              <span className="hidden text-sm font-semibold sm:block">{title}</span>
            </Link>
            <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground md:block">
              {subtitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </Button>
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ring"
            >
              <Bell className="size-4.5" />
            </Link>
            <div className="flex items-center gap-2">
              <Avatar name={user?.full_name} src={user?.avatar_url} className="size-8" />
              <span className="hidden max-w-[140px] truncate text-sm font-medium md:block">{user?.full_name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
              <LogOut className="size-4.5" />
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-56 shrink-0 md:block">{nav}</aside>
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-xl md:hidden">
        <div className="flex justify-around py-2">{nav}</div>
      </nav>
    </div>
  );
}
