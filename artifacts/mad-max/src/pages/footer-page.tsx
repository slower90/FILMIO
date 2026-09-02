import { Link, useRoute } from "wouter";
import { ArrowLeft, Clapperboard, Mail, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/navbar";

const contactFormHref = "/help#contact-form";

type PageConfig = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated?: string;
  sections: Array<{
    title: string;
    body: string;
    bullets?: string[];
    links?: Array<{ label: string; href: string }>;
  }>;
};

const pages: Record<string, PageConfig> = {
  help: {
    eyebrow: "FILMIO Support",
    title: "How can we help?",
    intro: "FILMIO Help Center — movies/TV/anime search karna, rating dena, reviews likhna, watchlist banana, ya professional/audition profile setup karne mein madad.",
    sections: [
      { title: "Find and follow stories", body: "Search movies, TV, and anime, then open a title for cast, trailers, ratings, reviews, and official viewing options." },
      { title: "Make FILMIO yours", body: "Sign in to rate titles, write reviews, build a watchlist, and set up a professional or audition profile." },
      { title: "Still have a question?", body: "Sawal ho to support@vishnuva.in par likho. Never send your password or verification codes.", bullets: ["Open the FILMIO contact form", "Include the page or title you are asking about"] },
    ],
  },
  "site-index": {
    eyebrow: "FILMIO Directory",
    title: "Site index",
    intro: "FILMIO ke saare major sections ek jagah se explore karo.",
    sections: [
      {
        title: "Movies, TV & Anime",
          body: "Discovery, search, genres, classic cinema, and the FILMIO Journal.",
        links: [
          { label: "Discover", href: "/discover" },
          { label: "Search", href: "/search" },
          { label: "Browse", href: "/browse" },
          { label: "Genres", href: "/genres" },
          { label: "Anime", href: "/anime" },
          { label: "Free Classics", href: "/free-classics" },
          { label: "Film News", href: "/news" },
        ],
      },
      {
        title: "People & community",
        body: "Meet the performers, filmmakers, and film fans who make FILMIO more useful.",
        links: [
          { label: "Top Actors", href: "/actors" },
          { label: "Actor & Crew Directory", href: "/actor-directory" },
          { label: "Industry Network", href: "/professionals" },
          { label: "Industry Community", href: "/professionals/community" },
          { label: "Profiles", href: "/profiles" },
          { label: "Friends", href: "/friends" },
        ],
      },
      {
        title: "Your FILMIO",
        body: "Save, reflect, and keep track of the stories and signals that matter to you.",
        links: [
          { label: "Watchlist", href: "/watchlist" },
          { label: "Personal Signals", href: "/signals" },
          { label: "Cinema Graph", href: "/profiles/graph" },
          { label: "Events", href: "/events" },
          { label: "Plans", href: "/plans" },
        ],
      },
    ],
  },
  "actor-directory": {
    eyebrow: "FILMIO Industry Network",
    title: "Actor & crew directory",
    intro: "FILMIO ke Industry Network mein registered actors, directors, aur crew members ki poori list — profile dekho, connect karo, ya audition opportunities explore karo.",
    sections: [
      { title: "Explore the network", body: "Industry Network mein verified cinematic profiles, filmographies, career timelines, influences, awards, interviews, auditions, and audience questions explore karo.", links: [{ label: "Open Industry Network", href: "/professionals" }, { label: "Meet the industry community", href: "/professionals/community" }] },
    ],
  },
  plans: {
    eyebrow: "FILMIO Plans",
    title: "Free for everyone",
    intro: "FILMIO free hai sabke liye — discovery, rating, review, watchlist sab free.",
    sections: [
      { title: "Everything that matters", body: "Discover movies, TV shows, and anime; rate and review what you watch; and keep your next watches in a personal watchlist. FILMIO ke core features ke liye payment required nahi hai." },
    ],
  },
  advertising: {
    eyebrow: "FILMIO For Business",
    title: "Advertise on FILMIO",
    intro: "FILMIO par advertise karna chahte ho? Movie promotions, brand partnerships, ya banner ads ke liye contact karo: ads@vishnuva.in",
    sections: [
      { title: "Advertising enquiries", body: "Movie promotions, brand partnerships, ya banner ads ke liye ads@vishnuva.in par apni campaign details, audience, market, aur timing ke saath likho." },
    ],
  },
  "data-license": {
    eyebrow: "FILMIO Data",
    title: "License our data",
    intro: "FILMIO ka rating/review data apne product mein use karna chahte ho? Licensing enquiries ke liye contact karo: data@vishnuva.in",
    sections: [
      { title: "Licensing enquiries", body: "Data licensing ke liye data@vishnuva.in par apna product, use case, expected volume, aur distribution plans share karo. Private messages aur private profile information licensed data ka hissa nahi hain." },
    ],
  },
  press: {
    eyebrow: "FILMIO Press Room",
    title: "Press room",
    intro: "Media aur press enquiries ke liye — FILMIO ke baare mein likhna chahte ho? Contact: press@vishnuva.in",
    sections: [
      { title: "Media enquiries", body: "Interviews, product information, founder requests, aur approved brand assets ke liye press@vishnuva.in par apni publication aur deadline ke saath likho." },
    ],
  },
  jobs: {
    eyebrow: "Work at FILMIO",
    title: "Jobs at FILMIO",
    intro: "FILMIO team join karna chahte ho? Abhi hum chhoti team hain, lekin future openings yahan post honge. Interested ho to careers@vishnuva.in par likho.",
    sections: [
      { title: "Future openings", body: "Abhi hum chhoti team hain aur current openings nahi hain. Future roles ke liye yahan updates milenge; apna portfolio, LinkedIn profile, aur kis tarah ka kaam karna chahte ho, careers@vishnuva.in par bhej sakte ho." },
    ],
  },
  terms: {
    eyebrow: "FILMIO Legal",
    title: "Conditions of use",
    intro: "FILMIO ko fairly, safely, aur respectfully use karne ke rules.",
    sections: [
      { title: "Account rules", body: "Account banate waqt accurate information do, apne account ko secure rakho, aur kisi aur ki identity impersonate mat karo. FILMIO ko lawful personal aur professional purposes ke liye use karo; service ko scrape, disrupt, abuse, ya unauthorized access mat karo." },
      { title: "Content guidelines", body: "Fake reviews, rating manipulation, harassment, hate, threats, doxxing, spam, illegal content, aur kisi ki privacy violate karne wala content allowed nahi hai. FILMIO harmful ya rule-breaking content ko remove, restrict, ya report kar sakta hai." },
      { title: "Rating and review policy", body: "Ratings aur reviews genuine viewing experience par based hone chahiye. Paid, coordinated, fake, repetitive, misleading, ya kisi film ko unfairly promote/damage karne wale reviews allowed nahi hain. Apne review ke rights aur accuracy ki responsibility aapki hai." },
      { title: "Intellectual property", body: "FILMIO ka name, branding, software, design, aur original materials FILMIO ya uske licensors ke hain. Aap apne submitted content ke owner rehte ho, lekin FILMIO ko service operate karne ke liye use, host, display, aur distribute karne ki limited permission dete ho." },
      { title: "Third-party information", body: "Movie metadata, images, trailers, ratings sources, aur provider information third parties se aa sakti hai. Inki accuracy, availability, rights, aur country/platform restrictions change ho sakti hain." },
      { title: "Liability disclaimer", body: "FILMIO service ko available aur useful rakhne ki koshish karta hai, lekin service, catalog, recommendations, third-party links, availability, ya user content ke uninterrupted, error-free, complete, ya suitable hone ki guarantee nahi deta. Law ke maximum extent tak FILMIO indirect loss ke liye liable nahi hoga." },
      { title: "Changes and contact", body: "FILMIO in conditions ko service ke saath update kar sakta hai; important changes ko page par post kiya jayega. Questions, reports, ya legal notices ke liye FILMIO Help Center use karo." },
    ],
  },
  privacy: {
    eyebrow: "FILMIO Legal",
    title: "Privacy policy",
    intro: "FILMIO aapki privacy ko seriously leta hai. Ye policy batati hai ki hum kya data collect karte hain, kaise use karte hain, aur aap apne data par control kaise rakh sakte ho.",
    lastUpdated: "Last updated: 31 August 2026",
    sections: [
      { title: "Data we collect", body: "Account banate ya use karte waqt hum email address, name, profile details, ratings, reviews, watchlists, follows, professional profile information, auditions, aur messages collect kar sakte hain. Search, viewing, settings, device/browser, log, aur security information bhi service ko operate karne ke liye process ho sakti hai." },
      { title: "How we use your data", body: "Email aur account data sign-in, account support, security, aur requested notifications ke liye use hota hai. Ratings, reviews, aur watchlist data discovery ko personalise karne, recommendations improve karne, community features chalane, aur FILMIO ko better banane mein help karta hai. Private messages aur private audition files public recommendations ke liye use nahi kiye jaate." },
      { title: "Third-party services and data", body: "FILMIO authentication ke liye Clerk use karta hai. Movie, TV, anime metadata, credits, images, trailers, aur availability information TMDB aur other third-party sources se aa sakti hai; un services ki apni terms aur privacy policies apply hoti hain. Hum service providers ke saath sirf FILMIO operate, secure, host, authenticate, aur support karne ke liye data share karte hain." },
      { title: "Public and private information", body: "Aapke public ratings, reviews, follows, aur professional profile information doosre users ko dikh sakte hain. Private messages aur audition files sirf intended authenticated participants ya selected recipients ke liye hote hain. Hum passwords, private messages, private audition files, ya private profile data sell nahi karte." },
      { title: "Cookies and device storage", body: "Hum essential cookies, local storage, aur similar technologies sessions maintain karne, settings yaad rakhne, security provide karne, aur service performance samajhne ke liye use karte hain. Browser settings se aap cookies aur local storage manage ya delete kar sakte ho; kuch features isse affect ho sakte hain." },
      { title: "Your rights and data deletion", body: "Applicable law ke hisaab se aap apna data access, correct, update, export, ya delete karne ki request kar sakte ho; kuch processing par objection ya consent withdrawal bhi possible ho sakta hai. Data delete request ke liye FILMIO Help Center ke contact form se Privacy request select karo, ya support@vishnuva.in par account email aur requested action ke saath likho. Hum request complete karne se pehle identity verify kar sakte hain." },
      { title: "Security, retention, and changes", body: "Hum access controls, encryption where appropriate, aur security monitoring use karte hain, lekin koi online service absolute security guarantee nahi kar sakti. Data ko service, legal obligations, disputes, abuse prevention, aur security ke liye zaroori duration tak retain kiya ja sakta hai. Policy change hone par updated date ke saath yahan publish ki jayegi." },
      { title: "Contact us", body: "Privacy ya general support ke liye support@vishnuva.in par likho ya FILMIO Help Center ka contact form use karo. Applicable law ke tahat aap apne local data protection authority se bhi contact kar sakte ho." },
    ],
  },
  "privacy-choices": {
    eyebrow: "Your choices",
    title: "Ads privacy choices",
    intro: "Choose how FILMIO uses advertising-related information on this device.",
    sections: [
      { title: "Your current preference", body: "FILMIO currently does not use third-party ad networks or advertising trackers. This page is retained for future product planning and does not change how FILMIO uses your data today." },
      { title: "Manage preferences", body: "There are no third-party advertising preferences to manage at this time." },
    ],
  },
};

