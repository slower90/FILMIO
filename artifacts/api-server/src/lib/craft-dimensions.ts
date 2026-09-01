export const CRAFT_DIMENSIONS = [
  {
    key: "Story",
    positive: ["story", "script", "writing", "written", "plot", "narrative", "screenplay", "dialogue", "character"],
    negative: ["plot hole", "plot-hole", "predictable", "messy writing", "weak script", "bad writing", "confusing story"],
  },
  {
    key: "Direction",
    positive: ["direction", "directed", "director", "pacing", "paced", "framing", "blocking", "vision"],
    negative: ["poorly directed", "bad direction", "slow pacing", "bad pacing", "uneven pacing", "directionless"],
  },
  {
    key: "Acting",
    positive: ["acting", "acted", "performance", "performances", "cast", "chemistry", "portrayal", "actor"],
    negative: ["wooden acting", "bad acting", "weak performance", "overacting", "miscast", "poor cast"],
  },
  {
    key: "Emotion",
    positive: ["emotional", "emotion", "moving", "moved", "heartbreaking", "heartwarming", "felt", "tearjerker", "powerful"],
    negative: ["emotionless", "no emotion", "flat emotion", "didn't feel", "not moving", "detached"],
  },
  {
    key: "Visuals",
    positive: ["visuals", "cinematography", "cinematic", "visual", "beautiful shots", "stunning", "photography", "colour", "color"],
    negative: ["ugly visuals", "bad cinematography", "flat visuals", "poor effects", "cheap effects", "muddy visuals"],
  },
  {
    key: "Sound",
    positive: ["sound", "sound design", "score", "music", "soundtrack", "audio", "background score", "songs"],
    negative: ["bad sound", "poor sound", "weak score", "bad music", "muffled", "noisy audio"],
  },
  {
    key: "Originality",
    positive: ["original", "originality", "fresh", "unique", "inventive", "creative", "different", "innovative"],
    negative: ["derivative", "generic", "formulaic", "cliché", "cliche", "copied", "unoriginal", "predictable"],
  },
] as const;

export type CraftDimensionKey = (typeof CRAFT_DIMENSIONS)[number]["key"];

export type CraftTextEvidence = {
  text: string;
  rating?: number | null;
  weight?: number;
};

export type RedditDiscussion = {
  title: string;
  snippet: string;
  subreddit: string;
  score: number;
  comments: number;
  url: string;
};

export type CraftDimensionResult = {
  key: CraftDimensionKey;
  score: number | null;
  confidence: "overall" | "emerging" | "measured";
  evidenceCount: number;
};

type RedditSearchResult = {
  posts: RedditDiscussion[];
  status: "available" | "unavailable" | "not_found";
};

const REDDIT_CACHE_TTL_MS = 5 * 60 * 1000;
const redditCache = new Map<string, { expiresAt: number; result: RedditSearchResult }>();

