import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, Boxes, Clapperboard, Eye, Route } from "lucide-react";
import { Link } from "wouter";
import { Navbar } from "@/components/navbar";

const vishnuvaAssetBase = `${import.meta.env.BASE_URL}vishnuva`;

const missions = [
  {
    id: "movement",
    phase: "Phase 1",
    title: "Vishnuva Logistics",
    discipline: "Movement",
    icon: Route,
    image: `${vishnuvaAssetBase}/mission-logistics.svg`,
    imageAlt: "Abstract night route map with a glowing logistics path",
    focus: "Movement systems",
    signal: "Routes / freight / access",
    copy: "Sabki roz ki zaroorat — reliable transportation se shuru. Taxi services se logistics/freight network tak, Vishnuva ka foundation hai log aur samaan ko sahi jagah, sahi time pe pahunchana.",
    note: "The foundation",
  },
  {
    id: "storytelling",
    phase: "Phase 2",
    title: "Vishnuva Studios",
    discipline: "Storytelling",
    icon: Clapperboard,
    image: `${vishnuvaAssetBase}/mission-studios.svg`,
    imageAlt: "Abstract film studio light illuminating a cinematic frame",
    focus: "Original stories",
    signal: "Film / television / culture",
    copy: "FILMIO discovery aur review se shuru hui — agla kadam hai khud content banana. Movie/TV production aur original storytelling, jo FILMIO ke platform pe hi showcase ho.",
    note: "The next frame",
  },
  {
    id: "visibility",
    phase: "Phase 3",
    title: "Vishnuva Marketing",
    discipline: "Visibility",
    icon: Eye,
    image: `${vishnuvaAssetBase}/mission-marketing.svg`,
    imageAlt: "Abstract signal network connecting brands to an audience",
    focus: "Useful visibility",
    signal: "Brands / audience / reach",
    copy: "Brands ko apni audience tak pahunchana — advertising aur marketing solutions, jo Vishnuva ke apne platforms (jaise FILMIO) ke through businesses ko real reach dete hain.",
    note: "The wider signal",
  },
];

