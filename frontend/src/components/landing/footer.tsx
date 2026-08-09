import Link from "next/link";
import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-emerald-600 text-white">
                <Activity className="size-4" />
              </span>
              <span className="font-bold">Swasth Seva</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              AI-powered smart hospital queue and patient flow management. Health for everyone, everywhere.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#ai" className="hover:text-foreground">AI modules</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Company</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/login" className="hover:text-foreground">Login</Link></li>
              <li><Link href="/register" className="hover:text-foreground">Patient signup</Link></li>
              <li><Link href="/register/hospital" className="hover:text-foreground">Hospital signup</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Privacy policy</a></li>
              <li><a href="#" className="hover:text-foreground">Terms of service</a></li>
              <li><a href="#" className="hover:text-foreground">HIPAA & compliance</a></li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Swasth Seva. Built with care for patients and hospitals.
        </p>
      </div>
    </footer>
  );
}
