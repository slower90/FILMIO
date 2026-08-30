import { lazy, Suspense, useEffect, useRef } from "react";
import gsap from "gsap";
import { HelmetProvider } from "react-helmet-async";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link } from "wouter";
import { Clapperboard } from "lucide-react";
import PrismFooter from "@/components/mad-max-footer";
import { SiteSeo } from "@/lib/seo";

// Keep the Home route eager so the primary landing page becomes interactive
// without waiting for a route chunk. Secondary surfaces load only when visited.
import Home from '@/pages/home';
import { ProfileProvider } from "@/lib/profile-context";
const Discover = lazy(() => import('@/pages/discover'));
const Search = lazy(() => import('@/pages/search'));
const MovieDetail = lazy(() => import('@/pages/movie-detail'));
const Watchlist = lazy(() => import('@/pages/watchlist'));
const Actors = lazy(() => import('@/pages/actors'));
const ActorDetail = lazy(() => import('@/pages/actor-detail'));
const Feed = lazy(() => import('@/pages/feed'));
const Profile = lazy(() => import('@/pages/profile'));
const Professionals = lazy(() => import('@/pages/professionals'));
const ProfessionalDetail = lazy(() => import('@/pages/professional-detail'));
const IndustryCommunity = lazy(() => import('@/pages/industry-community'));
const Chat = lazy(() => import('@/pages/chat'));
const Genres = lazy(() => import('@/pages/genres'));
const GenrePage = lazy(() => import('@/pages/genre'));
const Anime = lazy(() => import('@/pages/anime'));
const News = lazy(() => import('@/pages/news'));
const Signals = lazy(() => import('@/pages/signals'));
const Events = lazy(() => import('@/pages/events'));
const FooterPage = lazy(() => import('@/pages/footer-page'));
const Pricing = lazy(() => import('@/pages/pricing'));
const FreeMovies = lazy(() => import('@/pages/free-movies'));
const FreeClassics = lazy(() => import('@/pages/free-classics'));
const Browse = lazy(() => import('@/pages/browse'));
const MovieStory = lazy(() => import('@/pages/movie-story'));
const Friends = lazy(() => import('@/pages/friends'));
const Profiles = lazy(() => import('@/pages/profiles'));
const CinemaGraph = lazy(() => import('@/pages/cinema-graph'));

// Setup QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      // Keep discovery responses in memory while the user browses between pages.
      // Mutations and auth changes still invalidate/clear this cache immediately.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnMount: false,
    },
  },
});

// Clerk Auth Setup
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function resolveClerkPublishableKey() {
  try {
    return publishableKeyFromHost(
      window.location.hostname,
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    );
  } catch {
    return "";
  }
}

