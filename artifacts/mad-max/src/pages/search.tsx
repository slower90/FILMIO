import { Navbar } from "@/components/navbar";
import {
  getSearchProfessionalsQueryKey,
  useSearchProfessionals,
  type MovieSummary,
} from "@workspace/api-client-react";
import { MovieCard } from "@/components/movie-card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Tv, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useSearch } from "wouter";
import { recordMoodSignal } from "@/lib/mood-agent";
import { CatalogStatusNotice, type CatalogMetadata } from "@/components/catalog-status-notice";

interface RankedAnime {
  id: number;
  title: string;
  posterPath: string | null;
  score: number;
  releaseDate: string | null;
  type: string;
  malUrl: string | null;
}

const rankingWords = "(best|top|highest[ -]?rated|greatest|must[ -]?watch|popular)";
const bestAnimePattern = new RegExp(`${rankingWords}.*\\banime\\b|\\banime\\b.*${rankingWords}`, "i");

interface SmartSearchResponse {
  query: string;
  intent: {
    limit: number;
    genre: string | null;
    language: string | null;
    india: boolean;
    anime: boolean;
    adult: boolean;
    sort: "rating" | "recent" | "popular" | "relevance";
    year: number | null;
  };
  results: MovieSummary[];
  totalResults: number;
  metadata?: CatalogMetadata;
}

function initialResultLimit(value: string) {
  const match = value.match(/\b(\d{1,3})\b/);
  return match ? Math.min(Math.max(Number(match[1]), 1), 100) : 20;
}

