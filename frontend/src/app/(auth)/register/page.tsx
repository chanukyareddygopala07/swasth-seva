"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  const [initialTab, setInitialTab] = useState<"hospital" | "patient">("patient");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    setInitialTab(tab === "hospital" ? "hospital" : "patient");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-4 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2" aria-label="Back to home">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-600 text-white shadow-lg">
            <Activity className="size-5" />
          </span>
          <span className="text-xl font-bold">Swasth Seva</span>
        </Link>
        <Card className="glass">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Join Swasth Seva in under a minute</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm initialTab={initialTab} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