const clerkPubKey = resolveClerkPublishableKey();

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkConfigurationError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-xl rounded-md border border-border bg-card p-8 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">FILMIO configuration error</p>
        <h1 className="mt-3 text-2xl font-semibold">Authentication is not configured.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The production Clerk publishable key is missing or invalid for this domain.
        </p>
      </section>
    </main>
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/auth-logo.svg`,
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "hsl(38 92% 50%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(240 5% 60%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(240 10% 6%)",
    colorInput: "hsl(240 10% 12%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorNeutral: "hsl(240 10% 12%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0A0A0F] rounded-md border border-[#1A1A24] w-[480px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-display uppercase tracking-widest text-xl text-white",
    headerSubtitle: "text-[#9999A1]",
    socialButtonsBlockButton: "!bg-white !border-white/20 !text-[#111118] hover:!bg-[#f3f3f3] !min-h-11",
    socialButtonsBlockButtonText: "!text-[#111118] font-semibold",
    formFieldLabel: "text-white font-medium uppercase tracking-wider text-xs",
    footerActionLink: "text-[#F59E0B] hover:text-[#F59E0B]/80",
    footerActionText: "text-[#9999A1]",
    dividerText: "text-[#9999A1] uppercase tracking-widest text-[10px]",
    formButtonPrimary:
      "!relative !min-h-12 !overflow-hidden !bg-[#F59E0B] !text-[#111118] !font-semibold !tracking-wide hover:!bg-[#fbbf24] !transition-all !duration-300",
    formFieldInput:
      "!min-h-12 !border-[#2a2a36] !bg-[#12121a] !text-white !shadow-[0_5px_0_#08080c,0_12px_24px_rgba(0,0,0,0.24)]",
    otpCodeFieldInput:
      "!h-14 !w-12 !rounded-[0.3rem] !border-[#353541] !bg-[#12121a] !text-xl !font-semibold !text-white !shadow-[0_7px_0_#08080c,0_14px_24px_rgba(0,0,0,0.3)] !transition-all !duration-200",
  },
};

function useAuthSubmitMotion() {
  const authMotionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = authMotionRef.current;
    if (!root) return;

    const clearSubmittingState = () => {
      root
        .querySelectorAll<HTMLElement>(".cl-formButtonPrimary[data-filmio-submitting]")
        .forEach((button) => {
          if (
            !button.hasAttribute("disabled") &&
            button.getAttribute("aria-busy") !== "true"
          ) {
            button.removeAttribute("data-filmio-submitting");
          }
        });
    };

    const observer = new MutationObserver(clearSubmittingState);
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-busy", "data-loading"],
    });

    return () => observer.disconnect();
  }, []);

  const handleAuthClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(".cl-formButtonPrimary");
    if (button && !button.disabled) {
      button.setAttribute("data-filmio-submitting", "true");
    }
  };

  return { authMotionRef, handleAuthClick };
}

function SignInPage() {
  const { authMotionRef, handleAuthClick } = useAuthSubmitMotion();
  const redirectPath = new URLSearchParams(window.location.search).get("redirect");
  const redirectUrl = redirectPath
    ? `${basePath}${redirectPath}`.replace(/\/{2,}/g, "/")
    : basePath || "/";

  return (
    <div
      ref={authMotionRef}
      onClickCapture={handleAuthClick}
      className="filmio-auth-page flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vh] bg-primary/5 rounded-full blur-[100px]" />
      </div>
      <Link
        href="/"
        className="absolute left-5 top-5 z-10 flex items-center gap-2 text-primary transition-opacity hover:opacity-80 sm:left-8 sm:top-7"
      >
        <Clapperboard className="h-6 w-6" />
        <span className="brand-wordmark text-glow">FILMIO</span>
      </Link>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </div>
  );
}

function SignUpPage() {
  const { authMotionRef, handleAuthClick } = useAuthSubmitMotion();
  const redirectPath = new URLSearchParams(window.location.search).get("redirect");
  const redirectUrl = redirectPath
    ? `${basePath}${redirectPath}`.replace(/\/{2,}/g, "/")
    : basePath || "/";

  return (
    <div
      ref={authMotionRef}
      onClickCapture={handleAuthClick}
      className="filmio-auth-page flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vh] bg-primary/5 rounded-full blur-[100px]" />
      </div>
      <Link
        href="/"
        className="absolute left-5 top-5 z-10 flex items-center gap-2 text-primary transition-opacity hover:opacity-80 sm:left-8 sm:top-7"
      >
        <Clapperboard className="h-6 w-6" />
        <span className="brand-wordmark text-glow">FILMIO</span>
      </Link>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

// A tiny client-only interaction sound. It is created after a real pointer
// gesture, so browsers do not block it as unsolicited autoplay.
function ClickSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("a, button, [role='button'], img, [data-click-sound]")) return;

      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;

      const audioContext =
        audioContextRef.current ?? (audioContextRef.current = new AudioContextConstructor());
      if (audioContext.state === "suspended") void audioContext.resume();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.045);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.06);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  return null;
}

// Fades the page in on every route change
function PageFade({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" });
  }, [location]);
  return <div ref={ref}>{children}</div>;
}

function SiteFooter() {
  const [location] = useLocation();
  const isAuthPage = location.startsWith("/sign-in") || location.startsWith("/sign-up");
  const isSocialWorkspace =
    location === "/feed" ||
    location.startsWith("/feed?") ||
    location === "/friends" ||
    location.startsWith("/friends?") ||
    location === "/chat" ||
    location.startsWith("/chat?");

  if (isAuthPage || isSocialWorkspace) return null;
  return <PrismFooter />;
}

function RouteLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading page" />
    </div>
  );
}

function AuthRequiredPage({ redirectPath = "/professionals" }: { redirectPath?: string }) {
  const redirect = encodeURIComponent(redirectPath);
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-md border border-border bg-card p-8 text-center shadow-2xl">
        <Clapperboard className="mx-auto mb-5 h-10 w-10 text-primary" />
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary">FILMIO Profiles</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider">Sign in to explore profiles</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Industry profiles, networking, and direct connections are available after you log in or create your FILMIO account.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/sign-in?redirect=${redirect}`}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-primary/90"
          >
            Sign In
          </Link>
          <Link
            href={`/sign-up?redirect=${redirect}`}
            className="inline-flex h-11 items-center justify-center rounded-md border border-border px-6 text-xs font-bold uppercase tracking-wider transition hover:border-primary hover:text-primary"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProtectedProfessionals() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="min-h-screen bg-background" />;
  return isSignedIn ? <Professionals /> : <AuthRequiredPage />;
}

