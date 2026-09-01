import type { CSSProperties, ReactNode } from "react";
import { BarChart3, CircleHelp, ExternalLink, MessageCircle, RefreshCw, Sparkles, Users } from "lucide-react";
import type { CraftDimensionsResponse } from "@/lib/craft-dimensions";

export type FingerprintStats = {
  totalRatings: number;
  totalReviews?: number;
  ratingDistribution?: Array<{ score: number; count: number }>;
};

type DimensionKey =
  | "Story"
  | "Direction"
  | "Acting"
  | "Emotion"
  | "Visuals"
  | "Sound"
  | "Originality";

const DIMENSIONS: DimensionKey[] = [
  "Story",
  "Direction",
  "Acting",
  "Emotion",
  "Visuals",
  "Sound",
  "Originality",
];

function distributionValues(stats?: FingerprintStats) {
  const distribution = new Map(
    (stats?.ratingDistribution ?? []).map((entry) => [entry.score, entry.count]),
  );
  const maxBucket = Math.max(...Array.from(distribution.values()), 0);
  if (!stats?.totalRatings || !maxBucket) return [];

  // The contour is a compact reading of the real 1–10 audience distribution.
  // It is intentionally not presented as seven invented craft scores.
  return DIMENSIONS.map((_, index) => {
    const left = distribution.get(Math.max(1, index + 2)) ?? 0;
    const center = distribution.get(index + 3) ?? 0;
    const right = distribution.get(Math.min(10, index + 4)) ?? 0;
    return Math.max(0.18, Math.min(1, (left + center * 1.5 + right) / (maxBucket * 3.5)));
  });
}

function polarPoint(index: number, value: number, radius = 90, center = 110) {
  const angle = (Math.PI * 2 * index) / DIMENSIONS.length - Math.PI / 2;
  const distance = radius * value;
  return [
    center + Math.cos(angle) * distance,
    center + Math.sin(angle) * distance,
  ] as const;
}

