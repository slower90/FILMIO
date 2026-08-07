import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { useUser, useClerk } from "@clerk/react";
import {
  Search,
  MessageSquare,
  Clapperboard,
  LogOut,
  Menu,
  X,
  Film,
  Tv,
  Users,
  Newspaper,
  TrendingUp,
  Star,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Search result type ────────────────────────────────────────────────────────
interface SearchResult {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
}

// ── Persistent search bar component ──────────────────────────────────────────
function NavSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/movies/search-multi?q=${encodeURIComponent(q)}`);
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
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (r.mediaType === "movie") setLocation(`/movies/${r.id}`);
    else if (r.mediaType === "tv") setLocation(`/search?q=${encodeURIComponent(r.title)}`);
    else setLocation(`/search?q=${encodeURIComponent(r.title)}`);
  };

  const mediaIcon = (type: string) => {
    if (type === "tv") return <Tv className="w-3 h-3 text-blue-400 flex-none" />;
    if (type === "person") return <Users className="w-3 h-3 text-purple-400 flex-none" />;
    return <Film className="w-3 h-3 text-primary flex-none" />;
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs lg:max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); setResults([]); }
            if (e.key === "Enter" && query.trim()) {
              setOpen(false);
              setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
            }
          }}
          placeholder="Search movies, shows, people…"
          className="w-full bg-card/60 border border-border rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-md shadow-xl z-[100] overflow-hidden">
          {results.map((r) => (
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
                  {r.voteAverage > 0 && (
                    <span className="text-[10px] text-primary flex items-center gap-0.5 ml-auto">
                      <Star className="w-2.5 h-2.5 fill-primary" />
                      {r.voteAverage.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          <button
            onMouseDown={() => {
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
  { href: "/professionals", label: "Industry Professionals", icon: Users },
  { href: "/search", label: "Advanced Search", icon: Search },
];

function SideDrawer({ open, onClose }: DrawerProps) {
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
          "fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-card border-r border-border z-[201] flex flex-col transition-transform duration-300 shadow-2xl",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <span className="font-display font-bold text-xl tracking-wider text-primary text-glow">
            MAD MAX
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <p className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Navigation
          </p>
          {DRAWER_LINKS.map(({ href, label, icon: Icon }) => (
            <button
              key={href}
              onClick={() => go(href)}
              className="w-full flex items-center gap-3 px-6 py-3 text-sm hover:bg-accent hover:text-primary transition-colors group"
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
              className="w-full flex items-center justify-between px-6 py-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
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
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header
        className={cn(
          "fixed top-0 w-full z-50 transition-all duration-300 border-b border-transparent",
          scrolled
            ? "bg-background/90 backdrop-blur-md border-border box-glow"
            : "bg-gradient-to-b from-background/80 to-transparent",
        )}
      >
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-none text-muted-foreground hover:text-primary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <Link
            href={isSignedIn ? "/discover" : "/"}
            className="flex-none flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <Clapperboard className="w-5 h-5" />
            <span className="font-display font-bold text-lg tracking-wider text-glow hidden sm:inline">
              MAD MAX
            </span>
          </Link>

          {/* Search — grows to fill space */}
          <div className="flex-1 flex justify-center">
            <NavSearch />
          </div>

          {/* Right: auth */}
          <div className="flex-none flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Link href="/chat" className="hidden sm:block text-muted-foreground hover:text-primary transition-colors">
                  <MessageSquare className="w-5 h-5" />
                </Link>
                <Link href={`/profile/${user.id}`}>
                  <img
                    src={user.imageUrl}
                    alt={user.fullName || "User"}
                    className="w-8 h-8 rounded-sm object-cover border border-border"
                  />
                </Link>
                <button
                  onClick={() => signOut()}
                  className="hidden sm:block text-muted-foreground hover:text-destructive transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild size="sm">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild size="sm">
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
