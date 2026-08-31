import { ArrowUpRight, Clapperboard } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type CinemaEmptyAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  testId?: string;
};

type CinemaEmptyStateProps = {
  description: string;
  actions?: CinemaEmptyAction[];
  compact?: boolean;
  className?: string;
};

export function CinemaEmptyState({
  description,
  actions = [],
  compact = false,
  className,
}: CinemaEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-border/80 bg-card/20 px-6 py-12 text-center",
        compact ? "min-h-[12rem] py-8" : "min-h-[18rem]",
        className,
      )}
      role="status"
    >
      <div className="flex h-11 w-11 items-center justify-center border border-primary/45 bg-primary/10 text-primary">
        <Clapperboard className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="cinema-kicker mt-5">A quiet frame</p>
      <h2 className="mt-3 max-w-2xl font-display text-xl font-semibold uppercase tracking-[-0.02em] sm:text-2xl">
        THE CAMERA FOUND NOTHING HERE.
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {actions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actions.map((action) =>
            action.href ? (
              <Link
                key={action.label}
                href={action.href}
                className="inline-flex min-h-11 items-center gap-2 border border-primary/50 px-4 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10"
                data-testid={action.testId}
              >
                {action.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="inline-flex min-h-11 items-center gap-2 border border-primary/50 px-4 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10"
                data-testid={action.testId}
              >
                {action.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}