import type { ReactNode } from "react";
import { BarChart3, CircleHelp, MessageCircle, Sparkles, Users } from "lucide-react";

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
  score,
  stats,
}: {
  movie: { genres?: Array<{ name: string }> };
  score: number;
  stats?: FingerprintStats;
}) {
  const contourValues = distributionValues(stats);
  const hasAudienceShape = contourValues.length > 0;
  const dna = audienceDNA(stats);
  const genreNames = (movie.genres ?? []).slice(0, 4).map((genre) => genre.name);

  return (
    <section className="movie-score-fingerprint" aria-labelledby="movie-score-title">
      <div className="movie-score-heading">
        <div>
          <p className="editorial-kicker">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> The new movie score
          </p>
          <h2 id="movie-score-title" className="mt-3 font-display text-xl font-semibold uppercase tracking-tight">
            Cinema fingerprint
          </h2>
        </div>
        <span className="movie-score-source">FILMIO / 10-point signal</span>
      </div>

      <div className="movie-score-fingerprint-main">
        <div className="movie-score-visual">
          <ScoreRing score={score} />
          <span className="movie-score-visual-caption">{score > 0 ? "FILMIO score" : "No score yet"}</span>
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
            <span className="movie-score-breakdown-state">
              <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Not yet measured
            </span>
          </div>
          <div className="movie-score-dimensions" aria-label="Craft dimension scores">
            {DIMENSIONS.map((dimension) => (
              <div key={dimension} className="movie-score-dimension">
                <span>{dimension}</span>
                <span className="movie-score-dimension-line" aria-hidden="true" />
                <span className="movie-score-dimension-value" aria-label={`${dimension} score not yet measured`}>—</span>
              </div>
            ))}
          </div>
          <p className="movie-score-explainer">
            FILMIO currently collects one title score. Category scores will appear here once members can rate the craft separately; this contour already reflects the real audience distribution.
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