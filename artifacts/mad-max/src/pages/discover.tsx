import { Navbar } from "@/components/navbar";
import { useGetTrendingMovies, useGetRecommendations, useGetMovieGenres, useGetMoviesByGenre } from "@workspace/api-client-react";
import { MovieCard } from "@/components/movie-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function Discover() {
  const { data: trending } = useGetTrendingMovies({ page: 1 });
  const { data: recommendations } = useGetRecommendations({ limit: 12 });
  const { data: genresResult } = useGetMovieGenres();
  
  // Just show two genre rows for now
  const genre1 = genresResult?.genres?.[0];
  const genre2 = genresResult?.genres?.[1];
  
  const { data: g1Movies } = useGetMoviesByGenre(
    { genreId: genre1?.id || 0 }, 
    { query: { enabled: !!genre1 } }
  );
  
  const { data: g2Movies } = useGetMoviesByGenre(
    { genreId: genre2?.id || 0 }, 
    { query: { enabled: !!genre2 } }
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 space-y-16">
        
        {/* Hero recommendations */}
        {recommendations && recommendations.length > 0 && (
          <section>
            <h1 className="text-3xl font-display font-bold uppercase tracking-wider mb-6 text-glow">For You</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
              {recommendations.slice(0, 6).map(movie => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </section>
        )}

        {/* Trending Horizontal */}
        <section>
          <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
            Trending Now <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          </h2>
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex w-max space-x-4 md:space-x-6">
              {trending?.results?.map(movie => (
                <div key={movie.id} className="w-[140px] md:w-[200px] shrink-0">
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>

        {/* Genre Rows */}
        {genre1 && g1Movies && (
          <section>
            <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-6">
              Best in {genre1.name}
            </h2>
            <ScrollArea className="w-full whitespace-nowrap pb-4">
              <div className="flex w-max space-x-4 md:space-x-6">
                {g1Movies.results?.slice(0, 10).map(movie => (
                  <div key={movie.id} className="w-[140px] md:w-[200px] shrink-0">
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>
        )}

        {genre2 && g2Movies && (
          <section>
            <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-6">
              {genre2.name} Essentials
            </h2>
            <ScrollArea className="w-full whitespace-nowrap pb-4">
              <div className="flex w-max space-x-4 md:space-x-6">
                {g2Movies.results?.slice(0, 10).map(movie => (
                  <div key={movie.id} className="w-[140px] md:w-[200px] shrink-0">
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>
        )}
      </main>
    </div>
  );
}
