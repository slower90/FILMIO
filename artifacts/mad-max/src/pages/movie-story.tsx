import { useGetMovieStory, getGetMovieStoryQueryKey, type MovieStory } from "@workspace/api-client-react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Clock3, ExternalLink, FileText, Film, Info, Library, MapPin, Tag, Users } from "lucide-react";
import { Link, useParams, useSearch } from "wouter";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { tmdbBackdropSrcSet, tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/utils";
import { movieStoryPath, withMovieTitle } from "@/lib/movie-links";
import { SITE_URL } from "@/lib/seo";

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function StorySkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <main aria-label="Loading movie story" className="pt-20">
        <div className="h-[46vh] min-h-[27rem] animate-pulse bg-card/70" />
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[12rem_minmax(0,44rem)]">
          <div className="hidden h-4 w-24 animate-pulse bg-muted lg:block" />
          <div className="space-y-7">
            <div className="h-5 w-32 animate-pulse bg-muted" />
            <div className="h-20 w-full animate-pulse bg-muted sm:h-28" />
            <div className="h-5 w-3/4 animate-pulse bg-muted" />
            <div className="space-y-3 pt-8">
              {[1, 2, 3, 4, 5].map((line) => (
                <div key={line} className={`h-4 animate-pulse bg-muted ${line === 5 ? "w-2/3" : "w-full"}`} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StoryUnavailable({ movieId, title, mediaType }: { movieId: number; title?: string; mediaType: "movie" | "tv" }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <main className="mx-auto flex min-h-[75dvh] max-w-2xl items-center justify-center px-5 py-24">
        <section className="w-full border border-border bg-card/70 p-7 text-center shadow-2xl sm:p-12" data-testid="status-story-unavailable">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="cinema-kicker mb-4">FILMIO Journal</p>
          <h1 className="text-3xl sm:text-4xl">This story is not available yet</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
            {title ? `We could not assemble a source-backed story for ${title}.` : "This editorial story could not be found or is still being prepared."}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link href={title ? withMovieTitle(`/movies/${movieId}${mediaType === "tv" ? "?type=tv" : ""}`, title) : `/movies/${movieId}${mediaType === "tv" ? "?type=tv" : ""}`} data-testid="link-back-to-movie">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back to title
              </Link>
            </Button>
            <Button asChild>
              <Link href="/discover" data-testid="link-story-discover">Explore FILMIO</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function StoryMeta({ story }: { story: MovieStory }) {
  const releaseDate = formatDate(story.movie.releaseDate);
  const updatedDate = formatDate(story.updatedAt);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground" data-testid="story-meta">
      <span className="inline-flex items-center gap-2 text-primary">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        FILMIO Journal
      </span>
      <span className="inline-flex items-center gap-2">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        {story.readTimeMinutes} min read
      </span>
      {releaseDate && (
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {releaseDate}
        </span>
      )}
      {updatedDate && <span className="text-muted-foreground/70">Updated {updatedDate}</span>}
    </div>
  );
}

function StoryTopics({ topics = [] }: { topics?: MovieStory["topics"] }) {
  if (!topics.length) return null;
  const people = topics.filter((topic) => topic.kind === "person");
  const genres = topics.filter((topic) => topic.kind === "genre");
  const countries = topics.filter((topic) => topic.kind === "country");

  return (
    <section className="mt-20 border-y border-border/80 py-8 sm:mt-24 sm:py-10" aria-labelledby="story-topics-heading" data-testid="story-topics">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="cinema-kicker text-primary">Keep following the thread</p>
          <h2 id="story-topics-heading" className="mt-3 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">More to discover around this title</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">Move from the film to the people, genres, and places that give its story a wider frame.</p>
      </div>
      <div className="mt-7 flex flex-wrap gap-3" role="list" aria-label="Related movie topics">
        {people.map((topic) => (
          <Link key={`${topic.kind}-${topic.label}`} href={topic.href} className="story-topic-chip" role="listitem" data-testid="story-topic-person">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {topic.label}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ))}
        {genres.map((topic) => (
          <Link key={`${topic.kind}-${topic.label}`} href={topic.href} className="story-topic-chip" role="listitem" data-testid="story-topic-genre">
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            {topic.label}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ))}
        {countries.map((topic) => (
          <Link key={`${topic.kind}-${topic.label}`} href={topic.href} className="story-topic-chip" role="listitem" data-testid="story-topic-country">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {topic.label}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function StorySources({ story }: { story: MovieStory }) {
  const sources = story.sources ?? [];
  if (!sources.length) return null;
  return (
    <aside className="mt-20 border-t border-border pt-8" aria-labelledby="story-sources-heading">
      <div className="mb-5 flex items-center gap-3">
        <Library className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="story-sources-heading" className="text-sm tracking-[0.14em]">Sources &amp; references</h2>
      </div>
      <p className="mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
        This story is assembled from the references below. Links open the original publisher or official catalog in a new tab.
      </p>
      <ol className="grid gap-3 sm:grid-cols-2" data-testid="list-story-sources">
        {sources.map((source, index) => {
          const href = safeExternalUrl(source.url);
          return (
            <li key={`${source.name}-${index}`} className="border border-border/80 bg-card/50 p-4" data-testid={`source-card-${index}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-foreground">{source.name}</p>
                  <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-primary">{source.kind}</p>
                </div>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`Open ${source.name} source`}
                    data-testid={`link-story-source-${index}`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
              {source.note && <p className="mt-3 text-xs leading-5 text-muted-foreground">{source.note}</p>}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

export default function MovieStory() {
  const { id } = useParams();
  const search = useSearch();
  const movieId = Number.parseInt(id || "", 10);
  const mediaType = new URLSearchParams(search).get("type") === "tv" ? "tv" : "movie";
  const storyQuery = useGetMovieStory(
    movieId,
    { type: mediaType },
    { query: { queryKey: getGetMovieStoryQueryKey(movieId, { type: mediaType }), enabled: Number.isFinite(movieId) && movieId > 0 } },
  );
  const story = storyQuery.data;
  const movie = story?.movie;
  const canonicalPath = movie
    ? movieStoryPath(movie.id, movie.title, mediaType)
    : `/blog/movies/${Number.isFinite(movieId) ? movieId : ""}`;
  const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
  const posterUrl = movie?.posterPath ? tmdbPosterUrl(movie.posterPath, "w500") : undefined;
  const title = story?.headline || (movie ? `${movie.title}: the FILMIO story` : "Movie story | FILMIO");
  const description = (story?.dek || movie?.overview || "A source-backed movie story from the FILMIO Journal.").slice(0, 300);
  const breadcrumbTitle = movie?.title || "Movie story";
  const publishedDate = story?.updatedAt || movie?.releaseDate;
  const structuredData = story && movie ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${canonicalUrl}#article`,
        headline: story.headline,
        description,
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        inLanguage: "en-IN",
        dateModified: story.updatedAt,
        ...(publishedDate ? { datePublished: publishedDate } : {}),
        ...(posterUrl ? { image: posterUrl } : {}),
        author: { "@type": "Organization", name: "FILMIO", url: SITE_URL },
        publisher: { "@type": "Organization", name: "FILMIO", url: SITE_URL },
        about: { "@type": movie.mediaType === "tv" ? "TVSeries" : "Movie", name: movie.title },
        articleSection: "Movie stories",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "FILMIO", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Movie Journal", item: `${SITE_URL}/discover` },
          { "@type": "ListItem", position: 3, name: breadcrumbTitle, item: canonicalUrl },
        ],
      },
    ],
  } : null;

  if (storyQuery.isLoading) return <StorySkeleton />;
  if (storyQuery.isError || !story || story.status === "unavailable" || !movie) {
    return <StoryUnavailable movieId={movieId} title={movie?.title} mediaType={mediaType} />;
  }

  const movieLink = withMovieTitle(`/movies/${movie.id}${movie.mediaType === "tv" ? "?type=tv" : ""}`, movie.title);
  const backdrop = movie.backdropPath || movie.posterPath;
  const isPartial = story.status === "partial";
  const sections = story.sections ?? [];

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <Helmet>
        <title>{title} | FILMIO Journal</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="en-IN" href={canonicalUrl} />
        <meta property="og:site_name" content="FILMIO" />
        <meta property="og:title" content={`${title} | FILMIO Journal`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="article" />
        {posterUrl && <meta property="og:image" content={posterUrl} />}
        {posterUrl && <meta property="og:image:alt" content={`${movie.title} poster`} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title} | FILMIO Journal`} />
        <meta name="twitter:description" content={description} />
        {posterUrl && <meta name="twitter:image" content={posterUrl} />}
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>
      <Navbar />

      <header className="relative isolate overflow-hidden border-b border-border/70 pt-16" data-testid="story-header">
        <div className="absolute inset-0 -z-20">
          {backdrop && <img src={tmdbBackdropUrl(backdrop)} srcSet={tmdbBackdropSrcSet(backdrop)} sizes="100vw" alt={`${movie.title} backdrop`} width={1280} height={720} className="h-full w-full object-cover object-center opacity-35" loading="eager" fetchPriority="high" decoding="async" />}
        </div>
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/.94)_42%,hsl(var(--background)/.5)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,hsl(var(--background))_0%,transparent_75%)]" />
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <Link href={movieLink} className="mb-12 inline-flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary" data-testid="link-story-movie">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to {movie.title}
          </Link>
          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] xl:grid-cols-[minmax(0,48rem)_17rem]">
            <div>
               <p className="editorial-kicker mb-7">A source-backed film note · {sections.length} chapters</p>
              <StoryMeta story={story} />
              <h1 className="mt-7 max-w-5xl text-[clamp(2.65rem,7vw,6.7rem)] font-medium leading-[0.92] tracking-[-0.065em] text-foreground normal-case" data-testid="heading-story-headline">
                {story.headline}
              </h1>
              <p className="mt-7 max-w-3xl text-lg leading-8 text-foreground/75 sm:text-xl sm:leading-9" data-testid="text-story-dek">
                {story.dek}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {movie.genres?.slice(0, 4).map((genre) => (
                  <Link key={genre.id} href={`/genre/${genre.id}`} className="border border-primary/30 bg-primary/10 px-3 py-1.5 text-[0.63rem] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:border-primary hover:bg-primary/20" data-testid={`link-story-genre-${genre.id}`}>
                    {genre.name}
                  </Link>
                ))}
              </div>
            </div>
            {movie.posterPath && (
              <div className="hidden justify-self-end lg:block">
                <img src={posterUrl} alt={`${movie.title} poster`} width={500} height={750} className="aspect-[2/3] w-full max-w-[17rem] border border-border/80 object-cover shadow-2xl" loading="lazy" decoding="async" data-testid="img-story-poster" />
              </div>
            )}
          </div>
        </div>
      </header>

      {isPartial && (
        <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8 lg:px-12" data-testid="status-story-partial">
          <div className="flex items-start gap-3 border border-primary/30 bg-primary/10 px-4 py-4 text-sm leading-6 text-foreground/80">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p><span className="font-bold text-primary">This story is still taking shape.</span> Some catalog or reference details are unavailable, so FILMIO has kept only the sourced notes it can stand behind.</p>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-7xl gap-10 px-5 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[12rem_minmax(0,47rem)] lg:gap-16 lg:px-12">
        <aside className="hidden lg:block">
          <div className="sticky top-28 border-t border-primary/60 pt-4">
             <p className="text-[0.63rem] font-bold uppercase tracking-[0.2em] text-primary">Follow the thread</p>
            <ol className="mt-5 space-y-4">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="flex gap-2 text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground" data-testid={`link-story-section-${section.id}`}>
                    <span className="font-display text-primary/70">{String(index + 1).padStart(2, "0")}</span>
                    <span>{section.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <article className="min-w-0" data-testid="article-movie-story">
          {sections.length ? (
            <div className="space-y-14 sm:space-y-20">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id} className="scroll-mt-24" data-testid={`story-section-${section.id}`}>
                  <div className="mb-6 flex items-center gap-4">
                    <span className="font-display text-sm font-bold tracking-widest text-primary">{String(index + 1).padStart(2, "0")}</span>
                    <div className="cinema-rule flex-1" />
                  </div>
                  <h2 className="section-marker max-w-3xl text-2xl font-medium normal-case leading-tight tracking-[-0.03em] sm:text-4xl">{section.heading}</h2>
                  <div className="mt-7 space-y-5 text-[1.06rem] leading-8 text-foreground/80 sm:text-lg sm:leading-9">
                    {(section.body ?? []).map((paragraph, paragraphIndex) => (
                      <p key={`${section.id}-${paragraphIndex}`} data-testid={`story-paragraph-${section.id}-${paragraphIndex}`}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-border p-8 text-center" data-testid="status-story-empty">
              <FileText className="mx-auto mb-4 h-7 w-7 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">The editorial notes for this title are not available yet.</p>
            </div>
          )}
          <StorySources story={story} />
           <StoryTopics topics={story.topics ?? []} />
          <div className="mt-14 flex flex-col gap-4 border-t border-border pt-7 sm:flex-row sm:items-center sm:justify-between">
             <p className="text-xs leading-5 text-muted-foreground">Ready for the next scene? More context, ratings, and viewing options for {movie.title}.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href={movieLink} data-testid="link-story-details">
                  <Film className="mr-2 h-4 w-4" aria-hidden="true" />
                  Title details
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/discover" data-testid="link-story-more">
                  More films
                  <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}