import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { useUser, useClerk } from "@clerk/react";
import { Search, Film, Users, MessageSquare, Clapperboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function Navbar() {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 w-full z-50 transition-all duration-300 border-b border-transparent",
      scrolled ? "bg-background/90 backdrop-blur-md border-border box-glow" : "bg-gradient-to-b from-background/80 to-transparent"
    )}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={isSignedIn ? "/discover" : "/"} className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <Clapperboard className="w-6 h-6" />
          <span className="font-display font-bold text-xl tracking-wider text-glow">MAD MAX</span>
        </Link>

        {isSignedIn && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <NavLink href="/discover" current={location}>Discover</NavLink>
            <NavLink href="/search" current={location}>Search</NavLink>
            <NavLink href="/watchlist" current={location}>Watchlist</NavLink>
            <NavLink href="/feed" current={location}>Feed</NavLink>
            <NavLink href="/professionals" current={location}>Industry</NavLink>
          </nav>
        )}

        <div className="flex items-center gap-4">
          {isSignedIn ? (
            <>
              <Link href="/chat" className="text-muted-foreground hover:text-primary transition-colors">
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
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, current, children }: { href: string, current: string, children: React.ReactNode }) {
  const active = current.startsWith(href);
  return (
    <Link 
      href={href} 
      className={cn(
        "font-display uppercase tracking-wider transition-colors hover:text-primary",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {children}
    </Link>
  );
}
