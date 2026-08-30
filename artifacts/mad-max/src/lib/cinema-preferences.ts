import type { FavoritePerson, ViewingProfile } from "@workspace/api-client-react";

export const CINEMA_PREFERENCE_FIELDS = [
  { key: "favoriteActor", label: "Favorite actor", placeholder: "Choose or type an actor" },
  { key: "favoriteDirector", label: "Favorite director", placeholder: "Choose or type a director" },
  { key: "favoriteGenre", label: "Favorite genre", placeholder: "Choose or type a genre" },
  { key: "favoriteCountry", label: "Favorite country", placeholder: "Choose or type a country" },
  { key: "favoriteDecade", label: "Favorite decade", placeholder: "Choose or type a decade" },
  { key: "favoriteLanguage", label: "Favorite language", placeholder: "Choose or type a language" },
] as const;

export type CinemaPreferenceKey = (typeof CINEMA_PREFERENCE_FIELDS)[number]["key"];
export type CinemaPreferences = Pick<ViewingProfile, CinemaPreferenceKey> & {
  favoriteActors?: FavoritePerson[];
  favoriteDirectors?: FavoritePerson[];
};
export type CinemaPreferenceOptions = Record<CinemaPreferenceKey, string[]>;

export type CinemaPreferenceMovieOverview = {
  movie?: {
    releaseDate: string;
    genres: Array<{ name: string }>;
    originalLanguage?: string | null;
    productionCountries?: string[];
  };
  credits?: {
    cast: Array<{ name: string }>;
    crew: Array<{ name: string; job: string }>;
  };
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  bn: "Bengali",
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ml: "Malayalam",
  mr: "Marathi",
  pt: "Portuguese",
  ru: "Russian",
  ta: "Tamil",
  te: "Telugu",
  zh: "Mandarin",
};

function ranked(values: Map<string, number>, limit = 24) {
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function addValue(bucket: Map<string, number>, value?: string | null) {
  const normalized = value?.trim();
  if (normalized) bucket.set(normalized, (bucket.get(normalized) || 0) + 1);
}

export function collectCinemaPreferenceOptions(overviews: Array<CinemaPreferenceMovieOverview | undefined>): CinemaPreferenceOptions {
  const buckets: Record<CinemaPreferenceKey, Map<string, number>> = {
    favoriteActor: new Map(),
    favoriteDirector: new Map(),
    favoriteGenre: new Map(),
    favoriteCountry: new Map(),
    favoriteDecade: new Map(),
    favoriteLanguage: new Map(),
  };

  overviews.forEach((overview) => {
    if (!overview?.movie) return;
    overview.credits?.cast.slice(0, 8).forEach((person) => addValue(buckets.favoriteActor, person.name));
    overview.credits?.crew
      .filter((person) => person.job === "Director")
      .slice(0, 3)
      .forEach((person) => addValue(buckets.favoriteDirector, person.name));
    overview.movie.genres.forEach((genre) => addValue(buckets.favoriteGenre, genre.name));
    overview.movie.productionCountries?.forEach((country) => addValue(buckets.favoriteCountry, country));

    const year = Number(overview.movie.releaseDate?.slice(0, 4));
    if (Number.isInteger(year) && year > 1800) addValue(buckets.favoriteDecade, `${Math.floor(year / 10) * 10}s`);

    const language = overview.movie.originalLanguage?.toLowerCase();
    addValue(buckets.favoriteLanguage, language ? LANGUAGE_NAMES[language] || language.toUpperCase() : null);
  });

  return {
    favoriteActor: ranked(buckets.favoriteActor),
    favoriteDirector: ranked(buckets.favoriteDirector),
    favoriteGenre: ranked(buckets.favoriteGenre),
    favoriteCountry: ranked(buckets.favoriteCountry),
    favoriteDecade: ranked(buckets.favoriteDecade),
    favoriteLanguage: ranked(buckets.favoriteLanguage),
  };
}

export function preferenceLabel(key: CinemaPreferenceKey) {
  return CINEMA_PREFERENCE_FIELDS.find((field) => field.key === key)?.label || key;
}