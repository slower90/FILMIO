import { Navbar } from "@/components/navbar";
import { useSearchMovies, useSearchProfessionals } from "@workspace/api-client-react";
import { MovieCard } from "@/components/movie-card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce"; // We need to create this or use a simple timer
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

export default function Search() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  // Custom debounce logic since we don't have the hook ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: movies, isLoading: loadingMovies } = useSearchMovies(
    { q: debouncedQuery, page: 1 },
    { query: { enabled: debouncedQuery.length > 2 } }
  );

  const { data: professionals, isLoading: loadingPro } = useSearchProfessionals(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 2 } }
  );

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
            <TabsList className="mb-8 w-full justify-start h-auto p-0 bg-transparent gap-6 border-b border-border rounded-none">
              <TabsTrigger 
                value="movies" 
                className="font-display uppercase tracking-widest text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0"
              >
                Movies {movies?.totalResults ? `(${movies.totalResults})` : ""}
              </TabsTrigger>
              <TabsTrigger 
                value="professionals" 
                className="font-display uppercase tracking-widest text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0"
              >
                Professionals {professionals?.length ? `(${professionals.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="movies" className="animate-in fade-in duration-500">
              {loadingMovies ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="aspect-[2/3] w-full animate-pulse bg-muted rounded-md" />
                  ))}
                </div>
              ) : movies?.results?.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {movies.results.map(movie => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
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
