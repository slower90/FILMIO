const STORAGE_KEY = "mad-max-mood-signals";
const MAX_SIGNALS = 30;

export type MoodId = "tense" | "adrenaline" | "joyful" | "heartfelt" | "wonder";

export interface MoodProfile {
  id: MoodId;
  label: string;
  description: string;
  genreIds: number[];
  icon: string;
}

export const MOODS: Record<MoodId, MoodProfile> = {
  tense: {
    id: "tense",
    label: "Tense Night Picks",
    description: "Dark mysteries, horror, and edge-of-your-seat thrillers",
    genreIds: [27, 53, 9648],
    icon: "👻",
  },
  adrenaline: {
    id: "adrenaline",
    label: "Adrenaline Rush",
    description: "Action-packed adventures chosen for your current vibe",
    genreIds: [28, 12],
    icon: "⚡",
  },
  joyful: {
    id: "joyful",
    label: "Feel-Good Favorites",
    description: "Light, funny movies to lift the mood",
    genreIds: [35, 10751],
    icon: "😂",
  },
  heartfelt: {
    id: "heartfelt",
    label: "Heartfelt Stories",
    description: "Romance and drama with something real to say",
    genreIds: [18, 10749],
    icon: "❤️",
  },
  wonder: {
    id: "wonder",
    label: "Wonder & Imagination",
    description: "Science fiction and fantasy worlds to get lost in",
    genreIds: [878, 14],
    icon: "🚀",
  },
};

const GENRE_TO_MOOD: Record<number, MoodId> = {
  27: "tense", 53: "tense", 9648: "tense",
  28: "adrenaline", 12: "adrenaline",
  35: "joyful", 10751: "joyful",
  18: "heartfelt", 10749: "heartfelt",
  878: "wonder", 14: "wonder",
};

const TERM_TO_MOOD: Array<[RegExp, MoodId]> = [
  [/\b(horror|scary|terrifying|ghost|zombie|vampire|thriller|mystery|crime)\b/i, "tense"],
  [/\b(action|fight|war|hero|superhero|adventure|martial)\b/i, "adrenaline"],
  [/\b(comedy|funny|laugh|family|kids|feel[\s-]?good)\b/i, "joyful"],
  [/\b(romance|romantic|love|drama|emotional|heart)\b/i, "heartfelt"],
  [/\b(sci[\s-]?fi|science fiction|space|alien|fantasy|magic|anime)\b/i, "wonder"],
];

function readSignals(): MoodId[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((v): v is MoodId => v in MOODS) : [];
  } catch {
    return [];
  }
}

function writeSignal(mood: MoodId) {
  if (typeof window === "undefined") return;
  const signals = [mood, ...readSignals()].slice(0, MAX_SIGNALS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
  window.dispatchEvent(new CustomEvent("mad-max-mood-change"));
}

export function recordMoodSignal(value: string | number) {
  const mood = typeof value === "number"
    ? GENRE_TO_MOOD[value]
    : TERM_TO_MOOD.find(([pattern]) => pattern.test(value))?.[1];
  if (mood) writeSignal(mood);
}

export function getLearnedMood(): MoodProfile {
  const scores = readSignals().reduce<Record<MoodId, number>>((total, mood, index) => {
    total[mood] += Math.max(1, 4 - Math.floor(index / 5));
    return total;
  }, { tense: 0, adrenaline: 0, joyful: 0, heartfelt: 0, wonder: 0 });
  const mood = (Object.keys(scores) as MoodId[]).sort((a, b) => scores[b] - scores[a])[0];
  return MOODS[mood] ?? MOODS.wonder;
}