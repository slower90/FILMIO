import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tmdbPosterUrl(path?: string | null) {
  if (!path) return "https://via.placeholder.com/500x750/111111/444444?text=NO+POSTER";
  return `https://image.tmdb.org/t/p/w500${path}`;
}

export function tmdbBackdropUrl(path?: string | null) {
  if (!path) return "https://via.placeholder.com/1280x720/111111/444444?text=NO+BACKDROP";
  return `https://image.tmdb.org/t/p/original${path}`;
}

export function tmdbLogoUrl(path?: string | null) {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/w92${path}`;
}
