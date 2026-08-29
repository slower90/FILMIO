import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { ArrowLeft, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api-url";

interface ActorDetails {
  id: number;
  name: string;
  profilePath?: string | null;
  biography?: string;
}

async function fetchActor(id: string) {
  const response = await apiFetch(`/api/movies/actors/${id}/credits`);
  if (!response.ok) throw new Error("Failed to load actor");
  return response.json() as Promise<{ actor: ActorDetails; results: RowMovie[] }>;
}

export default function ActorDetail() {
  const { id = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["actor-detail", id],
    queryFn: () => fetchActor(id),
    enabled: !!id,
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) return <div className="min-h-screen bg-background"><Navbar /></div>;
  if (!data?.actor) return <div className="min-h-screen bg-background"><Navbar /></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 pb-20 pt-28">
        <Link href="/actors" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> All actors
        </Link>
        <section className="flex flex-col gap-6 border-b border-border/50 pb-10 md:flex-row md:items-center">
          <div className="h-36 w-36 shrink-0 overflow-hidden rounded-full border-2 border-primary/50 bg-card">
            {data.actor.profilePath ? (
              <img
                src={`https://image.tmdb.org/t/p/w342${data.actor.profilePath}`}
                alt={data.actor.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="mx-auto mt-10 h-14 w-14 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Actor filmography</p>
            <h1 className="mt-2 text-4xl font-display font-bold uppercase tracking-tight text-glow">{data.actor.name}</h1>
            {data.actor.biography && (
              <p className="mt-3 line-clamp-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{data.actor.biography}</p>
            )}
          </div>
        </section>
        <MovieRow title={`All movies by ${data.actor.name}`} movies={data.results} />
      </main>
    </div>
  );
}