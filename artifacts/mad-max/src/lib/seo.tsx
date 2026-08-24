import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";

const SITE_NAME = "FILMIO";
const DEFAULT_TITLE = "FILMIO | Discover, Rate & Review Movies and Anime";
const DEFAULT_DESCRIPTION =
  "Discover movies and anime, rate what you watch, and write reviews that help serious film lovers find their next great story.";

const routeMetadata: Record<string, { title: string; description: string }> = {
  "/discover": {
    title: "Discover Movies & TV Shows | FILMIO",
    description: "Explore trending movies, TV shows, and hidden gems selected for serious film lovers on FILMIO.",
  },
  "/anime": {
    title: "Discover Anime & Reviews | FILMIO",
    description: "Find anime worth watching, explore genres, and share thoughtful ratings and reviews with the FILMIO community.",
  },
  "/search": {
    title: "Search Movies, TV & Anime | FILMIO",
    description: "Search movies, TV shows, and anime to find details, trailers, ratings, reviews, and where to watch.",
  },
  "/actors": {
    title: "Actors & Film Credits | FILMIO",
    description: "Explore actors, filmographies, and memorable performances across movies and TV on FILMIO.",
  },
  "/genres": {
    title: "Browse Movie & Anime Genres | FILMIO",
    description: "Browse movies and anime by genre to find stories that match your mood and taste.",
  },
  "/news": {
    title: "Film & Entertainment News | FILMIO",
    description: "Keep up with film, TV, anime, and entertainment news for curious viewers and serious movie fans.",
  },
  "/free-movies": {
    title: "Free & Ad-Supported Movies | FILMIO",
    description: "Discover legitimate no-cost and ad-supported movies available to watch through official providers.",
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
      title: "Browse Movies by Genre | FILMIO",
      description: "Find movies and anime by genre, explore new favorites, and read reviews from the FILMIO community.",
    };
  }
  if (path.startsWith("/movies/")) {
    return {
      title: "Movie Details, Ratings & Reviews | FILMIO",
      description: "Read movie details, ratings, reviews, trailers, cast information, and official viewing options on FILMIO.",
    };
  }
  if (path.startsWith("/actors/")) {
    return {
      title: "Actor Profile & Filmography | FILMIO",
      description: "Explore an actor's filmography, notable performances, and movie credits on FILMIO.",
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
  const canonicalUrl = new URL(path, window.location.origin).toString();
  const imageUrl = new URL(`${import.meta.env.BASE_URL}logo.svg`, window.location.origin).toString();
  const isPrivateRoute =
    ["/watchlist", "/feed", "/chat", "/professionals", "/profile"].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    ) || path.startsWith("/sign-in") || path.startsWith("/sign-up");

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={isPrivateRoute ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      {path === "/" && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: SITE_NAME,
            description: DEFAULT_DESCRIPTION,
            url: canonicalUrl,
            applicationCategory: "EntertainmentApplication",
            operatingSystem: "Web",
          })}
        </script>
      )}
    </Helmet>
  );
}