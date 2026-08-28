export type StorySource = {
  name: string;
  url: string;
  kind: "catalog" | "reference" | "official";
  note: string;
};

export type MovieStorySection = {
  id: string;
  heading: string;
  body: string[];
};

export type MovieStory = {
  status: "ready" | "partial" | "unavailable";
  movie: {
    id: number;
    title: string;
    mediaType: "movie" | "tv";
    releaseDate: string;
    posterPath: string | null;
    backdropPath: string | null;
    overview: string;
    tagline: string | null;
    runtime: number | null;
    genres: Array<{ id: number; name: string }>;
    imdbId: string | null;
  };
  headline: string;
  dek: string;
  readTimeMinutes: number;
  updatedAt: string;
  sections: MovieStorySection[];
  sources: StorySource[];
};

type StoryCacheEntry = {
  value: MovieStory;
  expiresAt: number;
};

type CatalogStoryResponse = {
  data: any;
  source?: string;
  fetchedAt?: string;
  stale?: boolean;
};

const STORY_TTL_MS = 30 * 60 * 1000;
const STORY_STALE_TTL_MS = 6 * 60 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 5_000;
const storyCache = new Map<string, StoryCacheEntry>();
const storyInFlight = new Map<string, Promise<MovieStory>>();

const cleanText = (value: unknown): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();

const firstSentence = (value: string): string => {
  const sentence = cleanText(value).match(/^(.{40,260}?[.!?])(?:\s|$)/)?.[1];
  return sentence || cleanText(value).slice(0, 240).replace(/[,:;]$/, "");
};

const yearFromDate = (date: string): number | null => {
  const year = Number(String(date).slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : null;
};

const listNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
};

const uniqueByUrl = (sources: StorySource[]) => [
  ...new Map(sources.map((source) => [source.url, source])).values(),
];

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "FILMIO/1.0 (film discovery)" },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type WikipediaSearchResponse = [string, string[], string[], string[]];
type WikipediaSummary = {
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  description?: string;
};

async function fetchWikipediaContext(title: string): Promise<{
  extract: string;
  url: string;
} | null> {
  const search = await fetchJson<WikipediaSearchResponse>(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(title)}&limit=3&namespace=0&format=json&origin=*`,
  );
  const candidates = search?.[1] ?? [];
  const candidate = candidates.find((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes(title.toLowerCase()) || title.toLowerCase().includes(normalized);
  });
  if (!candidate) return null;

  const summary = await fetchJson<WikipediaSummary>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate.replace(/ /g, "_"))}`,
  );
  if (!summary) return null;
  const extract = firstSentence(summary?.extract ?? "");
  if (!extract) return null;
  const url =
    summary?.content_urls?.desktop?.page ??
    `https://en.wikipedia.org/wiki/${encodeURIComponent(candidate.replace(/ /g, "_"))}`;
  return { extract, url };
}

