import type { RowMovie } from "@/components/movie-row";

const STORAGE_KEY = "mad-max-recently-viewed";
const MAX_ITEMS = 12;
const HISTORY_EVENT = "mad-max-history-change";

function storageKey(profileId?: number) {
  return profileId ? `${STORAGE_KEY}:${profileId}` : STORAGE_KEY;
}

export function readRecentlyViewed(profileId?: number): RowMovie[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(profileId)) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(movie: RowMovie, profileId?: number) {
  if (typeof window === "undefined") return;
  const next = [
    movie,
    ...readRecentlyViewed(profileId).filter((item) => item.id !== movie.id),
  ].slice(0, MAX_ITEMS);
  localStorage.setItem(storageKey(profileId), JSON.stringify(next));
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
  profileId?: number,
): Promise<RowMovie[] | null> {
  const params = profileId ? `?profileId=${profileId}` : "";
  const response = await fetch(`/api/users/me/viewing-history${params}`, {
    method,
    credentials: "include",
    headers: movies ? { "Content-Type": "application/json" } : undefined,
    body: movies ? JSON.stringify({ movies: movies.map(normalizeMovie) }) : undefined,
  });
  if (response.status === 204) return [];
  if (!response.ok) return null;
  return (await response.json()) as RowMovie[];
}

export async function loadRecentlyViewed(isSignedIn: boolean, profileId?: number): Promise<RowMovie[]> {
  if (!isSignedIn) return readRecentlyViewed(profileId);

  const localMovies = readRecentlyViewed();
  const synced = await requestHistory("POST", localMovies, profileId);
  if (synced === null) return [];
  if (localMovies.length > 0) localStorage.removeItem(storageKey(profileId));
  return synced;
}

export async function recordRecentlyViewedForUser(
  movie: RowMovie,
  isSignedIn: boolean,
  profileId?: number,
): Promise<void> {
  if (!isSignedIn) {
    recordRecentlyViewed(movie, profileId);
    return;
  }
  await requestHistory("POST", [movie], profileId);
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

export async function clearRecentlyViewed(isSignedIn: boolean, profileId?: number): Promise<boolean> {
  if (!isSignedIn) {
    localStorage.removeItem(storageKey(profileId));
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
    return true;
  }
  const result = await requestHistory("DELETE", undefined, profileId);
  if (result === null) return false;
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
  return true;
}

export { HISTORY_EVENT };