export default function AboutVishnuva() {
  return (
    <div className="about-vishnuva-page min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <Navbar />

      <main>
        <section className="about-vishnuva-hero relative isolate" aria-labelledby="about-vishnuva-title">
          <div className="about-vishnuva-hero-grid" aria-hidden="true" />
          <div className="about-vishnuva-orbit about-vishnuva-orbit--one" aria-hidden="true" />
          <div className="about-vishnuva-orbit about-vishnuva-orbit--two" aria-hidden="true" />

          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-24 pt-36 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-20 lg:pb-32 lg:pt-48">
            <div className="max-w-5xl">
              <Link
                href="/"
                className="about-vishnuva-back editorial-kicker mb-10"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to FILMIO
              </Link>
              <p className="cinema-kicker mb-6 about-vishnuva-reveal">Vishnuva Group / Company note</p>
              <h1 id="about-vishnuva-title" className="about-vishnuva-title about-vishnuva-reveal">
                Vishnuva Group <span>—</span>
                <br />
                Building Tomorrow&apos;s
                <br />
                Everyday Life
              </h1>
              <div className="mt-9 grid max-w-3xl gap-8 border-t border-primary/35 pt-7 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-12">
                <p className="about-vishnuva-index">01 / 03</p>
                <p className="about-vishnuva-tagline">
                  From movement to entertainment to visibility — one group, three missions.
                </p>
              </div>
            </div>

            <div className="about-vishnuva-hero-mark" aria-label="Vishnuva Group mark">
              <div className="about-vishnuva-mark-orbit">
                <span className="about-vishnuva-mark-core">V</span>
              </div>
              <div className="about-vishnuva-mark-caption">
                <span>India</span>
                <span>Long-term vision</span>
              </div>
            </div>
          </div>

          <a href="#missions" className="about-vishnuva-scroll-cue" aria-label="Scroll to the three missions">
            <span>Read the roadmap</span>
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </a>
        </section>

        <section id="missions" className="about-vishnuva-missions relative" aria-labelledby="missions-title">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-36">
            <div className="grid gap-14 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-24">
              <div className="lg:sticky lg:top-32 lg:self-start">
                <p className="editorial-kicker">The roadmap</p>
                <h2 id="missions-title" className="mt-5 max-w-xs text-3xl font-medium normal-case tracking-[-0.04em] sm:text-4xl">
                  Three missions,
                  <br />
                  <em className="font-normal text-primary">one direction.</em>
                </h2>
                <p className="mt-6 text-sm leading-7 text-muted-foreground">
                  A group designed to grow in sequence: first make life move, then give it stories, then help good work be seen.
                </p>
                <nav className="mt-9 hidden border-l border-border/80 lg:block" aria-label="Vishnuva missions">
                  {missions.map((mission, index) => (
                    <a
                      key={mission.id}
                      href={`#${mission.id}`}
                      className="about-vishnuva-local-link"
                    >
                      <span>0{index + 1}</span>
                      {mission.discipline}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="relative">
                <div className="about-vishnuva-spine" aria-hidden="true" />
                <div className="grid gap-5">
                  {missions.map(({ id, phase, title, discipline, icon: Icon, copy, note, image, imageAlt, focus, signal }, index) => (
                    <article
                      id={id}
                      key={id}
                      className="about-vishnuva-mission-card group scroll-mt-28"
                    >
                      <div className="about-vishnuva-mission-card-top">
                        <span className="about-vishnuva-phase">{phase}</span>
                        <span className="about-vishnuva-card-note">{note}</span>
                      </div>
                      <div className="mt-9 grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)_7rem] md:gap-10">
                        <div className="about-vishnuva-mission-visual">
                          <img src={image} alt={imageAlt} loading="lazy" />
                          <div className="about-vishnuva-mission-visual-shade" aria-hidden="true" />
                          <span className="about-vishnuva-mission-visual-index">0{index + 1} / 03</span>
                          <span className="about-vishnuva-mission-visual-pin" aria-hidden="true" />
                          <span className="about-vishnuva-mission-visual-label">{discipline}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-3 text-primary">
                            <span className="about-vishnuva-icon"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                            <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em]">{discipline}</span>
                          </div>
                          <h3 className="mt-5 text-2xl font-medium normal-case tracking-[-0.035em] sm:text-4xl">{title}</h3>
                          <p className="mt-5 max-w-2xl text-[0.98rem] leading-8 text-muted-foreground">{copy}</p>
                          <dl className="about-vishnuva-mission-meta">
                            <div>
                              <dt>Focus</dt>
                              <dd>{focus}</dd>
                            </div>
                            <div>
                              <dt>Signal</dt>
                              <dd>{signal}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="hidden justify-self-end pt-1 md:block">
                          <div className="about-vishnuva-mission-number" aria-hidden="true">0{index + 1}</div>
                          <Boxes className="h-7 w-7 text-primary/70 transition-transform duration-300 group-hover:rotate-12" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="mt-10 flex items-center gap-3 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        <span className="h-px w-8 bg-primary/55" aria-hidden="true" />
                        Vishnuva Group
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="about-vishnuva-closing" aria-labelledby="closing-title">
          <div className="about-vishnuva-closing-grid" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:py-44">
            <div className="max-w-4xl">
              <p className="editorial-kicker">The through-line</p>
              <h2 id="closing-title" className="about-vishnuva-closing-title">
                Ek group, teen missions,
                <br />
                <span>ek vision — India ko connect karna, entertain karna, aur grow karna.</span>
              </h2>
            </div>
            <div className="mt-14 flex flex-col gap-4 border-t border-primary/35 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                Vishnuva Group is building the systems, stories, and signals that make tomorrow feel more connected.
              </p>
              <Link href="/" className="about-vishnuva-cta">
                <Clapperboard className="h-4 w-4" aria-hidden="true" />
                Enter FILMIO
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-8 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:px-8">
          <span>Vishnuva Group</span>
          <a href="#about-vishnuva-title" className="inline-flex items-center gap-2 transition-colors hover:text-primary">
            Back to top <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </main>
    </div>
  );
}