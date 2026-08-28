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

export type MovieStoryTopic = {
  label: string;
  href: string;
  kind: "person" | "genre" | "country";
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
  topics: MovieStoryTopic[];
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
  const normalized = cleanText(value);
  const sentence = normalized.match(/^(.{40,420}?[.!?])(?:\s|$)/)?.[1];
  if (sentence) return sentence;
  return normalized.slice(0, 320).replace(/\s+\S*$/, "").replace(/[,:;]$/, "");
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
  const extract = cleanText(summary?.extract ?? "").slice(0, 1800);
  if (!extract) return null;
  const url =
    summary?.content_urls?.desktop?.page ??
    `https://en.wikipedia.org/wiki/${encodeURIComponent(candidate.replace(/ /g, "_"))}`;
  return { extract, url };
}

const splitSentences = (value: string): string[] =>
  cleanText(value)
    .match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];

const moneyInUsd = (value: number | null | undefined): string | null => {
  if (!value || value <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

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
  cast: Array<{ id: number; name: string; character?: string }>;
  crew: Array<{ id: number; name: string; job: string }>;
  productionCompanies: string[];
  productionCountries: string[];
  originalLanguage: string | null;
  budget: number | null;
  revenue: number | null;
  catalogStatus: string;
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
    productionCompanies,
    productionCountries,
    originalLanguage,
    budget,
    revenue,
    catalogStatus,
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
  const wikipediaSentences = splitSentences(wikipedia?.extract ?? "");
  const producerNames = crew
    .filter((member) => /producer/i.test(member.job))
    .map((member) => cleanText(member.name))
    .filter(Boolean);
  const historyNotes = wikipediaSentences
    .filter((sentence) =>
      /\b(released|premiered|festival|adapted|based on|filmed|production|award|nominated|box office|sequel|remake|debut|acclaim|censorship|controvers)\b/i.test(sentence),
    )
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 4);
  const productionFacts = [
    productionCompanies.length
      ? `The catalog credits ${listNames(productionCompanies.slice(0, 3))}${productionCompanies.length > 3 ? " and others" : ""} as production ${productionCompanies.length === 1 ? "company" : "companies"}.`
      : "",
    productionCountries.length ? `Its listed production footprint includes ${listNames(productionCountries.slice(0, 3))}.` : "",
    originalLanguage ? `The recorded original language is ${originalLanguage.toUpperCase()}.` : "",
    runtime ? `The listed runtime is ${runtime} minutes.` : "",
    moneyInUsd(budget) ? `The catalog reports a production budget of ${moneyInUsd(budget)}.` : "",
    moneyInUsd(revenue) ? `The catalog reports worldwide revenue of ${moneyInUsd(revenue)}.` : "",
  ].filter(Boolean);

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
  ];

  if (director || writers.length || producerNames.length || leadCast.length) {
    sections.push({
      id: "the-people",
      heading: "The people who shaped it",
      body: [
        director
          ? `${director.name} is credited as director, the clearest creative through-line in the available record.`
          : "The available record does not name a director, so FILMIO leaves that credit open rather than guessing.",
        writers.length ? `Writing credits include ${listNames(writers.slice(0, 3))}.` : "",
        producerNames.length ? `Producer credits include ${listNames(producerNames.slice(0, 3))}.` : "",
        leadCast.length ? `The leading cast record includes ${listNames(leadCast)}.` : "",
        "Open a credited person below to follow their work beyond this one title.",
      ].filter(Boolean),
    });
  }

  if (productionFacts.length) {
    sections.push({
      id: "the-making",
      heading: "The making and release record",
      body: [
        `${title}'s catalog record gives us a concrete trail around the screen story—not just a synopsis.`,
        ...productionFacts,
        year ? `The title is dated to ${year}${catalogStatus ? ` and its recorded status is “${catalogStatus}”` : ""}.` : "",
      ].filter(Boolean),
    });
  }

  if (historyNotes.length) {
    sections.push({
      id: "the-history",
      heading: "What happened around it",
      body: [
        "The linked reference preserves a little of the title's life beyond its plot:",
        ...historyNotes,
        "These notes are included because they are documented in the linked reference—not because FILMIO is filling in a gap with rumor.",
      ],
    });
  }

  sections.push({
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
  });

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

  const peopleTopics = [...(director ? [director] : []), ...crew.filter((member) => /writer|screenplay|producer/i.test(member.job)), ...cast.slice(0, 4)]
    .filter((member) => member.id > 0 && member.name)
    .map((member) => ({
      label: cleanText(member.name),
      href: `/actors/${member.id}`,
      kind: "person" as const,
    }));
  const rawTopics: MovieStoryTopic[] = [
    ...peopleTopics.slice(0, 8),
    ...genres.slice(0, 4).map((genre) => ({ label: genre.name, href: `/genre/${genre.id}`, kind: "genre" as const })),
    ...productionCountries.slice(0, 3).map((country) => ({
      label: country,
      href: `/search?q=${encodeURIComponent(country)}`,
      kind: "country" as const,
    })),
  ];
  const topics = rawTopics
    .filter((topic, index, all) => topic.label && all.findIndex((candidate) => candidate.label.toLowerCase() === topic.label.toLowerCase()) === index)
    .slice(0, 14);

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
    headline: historyNotes.length
      ? `${title}: the people, moments, and history behind the screen`
      : `${title}: the people and craft behind the screen`,
    dek: `${title} through a FILMIO Journal lens—its premise, collaborators, ${historyNotes.length ? "documented history, and " : ""}the details worth following before you press play.`,
    readTimeMinutes: Math.min(8, Math.max(4, Math.ceil(sections.length * 1.2))),
    updatedAt: input.updatedAt,
    sections,
    sources: uniqueByUrl(sources),
    topics,
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
      cast: (data.credits?.cast ?? []).map((member: any) => ({
        id: Number(member.id),
        name: cleanText(member.name),
        character: member.character,
      })),
      crew: (data.credits?.crew ?? []).map((member: any) => ({
        id: Number(member.id),
        name: cleanText(member.name),
        job: cleanText(member.job),
      })),
      productionCompanies: (data.production_companies ?? [])
        .map((company: any) => cleanText(company.name))
        .filter(Boolean),
      productionCountries: (data.production_countries ?? [])
        .map((country: any) => cleanText(country.name))
        .filter(Boolean),
      originalLanguage: data.original_language ? cleanText(data.original_language) : null,
      budget: Number(data.budget) || null,
      revenue: Number(data.revenue) || null,
      catalogStatus: cleanText(data.status),
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