function RankedAnimeCard({ anime, rank }: { anime: RankedAnime; rank: number }) {
  return (
    <a
      href={anime.malUrl || `https://myanimelist.net/anime/${anime.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-card">
        {anime.posterPath ? (
          <img src={anime.posterPath} alt={anime.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><Tv className="h-8 w-8" /></div>
        )}
        <div className="absolute left-2 top-2 flex h-8 min-w-8 items-center justify-center rounded bg-black/80 px-2 font-display text-lg font-bold text-primary">
          {String(rank).padStart(2, "0")}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-3 pt-10">
          <p className="line-clamp-2 text-sm font-bold text-white">{anime.title}</p>
        </div>
      </div>
    </a>
  );
}

export default function Search() {
  const searchParams = useSearch();
  const urlQuery = new URLSearchParams(searchParams).get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [resultLimit, setResultLimit] = useState(() => initialResultLimit(urlQuery));
  const isBestAnimeSearch = bestAnimePattern.test(debouncedQuery.trim());

  // The navbar navigates here with /search?q=..., so keep the input and
  // results synchronized when a new search is submitted.
  useEffect(() => {
    setQuery(urlQuery);
    setDebouncedQuery(urlQuery);
    setResultLimit(initialResultLimit(urlQuery));
    if (urlQuery) recordMoodSignal(urlQuery);
  }, [urlQuery]);
  
  // Custom debounce logic since we don't have the hook ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: smartSearch, isLoading: loadingMovies } = useQuery<SmartSearchResponse>({
    queryKey: ["smart-movie-search", debouncedQuery, resultLimit],
    queryFn: async () => {
      const response = await fetch(`/api/movies/search-smart?q=${encodeURIComponent(debouncedQuery)}&limit=${resultLimit}`);
      if (!response.ok) throw new Error("Unable to search movies");
      return response.json();
    },
    enabled: debouncedQuery.length > 2 && !isBestAnimeSearch,
    staleTime: 5 * 60 * 1000,
  });

  const { data: professionals, isLoading: loadingPro } = useSearchProfessionals(
    { q: debouncedQuery },
    { query: { queryKey: getSearchProfessionalsQueryKey({ q: debouncedQuery }), enabled: debouncedQuery.length > 2 && !isBestAnimeSearch } }
  );

  const { data: rankedAnime, isLoading: loadingRankedAnime } = useQuery<{ results: RankedAnime[] }>({
    queryKey: ["search-ranked-anime"],
    queryFn: async () => {
      const response = await fetch("/api/anime/top?filter=score&type=tv&page=1");
      if (!response.ok) throw new Error("Unable to load ranked anime");
      return response.json();
    },
    enabled: debouncedQuery.length > 2 && isBestAnimeSearch,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 max-w-6xl">
        <div className="relative mb-12 group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <SearchIcon className="h-8 w-8 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-20 pr-6 py-10 text-2xl md:text-4xl bg-card border-2 border-border focus-visible:ring-0 focus-visible:border-primary rounded-xl font-display uppercase tracking-widest placeholder:text-muted-foreground/50 transition-all shadow-lg"
            placeholder="Find movies, people, or genres..."
          />
        </div>

        {debouncedQuery.length <= 2 ? (
          <div className="text-center py-20 opacity-50">
            <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-display uppercase tracking-widest text-muted-foreground">Type to search</h2>
          </div>
        ) : (
          <Tabs defaultValue="movies" className="w-full">
            <CatalogStatusNotice metadata={smartSearch?.metadata} />
            <TabsList className="mb-8 w-full justify-start h-auto p-0 bg-transparent gap-6 border-b border-border rounded-none">
              <TabsTrigger 
                value="movies" 
                className="font-display uppercase tracking-widest text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0"
              >
                 {isBestAnimeSearch ? "Top Anime" : "Movies"}{" "}
                {isBestAnimeSearch
                  ? rankedAnime?.results?.length ? `(${rankedAnime.results.length})` : ""
                   : smartSearch?.totalResults ? `(${smartSearch.totalResults})` : ""}
              </TabsTrigger>
              <TabsTrigger 
                value="professionals" 
                className="font-display uppercase tracking-widest text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0"
              >
                Professionals {professionals?.length ? `(${professionals.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="movies" className="animate-in fade-in duration-500">
              {isBestAnimeSearch ? (
                loadingRankedAnime ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-muted" />)}
                  </div>
                ) : rankedAnime?.results?.length ? (
                  <div>
                    <div className="mb-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Anime picks</p>
                      <h2 className="mt-1 font-display text-2xl uppercase tracking-wider">Top Rated Anime</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                      {rankedAnime.results.map((anime, index) => <RankedAnimeCard key={anime.id} anime={anime} rank={index + 1} />)}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center"><h2 className="font-display text-2xl uppercase tracking-widest text-muted-foreground">No ranked anime found</h2></div>
                )
              ) : loadingMovies ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="aspect-[2/3] w-full animate-pulse bg-muted rounded-md" />
                  ))}
                </div>
              ) : smartSearch?.results?.length ? (
                <div>
                  {smartSearch.intent.genre || smartSearch.intent.language || smartSearch.intent.year || smartSearch.intent.adult || smartSearch.intent.sort !== "relevance" ? (
                    <div className="mb-6 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                        Smart results
                      </span>
                      {smartSearch.intent.genre && <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary">{smartSearch.intent.genre}</span>}
                      {smartSearch.intent.language && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{smartSearch.intent.language}</span>}
                      {smartSearch.intent.year && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{smartSearch.intent.year}</span>}
                      {smartSearch.intent.adult && <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary">18+ collection</span>}
                      <span className="text-xs text-muted-foreground">
                        {smartSearch.intent.sort === "rating" ? "Sorted by highest rating" : smartSearch.intent.sort === "recent" ? "Sorted by newest" : smartSearch.intent.sort === "popular" ? "Sorted by popularity" : "Best matches"}
                      </span>
                    </div>
                  ) : null}
                   <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
                  {smartSearch.results.map(movie => (
                    <MovieCard key={movie.id} movie={movie} showDescription />
                  ))}
                  </div>
                    {smartSearch.results.length < smartSearch.totalResults && smartSearch.results.length < 100 && (
                     <div className="mt-10 flex justify-center">
                       <button
                         type="button"
                          onClick={() => setResultLimit(100)}
                         disabled={loadingMovies}
                         className="rounded-md border border-primary/60 bg-primary/10 px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                       >
                         {loadingMovies ? "Loading more…" : "Show more movies"}
                       </button>
                     </div>
                   )}
                </div>
              ) : (
                <div className="text-center py-20">
                  <h2 className="text-2xl font-display uppercase tracking-widest text-muted-foreground">No movies found</h2>
                </div>
              )}
            </TabsContent>

            <TabsContent value="professionals" className="animate-in fade-in duration-500">
              {loadingPro ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 w-full animate-pulse bg-muted rounded-md" />
                  ))}
                </div>
              ) : professionals?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {professionals.map(pro => (
                    <Link key={pro.id} href={`/professionals/${pro.id}`}>
                      <div className="bg-card border border-border rounded-md p-6 flex items-center gap-6 hover-elevate transition-all cursor-pointer">
                        <img 
                          src={pro.headshotUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${pro.displayName}`}
                          alt={pro.displayName || "Pro"}
                          className="w-16 h-16 rounded-full object-cover border border-border"
                        />
                        <div>
                          <h3 className="font-bold text-lg hover:text-primary transition-colors">{pro.displayName}</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {pro.roles?.map(role => (
                              <span key={role} className="text-[10px] uppercase tracking-wider bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-2xl font-display uppercase tracking-widest text-muted-foreground">No professionals found</h2>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
