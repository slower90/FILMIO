export function withMovieTitle(href: string, title: string): string {
  if (!href.startsWith("/movies/") || !title.trim()) return href;
  const [path, query = ""] = href.split("?", 2);
  const params = new URLSearchParams(query);
  const slug = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const moviePath = slug ? `${path.replace(/\/+$/, "")}/${slug}` : path;
  const queryString = params.toString();
  return queryString ? `${moviePath}?${queryString}` : moviePath;
}