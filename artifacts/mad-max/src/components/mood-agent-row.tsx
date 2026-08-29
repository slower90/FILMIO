import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { getLearnedMood, MOODS, type MoodProfile } from "@/lib/mood-agent";
import { apiFetch } from "@/lib/api-url";

async function fetchMoodMovies(mood: MoodProfile): Promise<RowMovie[]> {
  const responses = await Promise.all(
    mood.genreIds.map(async (genreId) => {
      const res = await apiFetch(`/api/movies/by-genre?genreId=${genreId}&maxPages=1`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.results ?? [];
    }),
  );
  const seen = new Set<number>();
  return responses.flat().filter((movie: RowMovie) => {
    if (seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  }).slice(0, 12);
}

export function MoodAgentRow({ heading }: { heading?: string } = {}) {
  const [mood, setMood] = useState<MoodProfile>(MOODS.wonder);

  useEffect(() => {
    const update = () => setMood(getLearnedMood());
    update();
    window.addEventListener("mad-max-mood-change", update);
    return () => window.removeEventListener("mad-max-mood-change", update);
  }, []);

  const { data, isLoading } = useQuery<RowMovie[]>({
    queryKey: ["mood-agent", mood.id],
    queryFn: () => fetchMoodMovies(mood),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <section className="border-b border-border/30 bg-primary/[0.035]">
      {heading ? (
        <div className="container mx-auto px-4 pt-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Based on your activity</p>
          <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wider">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Searches and movie clicks se aapke liye selected.</p>
        </div>
      ) : null}
      <MovieRow
        title=""
        movies={data ?? []}
        isLoading={isLoading}
        className="pt-3"
      />
    </section>
  );
}