function ProtectedProfessionalDetail() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="min-h-screen bg-background" />;
  return isSignedIn ? <ProfessionalDetail /> : <AuthRequiredPage />;
}

function ProtectedProfessionalDashboard() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="min-h-screen bg-background" />;
  return isSignedIn ? <Professionals /> : <AuthRequiredPage />;
}

function ProtectedProfiles() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="min-h-screen bg-background" />;
  return isSignedIn ? <Profiles /> : <AuthRequiredPage redirectPath="/profiles" />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return <ClerkConfigurationError />;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Sign in to FILMIO",
            subtitle: "Welcome back. Continue your movie journey.",
          },
        },
        signUp: {
          start: {
            title: "Join FILMIO",
            subtitle: "Create your account and start discovering.",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ProfileProvider>
          <ClickSound />
          <ClerkQueryClientCacheInvalidator />
          <SiteSeo />
          <PageFade>
          <Suspense fallback={<RouteLoading />}>
            <Switch>
          <Route path="/" component={Home} />

          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/discover" component={Discover} />
          <Route path="/search" component={Search} />
          <Route path="/blog/movies/:id/:slug?" component={MovieStory} />
          <Route path="/movies/:id/:slug" component={MovieDetail} />
          <Route path="/movies/:id" component={MovieDetail} />
          <Route path="/watchlist" component={Watchlist} />
          <Route path="/profiles" component={ProtectedProfiles} />
          <Route path="/profiles/graph" component={CinemaGraph} />
          <Route path="/actors" component={Actors} />
          <Route path="/actors/:id" component={ActorDetail} />
          <Route path="/feed" component={Feed} />
          <Route path="/friends" component={Friends} />
          <Route path="/profile/:id" component={Profile} />
          <Route path="/professionals" component={ProtectedProfessionals} />
          <Route path="/professionals/dashboard" component={ProtectedProfessionalDashboard} />
          <Route path="/professionals/community" component={IndustryCommunity} />
          <Route path="/professionals/:id" component={ProtectedProfessionalDetail} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/free-movies" component={FreeMovies} />
          <Route path="/free-classics" component={FreeClassics} />
          <Route path="/browse" component={Browse} />
          <Route path="/chat" component={Chat} />
          <Route path="/genres" component={Genres} />
          <Route path="/genre/:id" component={GenrePage} />
          <Route path="/anime" component={Anime} />
          <Route path="/news" component={News} />
          <Route path="/signals" component={Signals} />
          <Route path="/events" component={Events} />
          <Route path="/help" component={FooterPage} />
          <Route path="/advertising" component={FooterPage} />
          <Route path="/data-license" component={FooterPage} />
          <Route path="/press" component={FooterPage} />
          <Route path="/jobs" component={FooterPage} />
          <Route path="/terms" component={FooterPage} />
          <Route path="/privacy" component={FooterPage} />
          <Route path="/privacy-choices" component={FooterPage} />

          <Route>
            <div className="min-h-screen bg-background flex flex-col items-center justify-center">
              <h1 className="text-4xl font-display uppercase tracking-widest mb-4">404 - Not Found</h1>
              <p className="text-muted-foreground">The page you are looking for doesn't exist.</p>
            </div>
          </Route>
            </Switch>
          </Suspense>
          </PageFade>
           <SiteFooter />
        </ProfileProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  useEffect(() => {
    document.getElementById("seo-prerender")?.remove();
  }, []);

  return (
    <HelmetProvider>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
        <SonnerToaster />
      </TooltipProvider>
    </HelmetProvider>
  );
}

export default App;