export default function FooterPage() {
  const [, params] = useRoute("/:slug");
  const config = pages[params?.slug ?? "help"] ?? pages.help;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-32">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
           <ArrowLeft className="h-4 w-4" /> Back to FILMIO
        </Link>
        <div className="max-w-3xl">
          <div className="mb-5 flex items-center gap-3 text-primary">
            <Clapperboard className="h-7 w-7" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">{config.eyebrow}</span>
          </div>
          <h1 className="font-display text-5xl font-bold uppercase tracking-tight text-glow md:text-7xl">{config.title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{config.intro}</p>
           {config.lastUpdated && <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">{config.lastUpdated}</p>}
        </div>
        <div className="mt-16 grid gap-5 md:grid-cols-2">
          {config.sections.map((section) => (
            <section key={section.title} className="rounded-md border border-border bg-card/40 p-6">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>
              {section.links && (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {section.links.map((link) => (
                    <Link key={link.href} href={link.href} className="rounded-sm border border-border/70 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary">
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
              {section.bullets && <ul className="mt-4 space-y-2 text-sm text-muted-foreground">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="text-primary">•</span>{bullet === "Open the FILMIO contact form" || bullet.startsWith("Use the FILMIO contact form") ? <Link href={contactFormHref} className="underline underline-offset-4 hover:text-primary">{bullet}</Link> : bullet}</li>)}</ul>}
            </section>
          ))}
        </div>
        <div id="contact-form" className="mt-10 flex flex-wrap gap-3">
          <Link href={contactFormHref} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"><Mail className="h-4 w-4" /> Contact FILMIO</Link>
          <Link href="/privacy" className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-xs font-bold uppercase tracking-wider hover:border-primary hover:text-primary"><ShieldCheck className="h-4 w-4" /> Privacy</Link>
        </div>
      </main>
    </div>
  );
}