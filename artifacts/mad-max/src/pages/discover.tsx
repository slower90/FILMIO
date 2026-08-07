import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { Link } from "wouter";
import { useUser } from "@clerk/react";

// Genre row IDs and names for logged-in users
const GENRE_ROWS = [
  { id: 28,   name: "⚔️ Action" },
  { id: 18,   name: "🎭 Drama" },
  { id: 35,   name: "😂 Comedy" },
  { id: 27,   name: "👻 Horror" },
  { id: 878,  name: "🚀 Science Fiction" },
  { id: 16,   name: "🎨 Animation" },
  { id: 53,   name: "😱 Thriller" },
  { id: 10749, name: "❤️ Romance" },
] as const;

async function fetchCategory(path: string, maxPages = 3): Promise<RowMovie[]> {
  const res = await fetch(`/api/movies/${path}?maxPages=${maxPages}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.results ?? [];
}

async function fetchGenre(genreId: number): Promise<RowMovie[]> {
  const res = await fetch(`/api/movies/by-genre?genreId=${genreId}&maxPages=2`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.results ?? [];
}

function GenreRow({ id, name }: { id: number; name: string }) {
  const { data, isLoading } = useQuery<RowMovie[]>({
    queryKey: ["discover-genre", id],
    queryFn: () => fetchGenre(id),
    staleTime: 10 * 60 * 1000,
  });
  return (
    <MovieRow
      title={name}
      movies={data ?? []}
      isLoading={isLoading}
      className="border-b border-border/30"
    />
  );
}

export default function Discover() {
  const { user } = useUser();

  const { data: trending, isLoading: loadingTrending } = useQuery<RowMovie[]>({
    queryKey: ["discover-trending"],
    queryFn: () => fetchCategory("trending", 3),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newReleases, isLoading: loadingNew } = useQuery<RowMovie[]>({
    queryKey: ["discover-new-releases"],
    queryFn: () => fetchCategory("new-releases", 2),
    staleTime: 5 * 60 * 1000,
  });

  const { data: popular, isLoading: loadingPopular } = useQuery<RowMovie[]>({
    queryKey: ["discover-popular"],
    queryFn: () => fetchCategory("popular", 3),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topRated, isLoading: loadingTopRated } = useQuery<RowMovie[]>({
    queryKey: ["discover-top-rated"],
    queryFn: () => fetchCategory("top-rated", 3),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />

      {/* Welcome banner */}
      <div className="pt-24 pb-4 px-4 container mx-auto">
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tighter text-glow">
          {user?.firstName ? `Welcome back, ${user.firstName}.` : "Discover"}
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Your personalised cinema feed.{" "}
          <Link href="/genres" className="text-primary hover:underline">
            Browse all genres →
          </Link>
        </p>
      </div>

      {/* Category rows */}
      <div className="mt-6 bg-card/10 border-t border-border/50">
        <MovieRow
          title="🔥 Trending This Week"
          movies={trending ?? []}
          isLoading={loadingTrending}
          className="border-b border-border/30"
        />
        <MovieRow
          title="🎬 New in Cinemas"
          movies={newReleases ?? []}
          isLoading={loadingNew}
          className="border-b border-border/30"
        />
        <MovieRow
          title="📈 Popular Right Now"
          movies={popular ?? []}
          isLoading={loadingPopular}
          className="border-b border-border/30"
        />
        <MovieRow
          title="⭐ All-Time Classics"
          movies={topRated ?? []}
          isLoading={loadingTopRated}
          className="border-b border-border/30"
        />

        {/* Genre rows */}
        {GENRE_ROWS.map((g) => (
          <GenreRow key={g.id} id={g.id} name={g.name} />
        ))}
      </div>
    </div>
  );
}