export function storyForMovie(input: {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  releaseDate: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  tagline: string | null;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  imdbId: string | null;
  cast: Array<{ name: string; character?: string }>;
  crew: Array<{ name: string; job: string }>;
  wikipedia: { extract: string; url: string } | null;
  trailerUrl: string | null;
  updatedAt: string;
  catalogSource?: string;
}): MovieStory {
  const {
    title,
    mediaType,
    releaseDate,
    genres,
    overview,
    tagline,
    runtime,
    cast,
    crew,
    wikipedia,
    imdbId,
    trailerUrl,
    catalogSource,
  } = input;
  const year = yearFromDate(releaseDate);
  const genreNames = genres.map((genre) => cleanText(genre.name).toLowerCase()).filter(Boolean);
  const genrePhrase = listNames(genreNames.slice(0, 3));
  const director = crew.find((member) => member.job === "Director");
  const writers = crew.filter((member) => /writer|screenplay/i.test(member.job)).map((member) => member.name).filter(Boolean);
  const leadCast = cast.slice(0, 3).map((member) => cleanText(member.name)).filter(Boolean);
  const subject = mediaType === "tv" ? "series" : "film";
  const overviewSentence = firstSentence(overview);
  const wikipediaSentence = firstSentence(wikipedia?.extract ?? "");

  const sections: MovieStorySection[] = [
    {
      id: "the-premise",
      heading: "The premise",
      body: [
        overviewSentence
          ? `${title} begins with a premise that is easy to describe and harder to shake: ${overviewSentence}`
          : `${title} is a ${genrePhrase || "screen story"} with its own pace, texture, and point of view.`,
        wikipediaSentence && wikipediaSentence.toLowerCase() !== overviewSentence.toLowerCase()
          ? `The wider context places it in a larger conversation around ${genrePhrase || "cinema"} without reducing the ${subject} to a single label.`
          : `That balance between a clear setup and room for interpretation is part of what makes this a natural pick for a considered watch.`,
      ],
    },
    {
      id: "the-feeling",
      heading: "What it feels like",
      body: [
        genreNames.includes("comedy")
          ? `The pleasure is in the timing: ${title} lets its characters breathe, then finds the small turn that changes the mood.`
          : genreNames.includes("horror") || genreNames.includes("thriller") || genreNames.includes("mystery")
            ? `The tension works best when it stays close to the characters. ${title} understands that an unanswered question can be more powerful than a loud answer.`
            : genreNames.includes("romance")
              ? `Its emotional pull comes from the pauses between the big moments—the glances, choices, and compromises that make a relationship feel lived in.`
              : genreNames.includes("documentary")
                ? `Its strongest quality is attention. The subject is given enough space to become more than a headline, while the viewer is trusted to make the final connection.`
                : `Its appeal is less about a single trick than the way its pieces settle together: character, atmosphere, and the question at the centre of the story.`,
        leadCast.length
          ? `The screen presence of ${listNames(leadCast)} gives the material a human centre.`
          : `The story carries its own centre of gravity, with the mood doing as much work as the plot.`,
      ],
    },
    {
      id: "the-craft",
      heading: "The craft around it",
      body: [
        director
          ? `${director.name}'s direction is the clearest creative through-line in the available credits, shaping how the ${subject} moves from setup to aftermath.`
          : `The available credits point to a collaborative piece of filmmaking, with the direction and ensemble working together rather than competing for attention.`,
        writers.length
          ? `The writing credits include ${listNames(writers.slice(0, 2))}, a useful reminder that the film's voice begins on the page before it reaches the screen.`
          : runtime
            ? `At ${runtime} minutes, it has enough room to establish its world without asking the viewer to wait for the story to begin.`
            : `Its catalog footprint leaves space for the viewer to discover the rhythm rather than arrive with every beat already explained.`,
      ],
    },
    {
      id: "before-you-watch",
      heading: "Before you watch",
      body: [
        year
          ? `${title} is a ${year} ${subject}${genrePhrase ? ` in the ${genrePhrase} space` : ""}. Go in looking for the details that match your mood, not a borrowed verdict.`
          : `For a first watch, start with the mood rather than a ranking. ${title} is best met on its own terms.`,
        runtime
          ? `The listed runtime is ${runtime} minutes${tagline ? `, and its tagline keeps the invitation simple: “${cleanText(tagline)}”` : ""}.`
          : tagline
            ? `Its tagline offers a small doorway into the tone: “${cleanText(tagline)}”`
            : `FILMIO's community rating and reviews are the best next stop if you want to compare your reaction with other viewers.`,
      ],
    },
  ];

  const sources: StorySource[] = [
    {
      name:
        catalogSource?.toLowerCase() === "tmdb"
          ? "TMDB"
          : catalogSource?.toLowerCase() === "omdb"
            ? "OMDb"
            : catalogSource && catalogSource !== "cache"
              ? catalogSource
              : "TMDB",
      url: `https://www.themoviedb.org/${mediaType === "tv" ? "tv" : "movie"}/${input.id}`,
      kind: "catalog",
      note: "Title, release, genre, runtime, and credit details.",
    },
  ];
  if (wikipedia) {
    sources.push({
      name: "Wikipedia",
      url: wikipedia.url,
      kind: "reference",
      note: "Background context checked for this title; FILMIO does not reproduce its article text.",
    });
  }
  if (imdbId) {
    sources.push({
      name: "IMDb",
      url: `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`,
      kind: "reference",
      note: "Independent title reference.",
    });
  }
  if (trailerUrl) {
    sources.push({
      name: "Official trailer",
      url: trailerUrl,
      kind: "official",
      note: "Official or studio-uploaded trailer listed in the catalog.",
    });
  }

  // A complete story needs both the catalog premise and the independent
  // reference check. Generic editorial language must never turn one missing
  // source into a falsely "ready" story.
  const status = wikipedia && overview ? "ready" : "partial";
  return {
    status,
    movie: {
      id: input.id,
      title,
      mediaType,
      releaseDate,
      posterPath: input.posterPath,
      backdropPath: input.backdropPath,
      overview,
      tagline,
      runtime,
      genres,
      imdbId,
    },
    headline: `${title}: a closer look before you press play`,
    dek: `${title} through a FILMIO lens—its premise, feeling, and the details that make this ${subject} worth finding.`,
    readTimeMinutes: 4,
    updatedAt: input.updatedAt,
    sections,
    sources: uniqueByUrl(sources),
  };
}

