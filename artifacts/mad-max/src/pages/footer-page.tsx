import { Link, useRoute } from "wouter";
import { ArrowLeft, Clapperboard, Mail, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/navbar";

const contactFormHref = "/help#contact-form";

type PageConfig = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated?: string;
  sections: Array<{ title: string; body: string; bullets?: string[] }>;
};

const pages: Record<string, PageConfig> = {
  help: {
    eyebrow: "FILMIO Support",
    title: "How can we help?",
    intro: "Find your next watch, manage your account, or connect with the people behind the stories you love.",
    sections: [
      { title: "Explore FILMIO", body: "Use Discover, Genres, Anime, and Search to find films and shows. Open any title to see cast, trailers, ratings, and where to watch." },
      { title: "Your account", body: "Sign in to save watchlists, rate titles, write reviews, follow professionals, and send private messages. Your profile settings are available from the account menu." },
      { title: "Need more help?", body: "Our support team can help with account access, privacy requests, or a report about content.", bullets: ["Open the FILMIO contact form", "Include the page or title you are asking about", "Never send your password or verification codes"] },
    ],
  },
  advertising: {
    eyebrow: "FILMIO For Business",
    title: "Put your story in front of movie people",
    intro: "Reach a focused audience of film fans, anime viewers, creators, and entertainment professionals.",
    sections: [
      { title: "Ways to partner", body: "Build awareness with sponsored discovery placements, premiere campaigns, trailer promotion, and creator-focused partnerships." },
      { title: "Our approach", body: "Advertising should be clearly labelled, relevant, and respectful of the viewing experience. We do not sell private messages or private professional portfolio data." },
      { title: "Start a conversation", body: "Tell us about your campaign, target audience, market, and timing.", bullets: ["Use the FILMIO contact form and select Advertising", "We reply with available formats and audience information", "Campaigns are reviewed before they go live"] },
    ],
  },
  "data-license": {
    eyebrow: "FILMIO Data",
    title: "License our data",
    intro: "Explore commercial access to FILMIO discovery data for products, research, and entertainment experiences.",
    sections: [
      { title: "Available data", body: "Depending on the license, access may include title metadata, genres, credits, ratings aggregates, and availability information." },
      { title: "Responsible use", body: "Licensed data must be attributed where required, kept secure, and used in line with applicable rights and third-party source terms. Personal messages and private profile information are never part of the catalog feed." },
      { title: "Request a license", body: "Share your company, use case, expected volume, and countries of operation.", bullets: ["Use the FILMIO contact form and select Data licensing", "Do not scrape the site or bypass access controls", "A license is required before commercial redistribution"] },
    ],
  },
  press: {
    eyebrow: "FILMIO Press Room",
    title: "The stories behind FILMIO",
    intro: "Press resources, company news, and a direct line to our communications team.",
    sections: [
      { title: "About FILMIO", body: "FILMIO is a midnight-cinema discovery platform for movies, anime, reviews, watchlists, and professional connections." },
      { title: "Press enquiries", body: "For interviews, product information, founder requests, or approved brand assets, contact our communications team.", bullets: ["Use the FILMIO contact form and select Press", "Please include your publication and deadline", "We respond to editorial requests as quickly as possible"] },
    ],
  },
  jobs: {
    eyebrow: "Work at FILMIO",
    title: "Make the next great movie experience",
    intro: "We are building a place where audiences discover stories and the people who make them.",
    sections: [
      { title: "What we value", body: "Curiosity, craft, inclusive collaboration, thoughtful product decisions, and respect for the creative communities we serve." },
      { title: "Open roles", body: "There are no public openings listed right now, but we welcome a concise introduction from people whose work fits our mission." },
      { title: "Reach out", body: "Send a portfolio or LinkedIn profile and the kind of work you want to do.", bullets: ["Use the FILMIO contact form and select Careers", "Use the subject line “Future FILMIO teammate”", "We keep applications private and review them when roles open"] },
    ],
  },
  terms: {
    eyebrow: "FILMIO Legal",
    title: "Conditions of use",
    intro: "The rules for using FILMIO fairly, safely, and respectfully.",
    sections: [
      { title: "Use the service responsibly", body: "You may browse, rate, review, save, and connect through FILMIO for lawful personal and professional purposes. Do not impersonate others, harass people, manipulate ratings, or interfere with the service." },
      { title: "Your content", body: "You keep ownership of content you submit. You give FILMIO permission to host and display it only as needed to operate the service, and you are responsible for having the rights to share it." },
      { title: "Third-party information", body: "Movie metadata, imagery, trailers, and provider information may come from third parties and can change. Availability varies by country and platform." },
      { title: "Questions", body: "For legal questions or reports, use the FILMIO contact form." },
    ],
  },
  privacy: {
    eyebrow: "FILMIO Legal",
    title: "Privacy policy",
    intro: "We want you to enjoy discovering stories without giving up control of your personal information. This policy explains what FILMIO collects, why we use it, when it is shared, and how you can make privacy requests.",
    lastUpdated: "Last updated: 24 August 2026",
    sections: [
      { title: "What this covers", body: "This policy applies to the FILMIO website, mobile experiences, and related features for movie, TV, and anime discovery, ratings, reviews, watchlists, professional profiles, auditions, and private messaging. It does not apply to third-party websites or services linked from FILMIO." },
      { title: "Information you choose to provide", body: "When you create or use an account, you may provide your name, email address, profile photo, preferences, ratings, reviews, watchlists, follows, professional profile, portfolio links, audition files, and messages. You decide what to publish on your profile or in a review. Do not upload information that you do not have the right to share." },
      { title: "Information created through your use", body: "We receive information about the titles you search, view, rate, review, save, or discuss, along with settings, device information, browser information, approximate location inferred from network data, log data, and security signals. If you browse while signed out, some recent browsing history may stay only in your browser or device." },
      { title: "How we use information", body: "We use information to provide and personalise discovery, show ratings and reviews, maintain watchlists and profiles, deliver notifications you request, operate private messaging, secure accounts, prevent abuse, troubleshoot the service, understand product performance, and improve FILMIO. We do not use the contents of private messages or private audition files to personalise public movie recommendations." },
      { title: "What is public and what stays private", body: "Public reviews, ratings, follows, and professional profile information may be visible to other users according to your settings. Private messages and audition files are intended only for authenticated participants or the people you choose. We do not sell private messages, passwords, private audition files, or private profile information." },
      { title: "When information is shared", body: "We may share information with service providers who help us host, secure, authenticate, store, analyse, or support FILMIO, under appropriate instructions and safeguards. We may also disclose information when required by law, to protect users and the service, or as part of a business reorganisation. Movie metadata, images, trailers, and availability information may come from independent third-party sources and are governed by their own policies." },
      { title: "Retention and security", body: "We keep information for as long as needed to provide the service, meet legal and accounting obligations, resolve disputes, enforce agreements, and protect FILMIO. We use access controls, encryption where appropriate, and security monitoring, but no online service can promise absolute security. Please use a strong, unique password and report suspicious activity promptly." },
      { title: "Your choices and privacy rights", body: "Depending on where you live, you may be able to access, correct, update, delete, or receive a copy of your personal information, withdraw consent where processing is based on consent, or object to certain uses. You can also sign out, edit your profile, remove saved titles, and manage advertising preferences from FILMIO.", bullets: ["Use the FILMIO contact form and select Privacy request", "Tell us which account, information, or action your request concerns", "We may verify your identity before completing a request", "We aim to respond within the time required by applicable law"] },
      { title: "Children and age limits", body: "FILMIO is not intended for children who are not permitted to use the service under the laws that apply to them. We do not knowingly collect personal information from children without the required permission. If you believe a child has provided information, contact us so we can review and remove it where appropriate." },
      { title: "Cookies and similar technologies", body: "We use essential storage and similar technologies to keep FILMIO secure, remember settings, maintain sessions, and understand service performance. Where required, we ask for your choices before using non-essential technologies. You can manage browser settings and visit Ads Privacy Choices to review advertising preferences." },
      { title: "International processing and changes", body: "FILMIO and its service providers may process information in countries other than where you live. Where required, we use appropriate safeguards for those transfers. We may update this policy as FILMIO changes; we will post the revised version and update the date above. Material changes may also be communicated through the service." },
       { title: "Contact us", body: "For privacy questions, requests, or concerns, use the FILMIO contact form. For general support, use the same form and select Support. If you are unhappy with our response, you may have the right to contact the data protection authority or regulator in your country." },
    ],
  },
  "privacy-choices": {
    eyebrow: "Your choices",
    title: "Ads privacy choices",
    intro: "Choose how FILMIO uses advertising-related information on this device.",
    sections: [
      { title: "Your current preference", body: "FILMIO does not use private messages, private auditions, or your password for advertising. You can opt out of personalised advertising below." },
      { title: "Manage preferences", body: "Your preference is saved on this device and can be changed at any time.", bullets: ["Personalised advertising: Off", "Contextual advertising: On", "Essential security and service measurement: On"] },
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