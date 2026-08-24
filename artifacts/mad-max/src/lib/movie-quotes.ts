export interface MovieLoadingQuote {
  text: string;
  source: string;
}

const FEATURED_QUOTES: Array<{ titles: string[]; quote: MovieLoadingQuote }> = [
  { titles: ["3 idiots"], quote: { text: "All is well.", source: "3 Idiots" } },
  { titles: ["sholay"], quote: { text: "Kitne aadmi the?", source: "Sholay" } },
  { titles: ["the godfather"], quote: { text: "I'm gonna make him an offer he can't refuse.", source: "The Godfather" } },
  { titles: ["the dark knight"], quote: { text: "Why so serious?", source: "The Dark Knight" } },
  { titles: ["the lord of the rings: the fellowship of the ring", "the lord of the rings"], quote: { text: "One does not simply walk into Mordor.", source: "The Lord of the Rings" } },
  { titles: ["star wars"], quote: { text: "May the Force be with you.", source: "Star Wars" } },
  { titles: ["forrest gump"], quote: { text: "Life is like a box of chocolates.", source: "Forrest Gump" } },
  { titles: ["rocky"], quote: { text: "It ain't about how hard you hit.", source: "Rocky" } },
  { titles: ["pulp fiction"], quote: { text: "Say 'what' again. I dare you.", source: "Pulp Fiction" } },
  { titles: ["the matrix"], quote: { text: "There is no spoon.", source: "The Matrix" } },
];

const FALLBACK_QUOTES: MovieLoadingQuote[] = [
  { text: "Every great story is worth the wait.", source: "FILMIO" },
  { text: "The best stories stay with you forever.", source: "FILMIO" },
  { text: "The reel is turning. Your next story is almost here.", source: "FILMIO" },
];

export function getMovieLoadingQuote(title?: string): MovieLoadingQuote {
  const normalizedTitle = title?.trim().toLowerCase();
  const match = FEATURED_QUOTES.find(({ titles }) =>
    titles.some((candidate) => normalizedTitle?.includes(candidate)),
  );

  if (match) return match.quote;
  const fallbackIndex = normalizedTitle
    ? [...normalizedTitle].reduce((sum, character) => sum + character.charCodeAt(0), 0) % FALLBACK_QUOTES.length
    : 0;
  return FALLBACK_QUOTES[fallbackIndex];
}