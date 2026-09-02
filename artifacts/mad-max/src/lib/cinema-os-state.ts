export type CinemaStorage = Pick<Storage, "getItem" | "setItem">;

export type ProfileActivityState = "signed-out" | "loading" | "error" | "empty" | "ready";

export type ProfileActivitySnapshot = {
  isSignedIn: boolean;
  isReady: boolean;
  historyLoading: boolean;
  ratingsLoading: boolean;
  watchlistLoading: boolean;
  historyError: boolean;
  ratingsError: boolean;
  watchlistError: boolean;
  watchedCount: number;
  ratedCount: number;
  queuedCount: number;
};

export const CINEMA_OS_TEST_IDS = {
  signedOutStatus: "status-cinema-os-signed-out",
  signalLoadingStatus: "status-cinema-os-signal-loading",
  signalErrorStatus: "status-cinema-os-signal-error",
  signalEmptyStatus: "status-cinema-os-signal-empty",
  signalRetryButton: "button-cinema-os-retry",
  afterglowInput: "textarea-cinema-os-afterglow",
  afterglowSaveButton: "button-cinema-os-save-afterglow",
  featureSelect: (slot: number) => `select-cinema-os-feature-${slot}`,
  featureSaveButton: "button-cinema-os-save-feature",
  spoilerToggleButton: "button-cinema-os-spoiler-toggle",
  spoilerInput: "textarea-cinema-os-spoiler",
  spoilerSaveButton: "button-cinema-os-save-spoiler",
  passportStampButton: "button-cinema-os-passport-stamp",
  curriculumProgressButton: "button-cinema-os-curriculum-progress",
} as const;

export function readCinemaLocal<T>(
  storage: CinemaStorage | undefined,
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T {
  if (!storage) return fallback;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "null");
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveCinemaLocal(storage: CinemaStorage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

export function getProfileActivityState(snapshot: ProfileActivitySnapshot): ProfileActivityState {
  if (!snapshot.isSignedIn) return "signed-out";
  if (
    !snapshot.isReady ||
    snapshot.historyLoading ||
    snapshot.ratingsLoading ||
    snapshot.watchlistLoading
  ) {
    return "loading";
  }
  if (snapshot.historyError || snapshot.ratingsError || snapshot.watchlistError) {
    return "error";
  }
  if (snapshot.watchedCount === 0 && snapshot.ratedCount === 0 && snapshot.queuedCount === 0) {
    return "empty";
  }
  return "ready";
}