export async function getMovieStory(options: {
  id: number;
  mediaType: "movie" | "tv";
  fetchCatalog: (path: string, params?: Record<string, string | number>) => Promise<any>;
  fetchWikipedia?: (title: string) => Promise<{ extract: string; url: string } | null>;
  now?: () => number;
  storyTtlMs?: number;
  storyStaleTtlMs?: number;
}): Promise<MovieStory> {
  const key = `${options.mediaType}:${options.id}`;
  const getNow = options.now ?? Date.now;
  const now = getNow();
  const storyTtlMs = options.storyTtlMs ?? STORY_TTL_MS;
  const storyStaleTtlMs = options.storyStaleTtlMs ?? STORY_STALE_TTL_MS;
  const cached = storyCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  const existing = storyInFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const catalogResult = await options.fetchCatalog(`/${options.mediaType}/${options.id}`, {
      append_to_response: "credits,videos,external_ids",
    });
    const isMetadataResponse = (value: any): value is CatalogStoryResponse =>
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "data" in value &&
      ("source" in value || "fetchedAt" in value || "stale" in value);
    const metadata = isMetadataResponse(catalogResult) ? catalogResult : null;
    const data = metadata ? metadata.data : catalogResult;
    if (!data || data.success === false || !cleanText(data.title ?? data.name)) {
      throw new Error("Movie not found");
    }

    const title = cleanText(data.title ?? data.name);
    // If the catalog transport only has stale data, prefer the last complete
    // story over re-composing prose from a possibly incomplete outage payload.
    // This keeps status and attribution stable across retries.
    if (metadata?.stale && cached && cached.expiresAt + storyStaleTtlMs > now) {
      return cached.value;
    }
    const wikipedia = await (options.fetchWikipedia ?? fetchWikipediaContext)(title);
    const trailer = (data.videos?.results ?? []).find(
      (video: any) => video.site === "YouTube" && video.type === "Trailer" && video.key,
    ) ?? (data.videos?.results ?? []).find(
      (video: any) => video.site === "YouTube" && video.official && video.key,
    );
    const value = storyForMovie({
      id: options.id,
      title,
      mediaType: options.mediaType,
      releaseDate: cleanText(data.release_date ?? data.first_air_date),
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      overview: cleanText(data.overview),
      tagline: data.tagline ? cleanText(data.tagline) : null,
      runtime: Number(data.runtime ?? data.episode_run_time?.[0]) || null,
      genres: (data.genres ?? []).map((genre: any) => ({ id: Number(genre.id), name: cleanText(genre.name) })),
      imdbId: data.imdb_id ?? data.external_ids?.imdb_id ?? null,
      cast: (data.credits?.cast ?? []).map((member: any) => ({ name: cleanText(member.name), character: member.character })),
      crew: (data.credits?.crew ?? []).map((member: any) => ({ name: cleanText(member.name), job: cleanText(member.job) })),
      wikipedia,
      trailerUrl: trailer?.key ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}` : null,
      updatedAt: metadata?.fetchedAt ?? new Date().toISOString(),
      catalogSource: metadata?.source,
    });
    storyCache.set(key, { value, expiresAt: getNow() + storyTtlMs });
    while (storyCache.size > 128) {
      const oldest = storyCache.keys().next().value;
      if (oldest) storyCache.delete(oldest);
      else break;
    }
    return value;
  })();

  storyInFlight.set(key, request);
  try {
    return await request;
  } catch (error) {
    if (cached && cached.expiresAt + storyStaleTtlMs > now) return cached.value;
    throw error;
  } finally {
    storyInFlight.delete(key);
  }
}