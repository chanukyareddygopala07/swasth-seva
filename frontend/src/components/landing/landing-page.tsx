"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Brain,
  Clock,
  HeartPulse,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const stats = [
  { value: 42, suffix: "%", label: "Avg. waiting time reduced" },
  { value: 1.2, suffix: "M+", label: "OP consultations managed" },
  { value: 350, suffix: "+", label: "Partner hospitals" },
  { value: 96, suffix: "%", label: "Patient satisfaction" },
];

function Counter({ value, suffix, decimals = 0 }: { value: number; suffix: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const features = [
  { icon: Ticket, title: "Digital OP Tokens", desc: "Skip the paper token. Get a digital token with your queue position instantly." },
  { icon: Clock, title: "AI Wait-Time Prediction", desc: "Random Forest models trained on hospital data predict your wait within minutes." },
  { icon: Brain, title: "AI Symptom Triage", desc: "Describe symptoms and get a Green / Yellow / Orange / Red urgency level instantly." },
  { icon: QrCode, title: "QR Check-in", desc: "Scan your digital health passport QR at the hospital — no registration desk needed." },
  { icon: HeartPulse, title: "Emergency Override", desc: "Emergency cases jump the queue safely with staff-controlled priority overrides." },
  { icon: Users, title: "Family Accounts", desc: "Manage appointments, records and tokens for the whole family from one account." },
  { icon: MapPin, title: "Nearby Hospitals", desc: "Find the best hospital by distance, queue load, doctor availability and ratings." },
  { icon: ShieldCheck, title: "Digital Health Passport", desc: "All your records, prescriptions and visits in one secure, portable profile." },
];

const steps = [
  { n: "01", title: "Register & Login", desc: "Create your patient account in under a minute. Verify with OTP." },
  { n: "02", title: "Choose Hospital & Department", desc: "Compare hospitals by distance, rating, queue load and available doctors." },
  { n: "03", title: "AI Symptom Check", desc: "Our triage model assesses urgency — Green, Yellow, Orange or Red." },
  { n: "04", title: "Get Token + Prediction", desc: "Receive a digital token with predicted wait time and your queue position." },
  { n: "05", title: "Track Live Queue", desc: "Watch the queue update in real time. Get notified when it's your turn." },
  { n: "06", title: "Consult, Prescribe, Feedback", desc: "Doctor completes consultation, issues digital prescription — you rate the visit." },
];

const testimonials = [
  { name: "Ravi Teja", role: "Patient", text: "I used to wait 3 hours at the hospital. Now I know exactly when to leave home. Absolute game changer.", rating: 5 },
  { name: "Dr. Anita Sharma", role: "Consultant Physician", text: "The AI triage gives me a sorted queue before I even enter the clinic. Consultation flow is so much smoother.", rating: 5 },
  { name: "Lakshmi Devi", role: "Hospital Receptionist", text: "Walk-in registration and token generation used to take 5 minutes per patient. Now it's under 30 seconds.", rating: 5 },
];

const plans = [
  {
    name: "Patient",
    price: "Free",
    desc: "For individuals managing their OP visits.",
    features: ["AI triage & wait prediction", "Digital tokens + QR check-in", "Queue tracking (3 hospitals)", "Health passport & reminders"],
  },
  {
    name: "Hospital",
    price: "₹4,999",
    desc: "For hospitals up to 20 OPD counters.",
    features: ["Unlimited tokens & queues", "Live admin dashboard + heat maps", "AI crowd & no-show prediction", "CSV/JSON analytics export", "Staff accounts (10 seats)"],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For chains, multi-speciality & networks.",
    features: ["Everything in Hospital", "Global analytics & command center", "Disease trend dashboards", "Dedicated onboarding & SLA"],
  },
];

const faqs = [
  { q: "Is Swasth Seva a real hospital booking system?", a: "Yes. It connects patients, doctors, receptionists and admins through live queues, tokens and AI predictions backed by real hospital data." },
  { q: "How accurate are the AI predictions?", a: "Waiting-time and crowd models are Random Forest / XGBoost models trained on historical queue data. They also blend live queue state, so accuracy improves as your hospital accumulates data." },
  { q: "Do emergency patients have to wait?", a: "Never. Emergency cases get Red/Orange triage and jump ahead of the queue via staff-controlled override. Hospitals keep emergency lanes separate." },
  { q: "Which hospitals are supported?", a: "Any hospital can onboard. Patients see all active hospitals in their city with live distance, queue load and doctor availability." },
  { q: "Is my health data secure?", a: "Passwords are bcrypt-hashed, tokens are JWT with refresh rotation, and all records are role-scoped. HTTPS is enforced in production." },
];

const hospitals = ["Apollo Health City", "Sunrise Multispeciality", "GreenLeaf Care", "Meridian General", "Nova Institute", "Lotus Children's"];

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });

  return (
    <div className="min-h-screen">
      <main id="main">
        <section ref={heroRef} className="relative overflow-hidden pb-20 pt-28 md:pt-36">
          <div className="absolute inset-0 gradient-hero" aria-hidden />
          <div className="absolute -top-24 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 md:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className={heroInView ? "animate-fade-up" : "opacity-0"}>
                <Badge variant="success" className="mb-4">
                  <Sparkles className="size-3" /> AI-Powered Patient Flow
                </Badge>
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
                  Smart hospital queues.{" "}
                  <span className="bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                    Zero waiting chaos.
                  </span>
                </h1>
                <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                  Swasth Seva digitises the entire OP journey — book visits, get AI triage, receive digital tokens and
                  track live queue position from your phone. Built for patients, doctors, receptionists and hospital
                  administrators.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button variant="gradient" size="lg" asChild>
                    <Link href="/register">
                      Book your first OP <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link href="#how-it-works">See how it works</Link>
                  </Button>
                </div>
                <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
                  {stats.map((s) => (
                    <div key={s.label}>
                      <p className="text-2xl font-bold text-primary md:text-3xl">
                        <Counter value={s.value} suffix={s.suffix} />
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative hidden lg:block" aria-hidden>
                <div className="glass mx-auto max-w-md rounded-3xl p-6 shadow-2xl animate-float">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-600">
                        <Stethoscope className="size-6" />
                      </span>
                      <div>
                        <p className="font-semibold">Apollo Health City</p>
                        <p className="text-xs text-muted-foreground">General Medicine</p>
                      </div>
                    </div>
                    <Badge variant="info">Token #42</Badge>
                  </div>
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 p-5 text-white">
                      <p className="text-sm opacity-90">Predicted wait</p>
                      <p className="text-4xl font-extrabold">18 min</p>
                      <p className="mt-1 text-xs opacity-90">Queue position: 4 · AI model: Random Forest</p>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border p-4">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                        <Users className="size-4.5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">3 patients ahead of you</p>
                        <p className="text-xs text-muted-foreground">Updates live via WebSocket</p>
                      </div>
                      <Badge variant="success">LIVE</Badge>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border p-4">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-600">
                        <Clock className="size-4.5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Peak hours 9–11 AM</p>
                        <p className="text-xs text-muted-foreground">Best time to visit: 2–4 PM</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -left-10 top-8 rounded-2xl bg-white p-3 shadow-xl dark:bg-slate-900 animate-float" style={{ animationDelay: "1.2s" }}>
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-red-500/15 text-red-600">
                      <HeartPulse className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold">Emergency #7</p>
                      <p className="text-[10px] text-muted-foreground">Triage: RED · Override</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Trusted hospitals" className="border-y bg-muted/40 py-10">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Trusted by hospitals across India
            </p>
            <div className="mt-6 overflow-hidden" aria-hidden>
              <div className="flex w-max animate-marquee gap-10">
                {[...hospitals, ...hospitals].map((h, i) => (
                  <span key={i} className="whitespace-nowrap text-sm font-semibold text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="info" className="mb-3">Features</Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Everything the OP desk does, digitised</h2>
            <p className="mt-3 text-muted-foreground">
              From walk-in registration to doctor consultation — every step is connected and real-time.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <f.icon className="size-5.5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="bg-muted/40 py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-3">How it works</Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">From symptom to prescription in 6 steps</h2>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="rounded-2xl border bg-card p-6">
                  <span className="text-3xl font-extrabold text-primary/30">{s.n}</span>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="ai" className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge variant="success" className="mb-3">Built-in AI</Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Real ML models. Not random numbers.</h2>
              <p className="mt-4 text-muted-foreground">
                Scikit-learn Random Forest and XGBoost models trained on queue telemetry power every prediction in the
                platform — and they retrain as your data grows.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  ["Waiting-time prediction", "Random Forest regression on queue size, doctor speed, hour, day & emergencies"],
                  ["Emergency triage", "Symptom-vector classifier → Green / Yellow / Orange / Red with reasoning"],
                  ["Crowd forecasting", "Hourly occupancy predictions for staffing decisions"],
                  ["No-show risk", "XGBoost scoring with reminder automation"],
                  ["Feedback sentiment", "TF-IDF + SGD NLP analysis of patient comments"],
                ].map(([title, desc]) => (
                  <li key={title} className="flex gap-3 rounded-xl border p-4">
                    <Brain className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-3xl p-6 shadow-xl">
              <p className="text-sm font-semibold">AI Triage demo</p>
              <div className="mt-4 space-y-3">
                {[
                  { level: "RED", desc: "Chest pain + breathing difficulty", color: "bg-red-500" },
                  { level: "ORANGE", desc: "High fever + vomiting + dehydration", color: "bg-orange-500" },
                  { level: "YELLOW", desc: "Persistent headache + mild fever", color: "bg-yellow-500" },
                  { level: "GREEN", desc: "Mild cold + cough", color: "bg-emerald-500" },
                ].map((row) => (
                  <div key={row.level} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white ${row.color}`}>
                      {row.level}
                    </span>
                    <span className="text-sm">{row.desc}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Try it for real: register, describe your symptoms and see your triage level + recommended department.
              </p>
              <Button variant="gradient" className="mt-3 w-full" asChild>
                <Link href="/register">Try the symptom checker</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-muted/40 py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-3">Testimonials</Badge>
              <h2 className="text-3xl font-bold tracking-tight">Loved by patients & staff</h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <figure key={t.name} className="rounded-2xl border bg-card p-6">
                  <div className="text-yellow-500" aria-label={`${t.rating} out of 5 stars`}>
                    {"★".repeat(t.rating)}
                  </div>
                  <blockquote className="mt-3 text-sm text-muted-foreground">“{t.text}”</blockquote>
                  <figcaption className="mt-4 font-medium">{t.name} <span className="text-xs text-muted-foreground">· {t.role}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="info" className="mb-3">Pricing</Badge>
            <h2 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.name} className={`relative rounded-3xl border bg-card p-6 ${p.popular ? "shadow-xl ring-2 ring-primary" : ""}`}>
                {p.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
                )}
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-3xl font-extrabold">{p.price}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                <ul className="mt-6 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Activity className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant={p.popular ? "gradient" : "outline"} className="mt-6 w-full" asChild>
                  <Link href="/register/hospital">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 py-20 md:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border bg-card p-5">
                <summary className="cursor-pointer list-none font-medium focus-ring rounded-lg [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {f.q}
                    <span className="text-primary transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
          <div className="glass rounded-3xl p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Ready to modernise your hospital?</h2>
                <p className="mt-3 text-muted-foreground">
                  Onboard your hospital in under a day. Our team sets up departments, doctors and live queues for you.
                </p>
                <p className="mt-6 text-sm text-muted-foreground">
                  📧 hello@swasthseva.app · 📞 +91 80000 00000
                </p>
              </div>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  alert("Thank you! Our team will reach out within 24 hours.");
                }}
              >
                <label className="sr-only" htmlFor="contact-name">Your name</label>
                <input id="contact-name" required placeholder="Your name" className="w-full rounded-xl border bg-background px-4 py-3 text-sm focus-ring" />
                <label className="sr-only" htmlFor="contact-email">Work email</label>
                <input id="contact-email" type="email" required placeholder="Work email" className="w-full rounded-xl border bg-background px-4 py-3 text-sm focus-ring" />
                <label className="sr-only" htmlFor="contact-msg">Message</label>
                <textarea id="contact-msg" required placeholder="Tell us about your hospital" rows={3} className="w-full rounded-xl border bg-background px-4 py-3 text-sm focus-ring" />
                <Button type="submit" variant="gradient" className="w-full">Request a demo</Button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
