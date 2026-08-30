import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";

const SITE_NAME = "FILMIO";
export const SITE_URL = "https://vishnuva.in";
const DEFAULT_TITLE = "FILMIO | Discover, Rate & Review Movies Across India";
const DEFAULT_DESCRIPTION =
  "Discover Indian and global movies, TV shows, and anime on FILMIO. Compare ratings, read reviews, explore cast, watch trailers, and find where to watch in India.";

const routeMetadata: Record<string, { title: string; description: string }> = {
  "/discover": {
    title: "Discover Movies & TV Shows in India | FILMIO",
    description: "Explore trending movies, Indian cinema, TV shows, and hidden gems with FILMIO ratings, reviews, trailers, and watch options.",
  },
  "/anime": {
    title: "Best Anime to Watch & Review | FILMIO",
    description: "Find anime worth watching, explore genres and new releases, and read ratings and reviews from the FILMIO community.",
  },
  "/search": {
    title: "Search Movies, TV & Anime | FILMIO",
    description: "Search movies, TV shows, and anime to find details, trailers, ratings, reviews, cast, and where to watch in India.",
  },
  "/actors": {
    title: "Actors, Cast & Filmographies | FILMIO",
    description: "Explore actors, cast members, filmographies, and memorable performances across Indian and global movies and TV.",
  },
  "/genres": {
    title: "Movie Genres, Ratings & Reviews | FILMIO",
    description: "Browse movies and anime by genre, discover stories that match your mood, and compare FILMIO community ratings and reviews.",
  },
  "/news": {
    title: "Film & Entertainment News | FILMIO",
    description: "Keep up with film, TV, anime, and entertainment news for curious viewers and serious movie fans in India and worldwide.",
  },
  "/signals": {
    title: "Personal Signals | FILMIO",
    description: "A quiet personal radar for the movie moments worth seeing on FILMIO.",
  },
  "/free-movies": {
    title: "Free Movies to Watch in India | FILMIO",
    description: "Discover legitimate free and ad-supported movies available through official providers, with ratings and reviews from FILMIO.",
  },
  "/free-classics": {
    title: "Free Classics: Public Domain Films | FILMIO",
    description: "Watch enduring public-domain films legally and for free through the Internet Archive screening room on FILMIO.",
  },
  "/pricing": {
    title: "FILMIO Membership | Film Community",
    description: "See FILMIO membership options for deeper film discovery, reviews, and connections with the movie community.",
  },
  "/privacy": {
    title: "Privacy Policy | FILMIO",
    description: "Read how FILMIO collects, uses, protects, and lets you control personal information across movie discovery, reviews, profiles, and messaging.",
  },
  "/terms": {
    title: "Conditions of Use | FILMIO",
    description: "Read the rules for using FILMIO movie discovery, ratings, reviews, profiles, messaging, and community features.",
  },
};

function normalizedPath(path: string) {
  const withoutQuery = path.split("?")[0].replace(/\/+$/, "");
  return withoutQuery || "/";
}

function descriptionForPath(path: string) {
  const exact = routeMetadata[path];
  if (exact) return exact;
  if (path.startsWith("/genre/")) {
    return {
      title: "Movies by Genre: Ratings & Reviews | FILMIO",
      description: "Browse movies by genre, find new favorites, and read FILMIO ratings and reviews for your next watch.",
    };
  }
  if (path.startsWith("/movies/")) {
    return {
      title: "Movie Ratings, Reviews & Where to Watch | FILMIO",
      description: "Read movie details, FILMIO ratings and reviews, trailers, cast information, and official viewing options in India.",
    };
  }
  if (path.startsWith("/blog/movies/")) {
    return {
      title: "Movie Journal & Source-Backed Stories | FILMIO",
      description: "Read thoughtful, source-backed movie and TV stories from the FILMIO Journal before you press play.",
    };
  }
  if (path.startsWith("/actors/")) {
    return {
      title: "Actor Profile, Movies & Filmography | FILMIO",
      description: "Explore an actor's movies, filmography, notable performances, and cast credits on FILMIO.",
    };
  }
  if (path.startsWith("/professionals/")) {
    return {
      title: "Film Professional Profile | FILMIO",
      description: "Discover film industry professionals and their work on FILMIO.",
    };
  }
  return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
}

export function SiteSeo() {
  const [location] = useLocation();
  const path = normalizedPath(location);
  const { title, description } = descriptionForPath(path);
  const canonicalUrl = new URL(path, SITE_URL).toString();
  const imageUrl = `${SITE_URL}/logo.svg`;
  const isPrivateRoute =
    ["/search", "/watchlist", "/feed", "/chat", "/signals", "/professionals", "/profile"].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    ) || path.startsWith("/sign-in") || path.startsWith("/sign-up");

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="author" content="FILMIO" />
      <meta name="theme-color" content="#0a0a0f" />
      <meta name="robots" content={isPrivateRoute ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" hrefLang="en-IN" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:locale:alternate" content="hi_IN" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={`${SITE_NAME} movie discovery and review platform`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={`${SITE_NAME} movie discovery and review platform`} />
      {path === "/" && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: SITE_NAME,
                url: SITE_URL,
                logo: `${SITE_URL}/logo.svg`,
              },
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                name: SITE_NAME,
                url: SITE_URL,
                description: DEFAULT_DESCRIPTION,
                inLanguage: "en-IN",
                publisher: { "@id": `${SITE_URL}/#organization` },
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${SITE_URL}/search?q={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "WebApplication",
                name: SITE_NAME,
                description: DEFAULT_DESCRIPTION,
                url: SITE_URL,
                applicationCategory: "EntertainmentApplication",
                operatingSystem: "Web",
                inLanguage: "en-IN",
                publisher: { "@id": `${SITE_URL}/#organization` },
              },
            ],
          })}
        </script>
      )}
    </Helmet>
  );
}