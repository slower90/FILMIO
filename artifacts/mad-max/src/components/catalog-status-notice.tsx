import { Info } from "lucide-react";

export interface CatalogMetadata {
  source: string;
  fetchedAt: string;
  stale?: boolean;
  partial?: boolean;
}

export function getCatalogStatusMessage(metadata?: CatalogMetadata): string | null {
  if (!metadata || (!metadata.stale && !metadata.partial && metadata.source !== "unavailable")) {
    return null;
  }
  return metadata.source === "unavailable"
    ? "Some catalog details are unavailable right now."
    : metadata.stale
      ? "Showing recently cached catalog results while the catalog refreshes."
      : "Some catalog results could not be loaded and may be incomplete.";
}

export function CatalogStatusNotice({ metadata }: { metadata?: CatalogMetadata }) {
  const message = getCatalogStatusMessage(metadata);
  if (!message) {
    return null;
  }

  return (
    <div role="status" className="mb-6 flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
      <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}