function clamp(value: number, minimum = 0, maximum = 10) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedText(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function countMentions(text: string, terms: readonly string[]) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function sentimentForDimension(text: string, dimension: (typeof CRAFT_DIMENSIONS)[number]) {
  const normalized = normalizedText(text);
  const positiveMentions = countMentions(normalized, dimension.positive);
  const negativeMentions = countMentions(normalized, dimension.negative);
  const totalMentions = positiveMentions + negativeMentions;
  if (totalMentions === 0) return null;
  return {
    signal: (positiveMentions - negativeMentions) / totalMentions,
    mentions: totalMentions,
  };
}

function scoreFromSentiment(baseScore: number, sentiment: number) {
  return clamp(baseScore + sentiment * 1.8, 1, 10);
}

function safeRating(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 10
    ? value
    : null;
}

export function calculateFilmioAutoScore({
  baselineScore,
  averageRating,
  totalRatings,
}: {
  baselineScore?: number | null;
  averageRating?: number | null;
  totalRatings: number;
}) {
  const baseline = typeof baselineScore === "number" && Number.isFinite(baselineScore)
    ? clamp(baselineScore)
    : 0;
  const filmioAverage = typeof averageRating === "number" && Number.isFinite(averageRating)
    ? clamp(averageRating)
    : 0;
  if (totalRatings > 0 && filmioAverage > 0 && baseline > 0) {
    return Number(((baseline + filmioAverage) / 2).toFixed(1));
  }
  if (totalRatings > 0 && filmioAverage > 0) return Number(filmioAverage.toFixed(1));
  return Number(baseline.toFixed(1));
}

export function calculateCraftDimensions({
  overallScore,
  filmioRatings,
  filmioReviews,
  redditPosts,
}: {
  overallScore: number;
  filmioRatings: { averageRating: number; totalRatings: number };
  filmioReviews: CraftTextEvidence[];
  redditPosts: RedditDiscussion[];
}): CraftDimensionResult[] {
  // A neutral prior keeps text-only Reddit signals from starting at 1.0 when
  // a title has no FILMIO/TMDB score yet. It is only used as a calculation
  // prior, never shown as an audience rating.
  const baseScore = clamp(overallScore > 0 ? overallScore : 5.5, 1, 10);
  return CRAFT_DIMENSIONS.map((dimension) => {
    let weightedSignal = 0;
    let totalWeight = 0;
    let evidenceCount = 0;

    for (const review of filmioReviews) {
      const evidence = sentimentForDimension(review.text, dimension);
      if (!evidence) continue;
      const rating = safeRating(review.rating);
      const ratingSignal = rating === null ? 0 : (rating - 5.5) / 4.5;
      const weight = Math.max(0.5, review.weight ?? 1) * (rating === null ? 0.8 : 1);
      weightedSignal += (evidence.signal * 0.7 + ratingSignal * 0.3) * weight;
      totalWeight += weight;
      evidenceCount += evidence.mentions;
    }

    for (const post of redditPosts) {
      const evidence = sentimentForDimension(`${post.title} ${post.snippet}`, dimension);
      if (!evidence) continue;
      const discussionWeight = Math.max(0.5, Math.min(2, Math.log10(post.score + post.comments + 10)));
      weightedSignal += evidence.signal * discussionWeight;
      totalWeight += discussionWeight;
      evidenceCount += evidence.mentions;
    }

    if (totalWeight > 0) {
      return {
        key: dimension.key,
        score: Number(scoreFromSentiment(baseScore, weightedSignal / totalWeight).toFixed(1)),
        confidence: totalWeight >= 3 ? "measured" : "emerging",
        evidenceCount,
      };
    }

    if (filmioRatings.totalRatings > 0 && filmioRatings.averageRating > 0) {
      return {
        key: dimension.key,
        score: Number(baseScore.toFixed(1)),
        confidence: "overall",
        evidenceCount: filmioRatings.totalRatings,
      };
    }

    return {
      key: dimension.key,
      score: null,
      confidence: "emerging",
      evidenceCount: 0,
    };
  });
}

function redditSearchUrl(title: string) {
  const query = encodeURIComponent(`"${title}" review`);
  return `https://www.reddit.com/search.json?q=${query}&sort=relevance&t=all&limit=25`;
}

export async function searchRedditDiscussions(title: string): Promise<RedditSearchResult> {
  const cacheKey = normalizedText(title);
  const cached = redditCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(redditSearchUrl(title), {
      headers: {
        Accept: "application/json",
        "User-Agent": "FILMIO/1.0 public movie signal",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const result = { posts: [], status: "unavailable" as const };
      redditCache.set(cacheKey, { expiresAt: Date.now() + REDDIT_CACHE_TTL_MS, result });
      return result;
    }

    const payload = await response.json() as {
      data?: {
        children?: Array<{
          data?: {
            title?: string;
            selftext?: string;
            subreddit_name_prefixed?: string;
            score?: number;
            num_comments?: number;
            permalink?: string;
            is_self?: boolean;
          };
        }>;
      };
    };
    const posts = (payload.data?.children ?? [])
      .map((child) => child.data)
      .filter((post): post is NonNullable<typeof post> => Boolean(post?.title && post.permalink))
      .map((post) => ({
        title: post.title!,
        snippet: (post.selftext || "").replace(/\s+/g, " ").trim().slice(0, 220),
        subreddit: post.subreddit_name_prefixed || "Reddit",
        score: Number(post.score) || 0,
        comments: Number(post.num_comments) || 0,
        url: `https://www.reddit.com${post.permalink}`,
      }))
      .filter((post) => post.snippet || post.title)
      .slice(0, 5);
    const result = { posts, status: posts.length ? "available" as const : "not_found" as const };
    redditCache.set(cacheKey, { expiresAt: Date.now() + REDDIT_CACHE_TTL_MS, result });
    return result;
  } catch {
    const result = { posts: [], status: "unavailable" as const };
    redditCache.set(cacheKey, { expiresAt: Date.now() + 60_000, result });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}