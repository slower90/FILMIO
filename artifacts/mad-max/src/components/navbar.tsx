import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { useUser, useClerk } from "@clerk/react";
import { getGetWatchlistQueryKey, useGetWatchlist } from "@workspace/api-client-react";
import {
  Search,
  MessageSquare,
  Clapperboard,
  Bookmark,
  LogOut,
  Menu,
  X,
  Film,
  Tv,
  Users,
  UserPlus,
  Newspaper,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { recordMoodSignal } from "@/lib/mood-agent";
import { withMovieTitle } from "@/lib/movie-links";

// ── Search result type ────────────────────────────────────────────────────────
interface SearchResult {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title: string;
  posterPath: string | null;
  releaseDate: string;
}

// ── Persistent search bar component ──────────────────────────────────────────
function NavSearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/movies/search-multi?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults((data.results ?? []).slice(0, 8));
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (r: SearchResult) => {
    setOpen(false);
    setFocused(false);
    setQuery("");
    setResults([]);
    if (r.mediaType === "movie") setLocation(withMovieTitle(`/movies/${r.id}`, r.title));
    else if (r.mediaType === "tv") setLocation(withMovieTitle(`/movies/${r.id}?type=tv`, r.title));
    else setLocation(`/search?q=${encodeURIComponent(r.title)}`);
  };

  const mediaIcon = (type: string) => {
    if (type === "tv") return <Tv className="w-3 h-3 text-primary flex-none" />;
    if (type === "person") return <Users className="w-3 h-3 text-accent-foreground flex-none" />;
    return <Film className="w-3 h-3 text-primary flex-none" />;
  };

  return (
    <div ref={containerRef} className={cn("relative", !compact && "w-full max-w-xs lg:max-w-sm")}>
      {compact && !focused && (
        <button
          type="button"
          onClick={() => setFocused(true)}
          className="flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
          aria-label="Open search"
        >
          <Search className="h-5 w-5" />
        </button>
      )}
      {compact && focused && (
        <div
          className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => {
            setOpen(false);
            setFocused(false);
          }}
        />
      )}
      <div className="relative">
        {compact && focused && (
          <div className="fixed left-4 right-4 top-[4.75rem] z-[60] text-left sm:hidden">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Search FILMIO
            </p>
          </div>
        )}
        <Search
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none",
            compact && !focused && "hidden",
            compact && focused && "fixed left-7 top-[7.25rem] z-[61]",
          )}
        />
        <input
          type="text"
          value={query}
          data-testid="input-nav-search"
          onChange={handleChange}
          onFocus={() => {
            setFocused(true);
            if (query.trim().length >= 2) setOpen(true);
          }}
          autoFocus={compact && focused}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setFocused(false); setQuery(""); setResults([]); }
            if (e.key === "Enter" && query.trim()) {
              recordMoodSignal(query.trim());
              setOpen(false);
              setFocused(false);
              setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
            }
          }}
          placeholder="Search movies, shows, people…"
          className={cn(
            "w-full bg-card/60 border border-border rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors",
            compact && !focused && "hidden",
            compact && focused && "fixed left-4 right-4 top-[6.5rem] z-[60] w-auto shadow-2xl",
          )}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-md shadow-xl z-[100] overflow-hidden",
            compact && focused && "fixed left-4 right-4 top-[9.6rem] z-[60] mt-0 max-h-[70vh] overflow-y-auto",
          )}
        >
          {loading && results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              Searching for “{query.trim()}”…
            </div>
          ) : results.length > 0 ? (
            results.map((r) => (
              <button
                key={`${r.mediaType}-${r.id}`}
                onMouseDown={() => navigate(r)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
              >
                {r.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${r.posterPath}`}
                    alt={r.title}
                    className="w-8 h-12 object-cover rounded flex-none"
                  />
                ) : (
                  <div className="w-8 h-12 bg-muted rounded flex-none" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{r.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {mediaIcon(r.mediaType)}
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {r.mediaType === "person" ? "Person" : r.mediaType === "tv" ? "TV Show" : "Movie"}
                    </span>
                    {r.releaseDate && (
                      <span className="text-[10px] text-muted-foreground">
                        · {new Date(r.releaseDate).getFullYear()}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              No matching movies, shows, or people yet.
            </div>
          )}
          <button
            onMouseDown={() => {
              recordMoodSignal(query.trim());
              setOpen(false);
              setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-primary hover:bg-accent transition-colors border-t border-border"
          >
            <span>See all results for "{query}"</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Side drawer ───────────────────────────────────────────────────────────────
interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

const DRAWER_LINKS = [
  { href: "/discover", label: "Discover", icon: TrendingUp },
  { href: "/genres", label: "Browse by Genre", icon: Film },
  { href: "/anime", label: "Anime", icon: Tv },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/friends", label: "Friends", icon: UserPlus, requiresSignIn: true },
  { href: "/professionals", label: "Industry Professionals", icon: Clapperboard },
  { href: "/feed", label: "Join FILMIO", icon: MessageSquare, requiresSignIn: true },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/search", label: "Advanced Search", icon: Search },
];

function SideDrawer({ open, onClose }: DrawerProps) {
  const { isSignedIn } = useUser();
  const [, setLocation] = useLocation();

  const go = (href: string) => {
    onClose();
    setLocation(href);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[200] bg-[hsl(var(--ink)/0.78)] backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[min(20rem,88vw)] bg-card border-r border-border z-[201] flex flex-col transition-transform duration-300 shadow-2xl",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <Link
            href="/"
            onClick={onClose}
            className="brand-wordmark text-primary text-glow transition-opacity hover:opacity-80"
            aria-label="FILMIO homepage"
          >
            FILMIO
          </Link>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-primary transition-colors" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <p className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Navigation
          </p>
          {DRAWER_LINKS.map(({ href, label, icon: Icon, requiresSignIn }) => (
            <button
              key={href}
              onClick={() => go(requiresSignIn && !isSignedIn ? `/sign-in?redirect=${encodeURIComponent(href)}` : href)}
              className="w-full min-h-11 flex items-center gap-3 px-5 text-sm hover:bg-accent/15 hover:text-primary transition-colors group"
              data-testid={`drawer-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-display uppercase tracking-wider text-xs font-semibold">
                {label}
              </span>
            </button>
          ))}

          <div className="my-4 border-t border-border/50" />

          <p className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Top Box Office Genres
          </p>
          {[
            { id: 28, label: "Action" },
            { id: 35, label: "Comedy" },
            { id: 18, label: "Drama" },
            { id: 27, label: "Horror" },
            { id: 878, label: "Sci-Fi" },
            { id: 16, label: "Animation" },
            { id: 10749, label: "Romance" },
          ].map(({ id, label }) => (
             <button
              key={id}
              onClick={() => go(`/genre/${id}`)}
               className="w-full min-h-11 flex items-center justify-between px-5 text-xs text-muted-foreground hover:text-primary hover:bg-accent/15 transition-colors"
                data-testid={`drawer-genre-${id}`}
            >
              <span className="font-display uppercase tracking-widest">{label}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export function Navbar() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: watchlist } = useGetWatchlist({
    query: { queryKey: getGetWatchlistQueryKey(), enabled: isLoaded && !!isSignedIn },
  });
  const watchlistCount = watchlist?.length ?? 0;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 28);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header
        className={cn(
          "fixed top-0 z-50 w-full border-b border-transparent transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500",
          scrolled
            ? "border-border/80 bg-background/92 shadow-[0_14px_38px_-28px_hsl(var(--primary)/0.65)] backdrop-blur-xl"
            : location === "/"
              ? "bg-gradient-to-b from-[hsl(var(--ink)/0.72)] via-[hsl(var(--ink)/0.2)] to-transparent"
              : "bg-background/82 backdrop-blur-md",
        )}
      >
        <div className="container relative mx-auto flex h-[4.75rem] items-center gap-2 px-3 sm:h-[4.5rem] sm:gap-4 sm:px-4">
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label="Open menu"
            data-testid="button-open-menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile search comes before the centered logo */}
          <div className="sm:hidden">
            <NavSearch compact />
          </div>

          {/* Logo */}
          <Link
            href="/"
            className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 text-primary transition-colors hover:text-primary/80 sm:gap-2"
            aria-label="FILMIO homepage"
            data-testid="link-home-brand"
          >
            <Clapperboard className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="brand-wordmark mobile-brand-mark text-glow">
              FILMIO
            </span>
          </Link>

          {/* Desktop search — grows to fill space */}
          <div className="absolute bottom-3 left-4 right-4 hidden sm:static sm:mr-auto sm:flex sm:flex-1 sm:justify-start sm:pl-3 md:max-w-[260px] lg:max-w-[calc(50%-4rem)]">
            <NavSearch />
          </div>

          <nav className="ml-auto hidden items-center gap-5 lg:flex" aria-label="Primary navigation">
            <Link
              href="/discover"
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
                location === "/discover" ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
              data-testid="link-discover"
            >
              Discover
            </Link>
            <Link
              href="/anime"
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
                location === "/anime" ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
              data-testid="link-anime"
            >
              Anime
            </Link>
            <Link
              href="/news"
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
                location === "/news" ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
              data-testid="link-news"
            >
              News
            </Link>
          </nav>

          {/* Right: auth */}
          <div className="ml-auto flex flex-none items-center gap-1.5 sm:gap-3 lg:ml-5">
            <Link
              href="/watchlist"
              className={cn(
                "relative hidden min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors sm:flex",
                location === "/watchlist" ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
              aria-label={`Open watchlist${watchlistCount ? `, ${watchlistCount} saved` : ""}`}
              data-testid="link-watchlist"
            >
              <Bookmark className="h-4 w-4" />
              <span>Watchlist</span>
              {watchlistCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {watchlistCount > 99 ? "99+" : watchlistCount}
                </span>
              )}
            </Link>
            {isSignedIn ? (
              <>
                  <Link href="/chat" className="hidden h-11 w-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary sm:flex" aria-label="Open messages" data-testid="link-chat">
                  <MessageSquare className="w-5 h-5" />
                </Link>
                  <Link href={`/profile/${user.id}`} className="flex h-11 w-11 items-center justify-center rounded-sm" data-testid="link-profile">
                   <img
                    src={user.imageUrl}
                    alt={user.fullName || "User"}
                    className="h-8 w-8 rounded-sm border border-border object-cover transition-colors hover:border-primary"
                  />
                </Link>
                 <button
                  onClick={() => signOut()}
                    className="hidden h-11 w-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:flex"
                  title="Sign Out"
                   aria-label="Sign out"
                   data-testid="button-sign-out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                  <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex" data-testid="button-sign-in">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                 <Button asChild size="sm" data-testid="button-sign-up">
                  <Link href="/sign-up">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
