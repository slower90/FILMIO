import { Navbar } from "@/components/navbar";
import { FreeClassicsSection } from "@/components/free-classics";

export default function FreeClassics() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <main className="pt-[4.5rem]">
        <section className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-background to-background px-4 py-14 md:py-20">
          <div className="container mx-auto max-w-5xl">
            <p className="cinema-kicker">FILMIO archive programme</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold uppercase tracking-[0.04em] md:text-6xl">Free Classics</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">A handpicked screening room of legally free cinema from the Internet Archive, verified free-to-watch YouTube channels, and Wikimedia Commons. Each title shows its source and license.</p>
          </div>
        </section>
        <FreeClassicsSection fullPage />
      </main>
    </div>
  );
}