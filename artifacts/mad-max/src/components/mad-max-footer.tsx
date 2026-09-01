import {
  ExternalLink,
  Mail,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useActiveProfile } from "@/lib/profile-context";

const appLandingUrl = "https://vishnuva.in/";
const appStoreLinks = [
  {
    href: "https://play.google.com/store/apps/details?id=com.squad.filmio",
    label: "Android",
  },
  {
    href: "https://apps.apple.com/in/app/filmio-movie-tv-anime-tracker/id6736888724",
    label: "iOS",
  },
];

const footerLinks = [
  { href: "/about-vishnuva", label: "About Vishnuva" },
  { href: "/help", label: "Help" },
  { href: "/site-index", label: "Site Index" },
  { href: "/actor-directory", label: "Actor Directory" },
  { href: "/plans", label: "Plans" },
  { href: "/advertising", label: "Advertising" },
  { href: "/data-license", label: "License Our Data" },
  { href: "/press", label: "Press Room" },
  { href: "/jobs", label: "Jobs" },
  { href: "/terms", label: "Conditions of Use" },
  { href: "/privacy", label: "Privacy Policy" },
];

export default function PrismFooter() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { activeProfile } = useActiveProfile();
  const [, setLocation] = useLocation();

  const openProfileRooms = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setLocation(user ? `/profile/${user.id}` : "/profiles");
  };

  return (
    <footer className="w-full border-t border-border/70 bg-[hsl(var(--surface-deep))] px-6 pb-8 pt-14 text-foreground">
      <div className="mx-auto max-w-4xl">
        {isLoaded && (
          <div className="mb-10 flex justify-center">
            {isSignedIn ? (
              <Link
                href={user ? `/profile/${user.id}` : "/profiles"}
                onClick={openProfileRooms}
                aria-label="Open your profile and viewing rooms"
                data-testid="link-footer-profile"
                className="group inline-flex items-center gap-3 rounded-full bg-primary px-5 py-2.5 text-sm font-bold tracking-wide text-primary-foreground transition-colors hover:bg-primary/85"
              >
                <ProfileAvatar
                  src={activeProfile?.avatarUrl || user?.imageUrl}
                  name={activeProfile?.name || user?.fullName || "You"}
                  size="sm"
                  className="h-8 w-8 rounded-full border-primary-foreground/40"
                />
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[9px] uppercase tracking-[0.18em] opacity-80">You</span>
                  <span>Open your profile</span>
                </span>
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
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/40 p-6 text-center">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-sm font-bold tracking-wide">Need to reach FILMIO?</p>
            <Link href="/help#contact-form" className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary">
              Open the contact form
            </Link>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/40 p-6">
            <div>
              <p className="text-sm font-bold">Get the FILMIO app</p>
              <p className="text-sm text-muted-foreground">For Android and iOS</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wider">
                {appStoreLinks.map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
                  >
                    {label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
            <a
              href={appLandingUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open FILMIO"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm bg-foreground p-1 transition-opacity hover:opacity-80"
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(appLandingUrl)}`}
                alt="QR code linking to FILMIO"
                className="h-full w-full"
              />
            </a>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="mb-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {footerLinks.slice(0, 5).map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-foreground hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Footer legal navigation" className="mb-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {footerLinks.slice(5).map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-foreground hover:underline">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <p className="text-sm text-muted-foreground">
            part of the <span className="font-bold text-foreground">Vishnuva</span> group
          </p>
          <p>© 2026 FILMIO, Inc.</p>
        </div>
      </div>
    </footer>
  );
}