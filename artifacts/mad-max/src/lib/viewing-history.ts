import type { RowMovie } from "@/components/movie-row";

const STORAGE_KEY = "mad-max-recently-viewed";
const MAX_ITEMS = 12;
const HISTORY_EVENT = "mad-max-history-change";

export function readRecentlyViewed(): RowMovie[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(movie: RowMovie) {
  if (typeof window === "undefined") return;
  const next = [
    movie,
    ...readRecentlyViewed().filter((item) => item.id !== movie.id),
  ].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

function normalizeMovie(movie: RowMovie): RowMovie {
  return {
    id: movie.id,
    title: movie.title,
    posterPath: movie.posterPath ?? null,
    releaseDate: movie.releaseDate ?? null,
  };
}

async function requestHistory(
  method: "GET" | "POST" | "DELETE",
  movies?: RowMovie[],
): Promise<RowMovie[] | null> {
  const response = await fetch("/api/users/me/viewing-history", {
    method,
    credentials: "include",
    headers: movies ? { "Content-Type": "application/json" } : undefined,
    body: movies ? JSON.stringify({ movies: movies.map(normalizeMovie) }) : undefined,
  });
  if (response.status === 204) return [];
  if (!response.ok) return null;
  return (await response.json()) as RowMovie[];
}

export async function loadRecentlyViewed(isSignedIn: boolean): Promise<RowMovie[]> {
  if (!isSignedIn) return readRecentlyViewed();

  const localMovies = readRecentlyViewed();
  const synced = await requestHistory("POST", localMovies);
  if (synced === null) return [];
  if (localMovies.length > 0) localStorage.removeItem(STORAGE_KEY);
  return synced;
}

export async function recordRecentlyViewedForUser(
  movie: RowMovie,
  isSignedIn: boolean,
): Promise<void> {
  if (!isSignedIn) {
    recordRecentlyViewed(movie);
    return;
  }
  await requestHistory("POST", [movie]);
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

export async function clearRecentlyViewed(isSignedIn: boolean): Promise<boolean> {
  if (!isSignedIn) {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
    return true;
  }
  const result = await requestHistory("DELETE");
  if (result === null) return false;
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
  return true;
}

export { HISTORY_EVENT };