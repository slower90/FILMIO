import { getAuthToken } from "@workspace/api-client-react";

export const DEFAULT_API_BASE_URL =
  "https://filmio-api-workers.py3912458.workers.dev";

const apiBaseUrl = (
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env
    ?.VITE_API_BASE_URL ?? ""
).replace(/\/$/, "");

function shouldUseConfiguredApiBase() {
  if (typeof window === "undefined" || !window.location) return true;
  return !/^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)$/.test(
    window.location.hostname,
  );
}

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base =
    shouldUseConfiguredApiBase() && (apiBaseUrl || typeof window !== "undefined")
      ? apiBaseUrl || DEFAULT_API_BASE_URL
      : "";
  return `${base}${path}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("authorization")) {
    const token = await getAuthToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}