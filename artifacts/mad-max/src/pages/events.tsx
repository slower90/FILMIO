import { CalendarDays, Clapperboard, UsersRound } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";

export default function Events() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6">
        <section className="border border-border bg-card p-6 shadow-2xl sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">FILMIO calendar</p>
              <h1 className="mt-3 font-display text-4xl uppercase tracking-tight sm:text-6xl">Events</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Screenings, workshops, meetups, and industry moments will appear here as they are published.
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
              <CalendarDays className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-10 border border-dashed border-primary/30 bg-background/50 px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clapperboard className="h-6 w-6" />
            </div>
            <h2 className="mt-5 font-display text-2xl uppercase tracking-wider">No upcoming events yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Join the film community to hear about new screenings and industry gatherings first.
            </p>
            <Button asChild className="mt-7 gap-2">
              <Link href="/professionals/community">
                <UsersRound className="h-4 w-4" /> Open film community
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}