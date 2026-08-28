import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TmdbPosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780";
type TmdbBackdropSize = "w300" | "w780" | "w1280" | "original";

export function tmdbPosterUrl(path?: string | null, size: TmdbPosterSize = "w342") {
  if (!path) return "https://via.placeholder.com/500x750/111111/444444?text=NO+POSTER";
  // Full URLs (e.g. AniList/Jikan poster CDNs) — pass through unchanged
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function tmdbBackdropUrl(path?: string | null, size: TmdbBackdropSize = "w1280") {
  if (!path) return "https://via.placeholder.com/1280x720/111111/444444?text=NO+BACKDROP";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function tmdbBackdropSrcSet(path?: string | null) {
  if (!path || path.startsWith("http://") || path.startsWith("https://")) return undefined;
  return `${tmdbBackdropUrl(path, "w780")} 780w, ${tmdbBackdropUrl(path, "w1280")} 1280w`;
}

export function tmdbLogoUrl(path?: string | null) {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/w92${path}`;
}
