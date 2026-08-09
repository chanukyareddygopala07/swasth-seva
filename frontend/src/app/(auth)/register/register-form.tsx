"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth, dashboardPath } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const patientSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const hospitalSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  hospital_name: z.string().min(2, "Enter hospital name"),
  hospital_city: z.string().optional(),
  hospital_address: z.string().optional(),
  hospital_phone: z.string().optional(),
  role: z.string(),
});

export function RegisterForm({ initialTab = "patient" }: { initialTab?: string }) {
  const { registerPatient, registerHospital } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);

  const patientForm = useForm({ resolver: zodResolver(patientSchema) });
  const hospitalForm = useForm({ resolver: zodResolver(hospitalSchema) });

  const onPatient = async (data: unknown) => {
    setLoading(true);
    const ok = await registerPatient(data as Record<string, unknown>);
    setLoading(false);
    if (ok) router.push(dashboardPath("patient"));
  };

  const onHospital = async (data: unknown) => {
    setLoading(true);
    const ok = await registerHospital(data as Record<string, unknown>);
    setLoading(false);
    if (ok) router.push(dashboardPath("admin"));
  };

  return (
    <>
      <Tabs
        tabs={[
          { value: "patient", label: "Patient" },
          { value: "hospital", label: "Hospital staff" },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-6 w-full justify-center"
      />

      {tab === "patient" && (
        <form onSubmit={patientForm.handleSubmit(onPatient)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="p-name">Full name</Label>
            <Input id="p-name" placeholder="Ravi Teja" {...patientForm.register("full_name")} />
            {patientForm.formState.errors.full_name && (
              <p className="text-sm text-destructive">{patientForm.formState.errors.full_name.message?.toString()}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-email">Email</Label>
            <Input id="p-email" type="email" placeholder="you@example.com" {...patientForm.register("email")} />
            {patientForm.formState.errors.email && (
              <p className="text-sm text-destructive">{patientForm.formState.errors.email.message?.toString()}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-phone">Phone (optional)</Label>
            <Input id="p-phone" type="tel" placeholder="+91 98765 43210" {...patientForm.register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-password">Password</Label>
            <Input id="p-password" type="password" placeholder="Min 8 characters" {...patientForm.register("password")} />
            {patientForm.formState.errors.password && (
              <p className="text-sm text-destructive">{patientForm.formState.errors.password.message?.toString()}</p>
            )}
          </div>
          <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={loading}>
            {loading ? "Creating account…" : "Create patient account"}
          </Button>
        </form>
      )}

      {tab === "hospital" && (
        <form onSubmit={hospitalForm.handleSubmit(onHospital)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="h-name">Your full name</Label>
            <Input id="h-name" placeholder="Lakshmi Devi" {...hospitalForm.register("full_name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-email">Work email</Label>
            <Input id="h-email" type="email" placeholder="you@hospital.com" {...hospitalForm.register("email")} />
            {hospitalForm.formState.errors.email && (
              <p className="text-sm text-destructive">{hospitalForm.formState.errors.email.message?.toString()}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-hospital">Hospital name</Label>
            <Input id="h-hospital" placeholder="Sunrise Multispeciality Hospital" {...hospitalForm.register("hospital_name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-city">City</Label>
            <Input id="h-city" placeholder="Hyderabad" {...hospitalForm.register("hospital_city")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-phone">Hospital phone</Label>
            <Input id="h-phone" type="tel" placeholder="+91 40 1234 5678" {...hospitalForm.register("hospital_phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-password">Password</Label>
            <Input id="h-password" type="password" placeholder="Min 8 characters" {...hospitalForm.register("password")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-role">Role</Label>
            <select id="h-role" className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" {...hospitalForm.register("role")}>
              <option value="admin">Hospital Admin</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </div>
          <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={loading}>
            {loading ? "Registering hospital…" : "Register hospital"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
