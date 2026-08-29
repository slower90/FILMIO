import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api-url";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Compass,
  Film,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  getListProfilesQueryKey,
  useCreateProfile,
  useDeleteProfile,
  useRequestProfileAvatarUpload,
  useUpdateProfile,
  useListProfiles,
  type ViewingProfile,
  type ViewingProfileAvatarKey,
  type ViewingProfileInputLanguage,
  type ViewingProfileInputMaturity,
} from "@workspace/api-client-react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  getGetViewingHistoryQueryKey,
  getGetWatchlistQueryKey,
  getListMyRatingsQueryKey,
  useGetViewingHistory,
  useGetWatchlist,
  useListMyRatings,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useActiveProfile } from "@/lib/profile-context";
import {
  CINEMA_PREFERENCE_FIELDS,
  collectCinemaPreferenceOptions,
  type CinemaPreferenceKey,
  type CinemaPreferenceMovieOverview,
} from "@/lib/cinema-preferences";

const AVATARS: Array<{ key: ViewingProfileAvatarKey; label: string; seed: string }> = [
  { key: "orbit", label: "Orbit", seed: "orbit" },
  { key: "nova", label: "Nova", seed: "nova" },
  { key: "ember", label: "Ember", seed: "ember" },
  { key: "cine", label: "Cine", seed: "cine" },
  { key: "prism", label: "Prism", seed: "prism" },
  { key: "lunar", label: "Lunar", seed: "lunar" },
];
const LANGUAGES: Array<{ value: ViewingProfileInputLanguage; label: string }> = [
  { value: "en", label: "English" }, { value: "hi", label: "Hindi" }, { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" }, { value: "ml", label: "Malayalam" }, { value: "bn", label: "Bengali" },
  { value: "ja", label: "Japanese" }, { value: "ko", label: "Korean" }, { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];
const MATURITY: Array<{ value: ViewingProfileInputMaturity; label: string }> = [
  { value: "all", label: "All ages" }, { value: 7, label: "7+" }, { value: 13, label: "13+" },
  { value: 16, label: "16+" }, { value: 18, label: "18+" },
];

type EditorState = {
  id?: number;
  name: string;
  avatarKey: ViewingProfileAvatarKey;
  kidsMode: boolean;
  language: ViewingProfileInputLanguage;
  maturity: ViewingProfileInputMaturity;
  autoplay: boolean;
  favoriteActor: string;
  favoriteDirector: string;
  favoriteGenre: string;
  favoriteCountry: string;
  favoriteDecade: string;
  favoriteLanguage: string;
  file?: File;
};

const avatarUrl = (seed: string) => `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${seed}`;

function editorFrom(profile?: ViewingProfile): EditorState {
  return {
    id: profile?.id,
    name: profile?.name ?? "",
    avatarKey: profile?.avatarKey ?? "orbit",
    kidsMode: profile?.kidsMode ?? false,
    language: profile?.language ?? "en",
    maturity: profile?.maturity ?? "all",
    autoplay: profile?.autoplay ?? true,
    favoriteActor: profile?.favoriteActor ?? "",
    favoriteDirector: profile?.favoriteDirector ?? "",
    favoriteGenre: profile?.favoriteGenre ?? "",
    favoriteCountry: profile?.favoriteCountry ?? "",
    favoriteDecade: profile?.favoriteDecade ?? "",
    favoriteLanguage: profile?.favoriteLanguage ?? "",
  };
}

function apiError(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return message || fallback;
}

export default function Profiles() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [, setLocation] = useLocation();
  const { profiles, activeProfile, setActiveProfileId } = useActiveProfile();
  const profileQuery = useListProfiles({ query: { queryKey: getListProfilesQueryKey(), enabled: isLoaded && !!isSignedIn } });
  const activityProfileParams = activeProfile ? { profileId: activeProfile.id } : undefined;
  const historyQuery = useGetViewingHistory(activityProfileParams, {
    query: { queryKey: getGetViewingHistoryQueryKey(activityProfileParams), enabled: isLoaded && !!isSignedIn && !!activeProfile },
  });
  const ratingsQuery = useListMyRatings(activityProfileParams, {
    query: { queryKey: getListMyRatingsQueryKey(activityProfileParams), enabled: isLoaded && !!isSignedIn && !!activeProfile },
  });
  const watchlistQuery = useGetWatchlist(activityProfileParams, {
    query: { queryKey: getGetWatchlistQueryKey(activityProfileParams), enabled: isLoaded && !!isSignedIn && !!activeProfile },
  });
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();
  const requestAvatarUpload = useRequestProfileAvatarUpload();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preferenceMovieIds = useMemo(
    () => [...new Set([
      ...(historyQuery.data || []).map((entry) => entry.id),
      ...(ratingsQuery.data || []).map((rating) => rating.movieId),
      ...(watchlistQuery.data || []).map((entry) => entry.movieId),
    ])].slice(0, 24),
    [historyQuery.data, ratingsQuery.data, watchlistQuery.data],
  );
  const preferenceDetailQueries = useQueries({
    queries: preferenceMovieIds.map((movieId) => ({
      queryKey: ["profile-preference-movie", movieId],
      queryFn: async () => {
        const response = await apiFetch(`/api/movies/${movieId}/overview`);
        if (!response.ok) throw new Error("Movie metadata unavailable");
        return response.json() as Promise<CinemaPreferenceMovieOverview>;
      },
      staleTime: 30 * 60 * 1000,
    })),
  });
  const preferenceOptions = useMemo(
    () => collectCinemaPreferenceOptions(preferenceDetailQueries.map((query) => query.data as CinemaPreferenceMovieOverview | undefined)),
    [preferenceDetailQueries],
  );

  useEffect(() => {
    if (!editor && activeProfile) setEditor(editorFrom(activeProfile));
  }, [activeProfile, editor]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
    await queryClient.invalidateQueries();
  };

  const persistAvatar = async (profileId: number, file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error("Choose a JPG, PNG, or WebP image up to 5MB.");
    }
    const signed = await requestAvatarUpload.mutateAsync({
      profileId,
      data: { name: file.name, size: file.size, contentType: file.type as "image/jpeg" | "image/png" | "image/webp" },
    });
    const uploaded = await fetch(signed.uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploaded.ok) throw new Error("The avatar upload could not be completed. Please retry.");
    await updateProfile.mutateAsync({ profileId, data: { avatarObjectPath: signed.objectPath } });
  };

  const save = async () => {
    if (!editor) return;
    setError(null);
    setNotice(null);
    const name = editor.name.trim();
    if (!name) {
      setError("Give this profile a name before saving.");
      return;
    }
    setUploading(Boolean(editor.file));
    try {
      const payload = {
        name,
        avatarKey: editor.avatarKey,
        kidsMode: editor.kidsMode,
        language: editor.language,
        maturity: editor.maturity,
        autoplay: editor.autoplay,
        favoriteActor: editor.favoriteActor.trim() || null,
        favoriteDirector: editor.favoriteDirector.trim() || null,
        favoriteGenre: editor.favoriteGenre.trim() || null,
        favoriteCountry: editor.favoriteCountry.trim() || null,
        favoriteDecade: editor.favoriteDecade.trim() || null,
        favoriteLanguage: editor.favoriteLanguage.trim() || null,
      };
      let profileId = editor.id;
      if (profileId) {
        await updateProfile.mutateAsync({ profileId, data: payload });
      } else {
        const created = await createProfile.mutateAsync({ data: payload });
        profileId = created.id;
      }
      if (profileId && editor.file) await persistAvatar(profileId, editor.file);
      await refresh();
      if (profileId) setActiveProfileId(profileId);
      setEditor(null);
      setNotice("Profile saved.");
      if (user?.id) setLocation(`/profile/${user.id}`);
    } catch (saveError) {
      setError(apiError(saveError, "We could not save this profile. Your changes are still here."));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (profileId: number) => {
    setError(null);
    try {
      await deleteProfile.mutateAsync({ profileId });
      setDeleteId(null);
      if (editor?.id === profileId) setEditor(null);
      await refresh();
      setNotice("Profile deleted.");
    } catch (deleteError) {
      setError(apiError(deleteError, "That profile could not be deleted. Nothing was removed."));
    }
  };

  const choose = (profile: ViewingProfile) => {
    setActiveProfileId(profile.id);
    setEditor(editorFrom(profile));
    setNotice(`${profile.name} is now active.`);
  };

  if (!isLoaded) return <div className="min-h-screen bg-background" />;
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background"><Navbar /><main className="container mx-auto px-4 pt-32 text-center">
        <Film className="mx-auto mb-5 h-12 w-12 text-primary" />
        <h1 className="text-3xl font-display font-bold uppercase">Your viewing rooms</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">Sign in to create a personal profile and keep your discovery context separate.</p>
        <Button className="mt-7" onClick={() => setLocation("/sign-in?redirect=/profiles")}>Sign in to continue</Button>
      </main></div>
    );
  }

  const loading = profileQuery.isLoading;
  return (
    <div className="film-grain min-h-screen bg-background pb-20">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 pt-28">
        <Link href="/discover" className="mb-8 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Discover
        </Link>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <p className="editorial-kicker">Private viewing rooms</p>
            <h1 className="editorial-heading mt-4 max-w-xl">Who is watching tonight?</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Switch the lens without changing your public FILMIO identity. Each room keeps its own recommendations, history, and watchlist.
            </p>
            {notice && <div role="status" className="mt-6 flex items-center gap-2 border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"><Check className="h-4 w-4" /> {notice}</div>}
            {error && <div role="alert" className="mt-6 flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"><X className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
            {profileQuery.error ? (
              <div className="mt-8 border border-destructive/40 bg-destructive/10 p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-destructive"><X className="h-4 w-4" /> Profiles are unavailable right now.</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Your existing account and public identity are safe. Retry when the connection is ready.</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => void profileQuery.refetch()}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Retry</Button>
              </div>
            ) : loading ? (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-md bg-muted" />)}</div>
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {profiles.map((profile) => (
                  <div key={profile.id} className={`group relative rounded-md border p-3 transition ${activeProfile?.id === profile.id ? "border-primary bg-primary/10 shadow-[0_0_32px_hsl(var(--primary)/0.12)]" : "border-border bg-card/60 hover:border-primary/50"}`}>
                    <button type="button" className="flex min-h-11 w-full flex-col items-center gap-3 text-center" onClick={() => choose(profile)} aria-pressed={activeProfile?.id === profile.id}>
                      <ProfileAvatar src={profile.avatarUrl} name={profile.name} size="lg" />
                      <span className="w-full truncate font-display text-xs font-bold uppercase tracking-wider">{profile.name}</span>
                    </button>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{profile.isDefault ? "Default" : profile.kidsMode ? "Kids room" : "Room"}</span>
                      <button type="button" onClick={() => { setEditor(editorFrom(profile)); setNotice(null); setError(null); }} className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-primary" aria-label={`Edit ${profile.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {deleteId === profile.id && !profile.isDefault ? (
                      <div className="absolute inset-0 z-10 flex flex-col justify-center gap-2 rounded-md bg-background/95 p-4 text-center">
                        <p className="text-xs font-bold uppercase tracking-wider">Delete {profile.name}?</p>
                        <p className="text-[11px] text-muted-foreground">Its watchlist and history will be removed.</p>
                        <div className="flex gap-2"><Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void remove(profile.id)}>Delete</Button><Button size="sm" variant="outline" onClick={() => setDeleteId(null)}>Keep</Button></div>
                      </div>
                    ) : !profile.isDefault ? (
                      <button type="button" onClick={() => setDeleteId(profile.id)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-sm bg-background/70 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive" aria-label={`Delete ${profile.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    ) : null}
                  </div>
                ))}
                {profiles.length < 5 && (
                  <button type="button" onClick={() => { setEditor(editorFrom()); setNotice(null); setError(null); }} className="flex min-h-[11.5rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card/20 p-3 text-muted-foreground transition hover:border-primary hover:text-primary">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-current"><Plus className="h-6 w-6" /></span>
                    <span className="font-display text-xs font-bold uppercase tracking-wider">Add profile</span>
                  </button>
                )}
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-border/60 pt-5">
              <Link href={user ? `/profile/${user.id}` : "/profiles/graph"} className="profile-graph-cta group flex w-full items-center justify-between gap-4 rounded-md border border-primary/30 bg-primary/5 p-4 transition hover:border-primary/70 hover:bg-primary/10">
                <span className="flex items-center gap-3"><span className="profile-graph-cta-mark"><Compass className="h-4 w-4" /></span><span><span className="block font-display text-xs font-bold uppercase tracking-wider text-foreground">Open your cinema universe</span><span className="mt-1 block text-xs text-muted-foreground">See your profile, stats, and the patterns across this room’s films.</span></span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href={`/profile/${user.id}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary"><ShieldCheck className="h-4 w-4" /> Public identity</Link>
              <Link href="/discover" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">Return to films <ChevronRight className="h-4 w-4" /></Link>
            </div>
          </section>

          <section className="rounded-md border border-border bg-card/50 p-5 sm:p-7">
            {editor ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div><p className="editorial-kicker">{editor.id ? "Tune this room" : "New viewing room"}</p><h2 className="mt-3 text-2xl font-display font-bold uppercase">{editor.id ? "Profile settings" : "Make it yours"}</h2></div>
                  <button type="button" onClick={() => setEditor(null)} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-primary" aria-label="Close profile editor"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-7 flex items-center gap-4 border-y border-border/60 py-5">
                  <ProfileAvatar src={editor.file ? URL.createObjectURL(editor.file) : avatarUrl(editor.avatarKey)} name={editor.name || "Profile"} size="lg" />
                  <div><p className="font-display text-sm font-bold uppercase">{editor.file ? editor.file.name : "Character avatar"}</p><p className="mt-1 text-xs text-muted-foreground">Pick a FILMIO character or upload your own.</p>
                    <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-3.5 w-3.5" /> Upload</Button>{editor.file && <Button size="sm" variant="ghost" onClick={() => setEditor({ ...editor, file: undefined })}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Use character</Button>}</div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setEditor({ ...editor, file: event.target.files?.[0] })} />
                </div>
                <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Profile name<input value={editor.name} maxLength={40} onChange={(event) => setEditor({ ...editor, name: event.target.value })} className="mt-2 min-h-12 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none" placeholder="e.g. Weekend cinema" /></label>
                <div className="mt-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Character set</p><div className="mt-3 grid grid-cols-3 gap-2">{AVATARS.map((avatar) => <button key={avatar.key} type="button" onClick={() => setEditor({ ...editor, avatarKey: avatar.key, file: undefined })} className={`rounded-sm border p-2 text-center transition ${editor.avatarKey === avatar.key && !editor.file ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`} aria-pressed={editor.avatarKey === avatar.key && !editor.file}><img src={avatarUrl(avatar.seed)} alt="" className="mx-auto h-12 w-12 rounded-sm" /><span className="mt-1 block text-[9px] font-bold uppercase tracking-wider">{avatar.label}</span></button>)}</div></div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Language<select value={editor.language} onChange={(event) => setEditor({ ...editor, language: event.target.value as ViewingProfileInputLanguage })} className="mt-2 min-h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground">{LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Maturity<select value={String(editor.maturity)} onChange={(event) => setEditor({ ...editor, maturity: event.target.value === "all" ? "all" : Number(event.target.value) as ViewingProfileInputMaturity })} className="mt-2 min-h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground">{MATURITY.map((level) => <option key={String(level.value)} value={String(level.value)}>{level.label}</option>)}</select></label>
                </div>
                <div className="mt-7 border-t border-border/60 pt-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My cinema preferences</p>
                    <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                      Choose these yourself. FILMIO may suggest names from this room’s catalog, but it will never turn activity into a favorite without your say.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {CINEMA_PREFERENCE_FIELDS.map((field) => {
                      const value = editor[field.key];
                      const listId = `profile-${field.key}-options`;
                      return (
                        <label key={field.key} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {field.label}
                          <div className="mt-2 flex gap-2">
                            <input
                              value={value}
                              list={listId}
                              maxLength={field.key === "favoriteDecade" ? 20 : 120}
                              onChange={(event) => setEditor({ ...editor, [field.key as CinemaPreferenceKey]: event.target.value })}
                              className="min-h-11 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm normal-case tracking-normal text-foreground focus:border-primary focus:outline-none"
                              placeholder={field.placeholder}
                            />
                            {value && <button type="button" className="min-h-11 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary" onClick={() => setEditor({ ...editor, [field.key as CinemaPreferenceKey]: "" })}>Clear</button>}
                          </div>
                          <datalist id={listId}>
                            {preferenceOptions[field.key].map((option) => <option value={option} key={option} />)}
                          </datalist>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {preferenceMovieIds.length ? "Suggestions come from films in this room. You can also type a choice that is not in the list." : "No films in this room yet. You can still type your choices."}
                  </p>
                </div>
                <div className="mt-6 space-y-3">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-sm border border-border bg-background/60 px-3 text-sm"><span><span className="block font-bold">Kids mode</span><span className="text-xs text-muted-foreground">Keep this room focused on family viewing.</span></span><input type="checkbox" checked={editor.kidsMode} onChange={(event) => setEditor({ ...editor, kidsMode: event.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" /></label>
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-sm border border-border bg-background/60 px-3 text-sm"><span><span className="block font-bold">Autoplay previews</span><span className="text-xs text-muted-foreground">Let cinematic previews start automatically.</span></span><input type="checkbox" checked={editor.autoplay} onChange={(event) => setEditor({ ...editor, autoplay: event.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" /></label>
                </div>
                <div className="mt-7 flex flex-wrap gap-3"><Button onClick={() => void save()} disabled={uploading || createProfile.isPending || updateProfile.isPending || requestAvatarUpload.isPending}><Save className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Save profile"}</Button><Button variant="outline" onClick={() => setEditor(editor.id ? editorFrom(profiles.find((profile) => profile.id === editor.id)) : null)}><X className="mr-2 h-4 w-4" /> Cancel</Button></div>
              </>
            ) : (
              <div className="flex min-h-[32rem] flex-col items-center justify-center text-center">
                <ImagePlus className="h-12 w-12 text-primary/70" />
                <h2 className="mt-5 text-2xl font-display font-bold uppercase">Choose a room to tune</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">Select edit on a profile or add a new one. Your public name, friends, reviews, and messages stay exactly where they are.</p>
                <button type="button" onClick={() => setEditor(editorFrom())} className="mt-7 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80">Create a room <ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}