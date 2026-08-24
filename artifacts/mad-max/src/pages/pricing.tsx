import { Link } from "wouter";
import { ArrowRight, Check, Clapperboard, Crown, X } from "lucide-react";
import { Navbar } from "@/components/navbar";

type PlanFeature = {
  label: string;
  free: boolean;
  pro: boolean;
};

const features: PlanFeature[] = [
  { label: "Core browsing and search", free: true, pro: true },
  { label: "Reviews and ratings", free: true, pro: true },
  { label: "Basic actor profiles", free: true, pro: true },
  { label: "Follows", free: true, pro: true },
  { label: "Watchlists", free: true, pro: true },
  { label: "Encrypted actor-to-actor messaging", free: false, pro: true },
  { label: "Verified badge", free: false, pro: true },
  { label: "Ad-free experience", free: false, pro: true },
  { label: "Advanced analytics", free: false, pro: true },
  { label: "Priority support", free: false, pro: true },
  { label: "Early access features", free: false, pro: true },
];

function FeatureMark({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"
      aria-label="Included"
    >
      <Check className="h-4 w-4" aria-hidden="true" />
    </span>
  ) : (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-neutral-600"
      aria-label="Not included"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-white/10 px-5 pb-16 pt-32 md:pb-20 md:pt-40">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute left-1/2 top-0 h-[32rem] w-[46rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
            <div className="absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
          </div>

          <div className="relative mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              Professional access
            </div>
            <h1 className="font-display text-5xl font-bold uppercase tracking-tight text-white text-glow md:text-7xl">
              Choose your <span className="text-primary">cut</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-neutral-400 md:text-lg">
              Go from discovering great stories to building your place in the
              entertainment community.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 md:py-16">
          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2 lg:items-stretch">
            <article className="flex flex-col rounded-2xl border border-white/10 bg-[#101014] p-6 md:p-8">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
                  For every fan
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-wider">
                  Free
                </h2>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  The essential FILMIO experience for finding your next
                  obsession.
                </p>
              </div>

              <div className="mb-8 flex items-end gap-2">
                <span className="font-display text-5xl font-bold">₹0</span>
                <span className="mb-2 text-sm text-neutral-500">forever</span>
              </div>

              <Link
                href="/"
                className="mb-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/15 px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white transition hover:border-primary hover:text-primary"
              >
                Explore for free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>

              <div className="mt-auto space-y-4 border-t border-white/10 pt-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
                  Includes
                </p>
                <ul className="space-y-4 text-sm text-neutral-300">
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    Core browsing and search
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    Reviews, ratings, and basic actor profiles
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    Limited follows and 1 basic watchlist
                  </li>
                </ul>
              </div>
            </article>

            <article className="relative flex flex-col overflow-hidden rounded-2xl border border-primary/70 bg-gradient-to-b from-primary/20 via-background to-card p-6 shadow-[0_0_70px_-22px_hsl(var(--primary)/0.8)] md:p-8">
              <div className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-lg shadow-primary/25">
                Most Popular
              </div>
              <div className="mb-8 pr-28">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                  For working creators
                </p>
                <h2 className="mt-3 flex items-center gap-2 font-display text-3xl font-bold uppercase tracking-wider">
                  Pro
                  <Clapperboard className="h-6 w-6 text-primary" aria-hidden="true" />
                </h2>
                <p className="mt-3 text-sm leading-6 text-neutral-300">
                  More reach, deeper connections, and a sharper view of your
                  professional journey.
                </p>
              </div>

              <div className="mb-8 flex items-end gap-2">
                <span className="font-display text-5xl font-bold text-primary">₹199</span>
                <span className="mb-2 text-sm text-neutral-400">/ month</span>
              </div>

              <Link
                href="/sign-up?redirect=/professionals/dashboard"
                className="mb-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-primary-foreground transition hover:bg-primary/85"
              >
                Start with Pro
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>

              <div className="mt-auto space-y-4 border-t border-white/15 pt-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Everything in Free, plus
                </p>
                <ul className="space-y-4 text-sm text-neutral-200">
                  {features
                    .filter((feature) => !feature.free && feature.pro)
                    .map((feature) => (
                      <li key={feature.label} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        {feature.label}
                      </li>
                    ))}
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section className="px-5 pb-16 md:pb-24">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d11]">
            <div className="border-b border-white/10 px-5 py-6 md:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Compare plans
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wider">
                Pick your access level
              </h2>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[36rem]">
                <div className="grid grid-cols-[1fr_7rem_7rem] border-b border-white/10 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 md:grid-cols-[1fr_9rem_9rem] md:px-8">
                  <span>Feature</span>
                  <span className="text-center">Free</span>
                  <span className="text-center text-primary">Pro</span>
                </div>
                {features.map((feature) => (
                  <div
                    key={feature.label}
                    className="grid grid-cols-[1fr_7rem_7rem] items-center border-b border-white/5 px-5 py-4 text-sm last:border-0 md:grid-cols-[1fr_9rem_9rem] md:px-8"
                  >
                    <span className="pr-4 text-neutral-300">{feature.label}</span>
                    <span className="flex justify-center">
                      <FeatureMark enabled={feature.free} />
                    </span>
                    <span className="flex justify-center">
                      <FeatureMark enabled={feature.pro} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="launch-note" className="px-5 pb-20">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-xl border border-primary/40 bg-primary/10 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
            <p className="text-sm font-medium leading-6 text-[#ffd3d9]">
              Everything is free right now — launch phase, no charges yet, go
              and explore all features.
            </p>
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary hover:text-white"
            >
              Explore FILMIO
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

    </div>
  );
}