import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { apiFetch } from "@/lib/api-url";

const PROVIDERS = [
  { id: 8, name: "Netflix", mark: "N" },
  { id: 119, name: "Prime Video", mark: "P" },
  { id: 122, name: "JioHotstar", mark: "J" },
  { id: 232, name: "Zee5", mark: "Z" },
  { id: 237, name: "SonyLIV", mark: "S" },
  { id: 350, name: "Apple TV+", mark: "" },
  { id: 192, name: "YouTube", mark: "▶" },
  { id: 220, name: "MX Player", mark: "M" },
] as const;
type Provider = (typeof PROVIDERS)[number];

async function fetchProvider(providerId: number, mediaType: "movie" | "tv") {
  const res = await apiFetch(`/api/movies/provider?providerId=${providerId}&mediaType=${mediaType}&maxPages=2`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((movie: RowMovie) =>
    mediaType === "tv"
      ? { ...movie, linkHref: `/movies/${movie.id}?type=tv` }
      : { ...movie, linkHref: `/movies/${movie.id}` },
  );
}

export function OttDiscovery() {
  const [selected, setSelected] = useState<Provider>(PROVIDERS[0]);
  const { data: movies = [], isLoading: moviesLoading } = useQuery<RowMovie[]>({
    queryKey: ["ott-provider", selected.id, "movie"],
    queryFn: () => fetchProvider(selected.id, "movie"),
    staleTime: 10 * 60 * 1000,
  });
  const { data: shows = [], isLoading: showsLoading } = useQuery<RowMovie[]>({
    queryKey: ["ott-provider", selected.id, "tv"],
    queryFn: () => fetchProvider(selected.id, "tv"),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <section className="border-b border-border/30 py-10">
      <div className="container mx-auto px-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">Stream your way</p>
        <h2 className="text-2xl md:text-3xl font-display font-bold uppercase tracking-wider">Movies & Series on OTT</h2>
        <div
          className="relative mt-6 -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: "none" }}
          aria-label="Streaming providers"
        >
          <div className="flex w-max min-w-full gap-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => setSelected(provider)}
              aria-pressed={selected.id === provider.id}
              className={`flex h-10 min-w-max items-center gap-2 rounded-full border px-3.5 pr-4 font-sans text-[12px] font-semibold tracking-normal transition-all duration-200 ${
                selected.id === provider.id
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_rgba(245,158,11,0.9)]"
                   : "border-border bg-card text-muted-foreground hover:border-primary/60 hover:bg-muted hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  selected.id === provider.id
                     ? "bg-primary/80 text-primary-foreground"
                     : "bg-primary/15 text-primary"
                }`}
              >
                {provider.mark}
              </span>
              {provider.name}
            </button>
          ))}
          </div>
        </div>
      </div>
      <MovieRow title={`${selected.name} · Movies`} movies={movies} isLoading={moviesLoading} className="pb-5" />
      <MovieRow title={`${selected.name} · Web Series`} movies={shows} isLoading={showsLoading} className="pt-3" />
    </section>
  );
}