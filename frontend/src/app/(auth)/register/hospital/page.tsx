import { redirect } from "next/navigation";

export default function HospitalSignupPage() {
  redirect("/register?tab=hospital");
}