function pointsFor(values: number[], radius?: number) {
  return values
    .map((value, index) => polarPoint(index, value, radius))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

function ScoreRing({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(10, score));
  const circumference = 2 * Math.PI * 43;
  const offset = circumference - (safeScore / 10) * circumference;
  const hasScore = safeScore > 0;
  return (
    <div className="movie-score-ring" aria-label={hasScore ? `FILMIO score ${safeScore.toFixed(1)} out of 10` : "FILMIO score not available yet"}>
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <circle className="movie-score-ring-track" cx="50" cy="50" r="43" />
        <circle
          className={`movie-score-ring-value ${!hasScore ? "movie-score-ring-value--empty" : ""}`}
          cx="50"
          cy="50"
          r="43"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={`movie-score-ring-number ${!hasScore ? "movie-score-ring-number--empty" : ""}`}>
        {hasScore ? safeScore.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function DNAChip({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="movie-score-dna-chip">
      {icon}
      {children}
    </span>
  );
}

function audienceDNA(stats?: FingerprintStats) {
  const total = stats?.totalRatings ?? 0;
  if (total <= 0) return ["Awaiting audience signal"];

  const distribution = stats?.ratingDistribution ?? [];
  const peak = Math.max(...distribution.map((entry) => entry.count), 0);
  const peakShare = peak / total;
  const activeBuckets = distribution.filter((entry) => entry.count > 0).length;
  const labels = [`${total.toLocaleString("en-IN")} audience voices`];
  if (peakShare >= 0.55) labels.push("High consensus");
  else if (activeBuckets >= 5) labels.push("Mixed reactions");
  else labels.push("Early signal");
  if ((stats?.totalReviews ?? 0) > 0) labels.push("Written conversation");
  return labels;
}

export function MovieScoreFingerprint({
  movie,
  title,
  score,
  stats,
  autoSignal,
  isRefreshing = false,
}: {
  movie: { genres?: Array<{ name: string }> };
  title: string;
  score: number;
  stats?: FingerprintStats;
  autoSignal?: CraftDimensionsResponse;
  isRefreshing?: boolean;
}) {
  const contourValues = distributionValues(stats);
  const hasAudienceShape = contourValues.length > 0;
  const dna = audienceDNA(stats);
  const genreNames = (movie.genres ?? []).slice(0, 4).map((genre) => genre.name);
  const liveDimensions = autoSignal?.dimensions ?? [];
  const hasMeasuredDimensions = liveDimensions.some((dimension) => dimension.score !== null);
  const redditPosts = autoSignal?.sources.reddit.posts ?? [];
  const redditStatus = autoSignal?.sources.reddit.status ?? "not_found";
  const redditSearchUrl = `https://www.reddit.com/search/?q=${encodeURIComponent(`"${title}" review`)}`;
  const autoScore = autoSignal?.overallScore ?? score;
  const filmioSource = autoSignal?.sources.filmio;
  const updatedAt = autoSignal?.updatedAt
    ? new Date(autoSignal.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="movie-score-fingerprint" aria-labelledby="movie-score-title">
      <div className="movie-score-heading">
        <div>
          <p className="editorial-kicker">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Live movie signal
          </p>
          <h2 id="movie-score-title" className="mt-3 font-display text-xl font-semibold uppercase tracking-tight">
            Cinema fingerprint
          </h2>
        </div>
        <span className="movie-score-source">FILMIO auto / 10-point signal</span>
      </div>

      <div className="movie-score-fingerprint-main">
        <div className="movie-score-visual">
          <ScoreRing score={autoScore} />
          <span className="movie-score-visual-caption">{autoScore > 0 ? "FILMIO auto score" : "No score yet"}</span>
          <div className={`movie-score-contour ${!hasAudienceShape ? "movie-score-contour--empty" : ""}`}>
            <svg viewBox="0 0 220 220" role="img" aria-label={hasAudienceShape ? "Audience rating distribution contour" : "Audience contour awaiting ratings"}>
              {[0.32, 0.62, 0.9].map((radius) => (
                <polygon
                  key={radius}
                  className="movie-score-contour-grid"
                  points={pointsFor(DIMENSIONS.map(() => 1), 90 * radius)}
                />
              ))}
              {DIMENSIONS.map((dimension, index) => {
                const [x, y] = polarPoint(index, 1);
                return <line key={dimension} className="movie-score-contour-axis" x1="110" y1="110" x2={x} y2={y} />;
              })}
              {hasAudienceShape && (
                <polygon
                  className="movie-score-contour-shape"
                  points={pointsFor(contourValues)}
                />
              )}
            </svg>
            {!hasAudienceShape && <span className="movie-score-contour-note">Audience contour forms as FILMIO ratings arrive</span>}
          </div>
        </div>

        <div className="movie-score-breakdown">
          <div className="movie-score-breakdown-header">
            <span>Craft dimensions</span>
              <span className={`movie-score-breakdown-state ${hasMeasuredDimensions ? "movie-score-breakdown-state--live" : ""}`} aria-live="polite">
              {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : hasMeasuredDimensions ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />}
              {isRefreshing ? "Updating" : hasMeasuredDimensions ? "Auto-updating" : "Awaiting signal"}
            </span>
          </div>
          <div className="movie-score-dimensions" aria-label="Craft dimension scores">
            {DIMENSIONS.map((dimension) => {
              const signal = liveDimensions.find((item) => item.key === dimension);
              const dimensionScore = signal?.score ?? null;
              const scoreLabel = dimensionScore === null ? "not yet measured" : `${dimensionScore.toFixed(1)} out of 10`;
              return (
                <div key={dimension} className="movie-score-dimension">
                  <span>{dimension}</span>
                  <span
                    className="movie-score-dimension-line"
                    style={{ "--dimension-progress": dimensionScore === null ? "0%" : `${dimensionScore * 10}%` } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span className="movie-score-dimension-line-fill" />
                  </span>
                  <span className={`movie-score-dimension-value ${dimensionScore !== null ? "movie-score-dimension-value--live" : ""}`} aria-label={`${dimension} score ${scoreLabel}`}>
                    {dimensionScore === null ? "—" : dimensionScore.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="movie-score-explainer">
            {hasMeasuredDimensions
              ? `Auto-scored from ${filmioSource?.totalRatings ?? stats?.totalRatings ?? 0} FILMIO rating${(filmioSource?.totalRatings ?? stats?.totalRatings ?? 0) === 1 ? "" : "s"}, written reviews, and public Reddit discussion.`
              : "Scores appear automatically when FILMIO ratings or public Reddit craft discussion gives the model enough signal."}
          </p>
        </div>
      </div>

      <div className="movie-score-dna">
        <div className="movie-score-dna-heading">
          <span><Users className="h-4 w-4" aria-hidden="true" /> Audience DNA</span>
          <span className="movie-score-dna-rule" aria-hidden="true" />
          <span className="movie-score-dna-note">Derived from FILMIO signals</span>
        </div>
        <div className="movie-score-dna-chips">
          {dna.map((label, index) => (
            <DNAChip key={label} icon={index === 0 ? <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> : index === dna.length - 1 && (stats?.totalReviews ?? 0) > 0 ? <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> : undefined}>
              {label}
            </DNAChip>
          ))}
        </div>
      </div>

      <div className="movie-score-evidence">
        <div className="movie-score-evidence-heading">
          <span><MessageCircle className="h-4 w-4" aria-hidden="true" /> Reddit review signals</span>
          <a href={redditSearchUrl} target="_blank" rel="noreferrer" className="movie-score-evidence-link">
            Search Reddit <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
        <p className="movie-score-evidence-refresh">
          FILMIO {filmioSource?.totalRatings ?? stats?.totalRatings ?? 0} rating{(filmioSource?.totalRatings ?? stats?.totalRatings ?? 0) === 1 ? "" : "s"} · {redditPosts.length} public result{redditPosts.length === 1 ? "" : "s"}{updatedAt ? ` · Updated ${updatedAt}` : ""}
        </p>
        {redditPosts.length > 0 ? (
          <div className="movie-score-evidence-list">
            {redditPosts.slice(0, 3).map((post) => (
              <a key={post.url} href={post.url} target="_blank" rel="noreferrer" className="movie-score-evidence-item">
                <span className="movie-score-evidence-meta">{post.subreddit} · {post.comments.toLocaleString("en-IN")} comments</span>
                <strong>{post.title}</strong>
                {post.snippet && <span>{post.snippet}</span>}
              </a>
            ))}
          </div>
        ) : (
          <p className="movie-score-evidence-empty">
            {redditStatus === "unavailable"
              ? "Reddit is temporarily unavailable. FILMIO ratings will continue updating independently."
              : "No public Reddit review discussion found yet. This signal will check again automatically."}
          </p>
        )}
      </div>

      {genreNames.length > 0 && (
        <div className="movie-score-film-dna">
          <span className="movie-score-film-dna-label"><BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Film DNA</span>
          <div className="movie-score-film-dna-tags">
            {genreNames.map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}