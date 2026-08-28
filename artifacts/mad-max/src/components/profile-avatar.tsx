import { cn } from "@/lib/utils";

export function ProfileAvatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions = size === "lg" ? "h-28 w-28" : size === "sm" ? "h-9 w-9" : "h-20 w-20";
  return (
    <div className={cn("relative overflow-hidden rounded-md border border-border bg-[radial-gradient(circle_at_30%_20%,hsl(var(--projector)/0.5),transparent_48%),linear-gradient(145deg,hsl(var(--accent)/0.8),hsl(var(--surface-deep)))]", dimensions, className)}>
      {src ? (
        <img src={src} alt={`${name} avatar`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold uppercase text-primary">
          {name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}