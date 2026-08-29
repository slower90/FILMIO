import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { Search, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api-url";

interface Actor {
  id: number;
  name: string;
  profilePath?: string | null;
  knownForDepartment?: string;
}

async function fetchActors(query: string): Promise<Actor[]> {
  const params = new URLSearchParams({ maxPages: "5" });
  if (query.trim()) params.set("q", query.trim());
  const response = await apiFetch(`/api/movies/actors?${params}`);
  if (!response.ok) throw new Error("Failed to load actors");
  const data = await response.json();
  return data.results ?? [];
}

export default function Actors() {
  const [search, setSearch] = useState("");
  const { data: actors, isLoading } = useQuery<Actor[]>({
    queryKey: ["actors-directory", search],
    queryFn: () => fetchActors(search),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 pb-20 pt-28">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Global talent</p>
          <h1 className="mt-2 text-4xl font-display font-bold uppercase tracking-tight text-glow">Actors</h1>
          <p className="mt-2 text-muted-foreground">Explore actors from around the world and discover their movies.</p>
        </div>

        <div className="relative mb-10 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search any actor..."
            className="w-full rounded-md border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: 20 }).map((_, index) => (
              <div key={index} className="animate-pulse text-center">
                <div className="mx-auto aspect-square rounded-full bg-muted" />
                <div className="mx-auto mt-3 h-3 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : actors && actors.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {actors.map((actor) => (
              <Link key={actor.id} href={`/actors/${actor.id}`} className="group text-center">
                <div className="mx-auto aspect-square max-w-32 overflow-hidden rounded-full border-2 border-border bg-card group-hover:border-primary">
                  {actor.profilePath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${actor.profilePath}`}
                      alt={actor.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <UserRound className="mx-auto mt-8 h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold group-hover:text-primary">{actor.name}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {actor.knownForDepartment ?? "Acting"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-20 text-center text-muted-foreground">No actors found.</p>
        )}
      </main>
    </div>
  );
}