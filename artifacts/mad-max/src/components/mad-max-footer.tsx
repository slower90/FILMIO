import {
  Facebook,
  Instagram,
  Music2,
  QrCode,
  Twitter,
  Youtube,
} from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";

const footerLinks = [
  { href: "/help", label: "Help" },
  { href: "/genres", label: "Site Index" },
  { href: "/professionals", label: "Actor Directory" },
  { href: "/pricing", label: "Plans" },
  { href: "/advertising", label: "Advertising" },
  { href: "/data-license", label: "License Our Data" },
  { href: "/press", label: "Press Room" },
  { href: "/jobs", label: "Jobs" },
  { href: "/terms", label: "Conditions of Use" },
  { href: "/privacy", label: "Privacy Policy" },
];

const socialLinks = [
  { href: "https://www.tiktok.com", label: "TikTok", Icon: Music2 },
  { href: "https://www.instagram.com", label: "Instagram", Icon: Instagram },
  { href: "https://www.x.com", label: "X", Icon: Twitter },
  { href: "https://www.youtube.com", label: "YouTube", Icon: Youtube },
  { href: "https://www.facebook.com", label: "Facebook", Icon: Facebook },
];

export default function PrismFooter() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <footer className="w-full bg-black px-6 pb-8 pt-14 text-white">
      <div className="mx-auto max-w-4xl">
        {isLoaded && (
          <div className="mb-10 flex justify-center">
            {isSignedIn ? (
              <Link
                href="/profile"
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold tracking-wide text-primary-foreground transition-colors hover:bg-primary/85"
              >
                Open your profile
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold tracking-wide text-primary-foreground transition-colors hover:bg-primary/85"
              >
                Sign in for more access
              </Link>
            )}
          </div>
        )}

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-700 p-6">
          <p className="text-sm font-bold tracking-wide">Follow FILMIO on social</p>
            <div className="flex gap-5 text-neutral-200">
              {socialLinks.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                   className="transition-colors hover:text-primary"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-700 p-6">
            <div>
              <p className="text-sm font-bold">Get the FILMIO app</p>
              <p className="text-sm text-neutral-400">For Android and iOS</p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-white">
              <QrCode className="h-11 w-11 text-black" />
            </div>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="mb-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-300">
          {footerLinks.slice(0, 5).map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-white hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Footer legal navigation" className="mb-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-300">
          {footerLinks.slice(5).map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-white hover:underline">
              {label}
            </Link>
          ))}
          <Link href="/privacy-choices" className="flex items-center gap-1 hover:text-white">
            <span className="rounded bg-blue-600 px-1 py-0.5 text-[10px] font-bold">✓✕</span>
            Your Ads Privacy Choices
          </Link>
        </nav>

        <div className="flex flex-col items-center gap-1 text-xs text-neutral-500">
          <p className="text-sm text-neutral-300">
            part of the <span className="font-bold text-white">Vishnuva</span> group
          </p>
          <p>© 1990-2026 by FILMIO, Inc.</p>
        </div>
      </div>
    </footer>
  );
}