export type CinemaStorage = Pick<Storage, "getItem" | "setItem">;

export type ProfileActivityState =
  "signed-out" | "loading" | "error" | "empty" | "ready";

export type CinemaOsLocalState = {
  afterglow: {
    movieId: number | null;
    movieTitle: string;
    note: string;
    updatedAt: string;
  };
  doubleFeature: [number | null, number | null];
  spoilerNote: string;
  passportCount: number;
  curriculumProgress: number;
};

export const EMPTY_CINEMA_OS_STATE: CinemaOsLocalState = {
  afterglow: { movieId: null, movieTitle: "", note: "", updatedAt: "" },
  doubleFeature: [null, null],
  spoilerNote: "",
  passportCount: 0,
  curriculumProgress: 1,
};

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

export function saveCinemaLocal(
  storage: CinemaStorage,
  key: string,
  value: unknown,
): void {
  storage.setItem(key, JSON.stringify(value));
}

export function hasMeaningfulCinemaOsState(state: CinemaOsLocalState): boolean {
  return Boolean(
    state.afterglow.note.trim() ||
    state.doubleFeature.some((movieId) => movieId !== null) ||
    state.spoilerNote.trim() ||
    state.passportCount > 0 ||
    state.curriculumProgress > 1,
  );
}

export function mergeCinemaOsState(
  remote: CinemaOsLocalState,
  local: CinemaOsLocalState,
): CinemaOsLocalState {
  const localAfterglowIsNewer =
    Boolean(local.afterglow.note.trim()) &&
    (!remote.afterglow.note.trim() ||
      new Date(local.afterglow.updatedAt).getTime() >
        new Date(remote.afterglow.updatedAt).getTime());

  return {
    afterglow: localAfterglowIsNewer ? local.afterglow : remote.afterglow,
    doubleFeature: remote.doubleFeature.some((movieId) => movieId !== null)
      ? remote.doubleFeature
      : local.doubleFeature,
    spoilerNote: remote.spoilerNote.trim()
      ? remote.spoilerNote
      : local.spoilerNote,
    passportCount: Math.max(remote.passportCount, local.passportCount),
    curriculumProgress: Math.max(
      remote.curriculumProgress,
      local.curriculumProgress,
    ),
  };
}

export function getProfileActivityState(
  snapshot: ProfileActivitySnapshot,
): ProfileActivityState {
  if (!snapshot.isSignedIn) return "signed-out";
  if (
    !snapshot.isReady ||
    snapshot.historyLoading ||
    snapshot.ratingsLoading ||
    snapshot.watchlistLoading
  ) {
    return "loading";
  }
  if (
    snapshot.historyError ||
    snapshot.ratingsError ||
    snapshot.watchlistError
  ) {
    return "error";
  }
  if (
    snapshot.watchedCount === 0 &&
    snapshot.ratedCount === 0 &&
    snapshot.queuedCount === 0
  ) {
    return "empty";
  }
  return "ready";
}
