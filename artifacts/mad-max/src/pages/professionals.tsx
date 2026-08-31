import { Navbar } from "@/components/navbar";
import {
  useSearchProfessionals,
  useGetMyProfessionalProfile,
  useCreateProfessionalProfile,
  useUpdateProfessionalProfile,
  getGetMyProfessionalProfileQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ProfessionalMediaGallery, type ProfessionalMedia } from "@/components/professional-media-gallery";
import { CinemaEmptyState } from "@/components/cinema-empty-state";
import { Link } from "wouter";
import { ArrowRight, Briefcase, UsersRound, BadgeCheck, Check, Loader2, Pencil, Plus, Trash2, Upload, Film, X, Award, ExternalLink, MessageCircle, Quote, Newspaper, Sparkles, Save } from "lucide-react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api-url";

type WorkEntry = { id: number; projectName: string; role: string; year: number | null; movieId?: number | null; collaborators: string[]; description?: string | null };
type Influence = { id: number; name: string; note?: string | null };
type AwardEntry = { id: number; title: string; organization?: string | null; category?: string | null; year?: number | null; link?: string | null };
type InterviewEntry = { id: number; title: string; publication: string; url: string; year?: number | null };
type AudienceQuestion = { id: number; question: string; answer?: string | null; status: "pending" | "published" | "hidden"; createdAt?: string; asker?: { displayName?: string | null } };
type Audition = { id: number; title: string; description?: string | null; fileName: string; contentType: string; fileSize: number; isPublic: boolean; createdAt: string };
type ProfileWorkspaceData = {
  displayName?: string | null;
  headshotUrl?: string | null;
  demoReelUrl?: string | null;
  bio?: string | null;
  roles?: string[];
  skills?: string[];
  agencyContact?: string | null;
  availabilityStatus: string;
  verified?: boolean;
  imdbLink?: string | null;
};
type PortfolioEvidence = {
  work: WorkEntry[];
  auditions: Audition[];
  media: ProfessionalMedia[];
  influences: Influence[];
  awards: AwardEntry[];
  interviews: InterviewEntry[];
  questions: AudienceQuestion[];
};

const SUPPORTED_ROLES = ["Director", "Writer", "Actor", "Editor", "Cinematographer", "Composer", "Designer", "Producer", "DOP", "Sound Designer"];

function ProfileWorkspace({
  profile,
  media,
  onEdit,
  onMediaChanged,
}: {
  profile: ProfileWorkspaceData;
  media: ProfessionalMedia[];
  onEdit: () => void;
  onMediaChanged: () => void | Promise<void>;
}) {
  const [, navigate] = useLocation();
  const availabilityLabel = profile.availabilityStatus.replace(/_/g, " ");
  const availabilityClass = profile.availabilityStatus === "available"
    ? "border-green-500/50 bg-green-500/10 text-green-500"
    : profile.availabilityStatus === "open_to_projects"
      ? "border-primary/50 bg-primary/10 text-primary"
      : "border-muted bg-muted/20 text-muted-foreground";

  return (
    <>
      <section className="border-b border-border bg-card px-4 pb-12 pt-28">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            <div className="relative shrink-0 self-center md:self-auto">
              <img
                src={profile.headshotUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.displayName || "FILMIO"}`}
                alt={`${profile.displayName || "Professional"} profile`}
                className="h-36 w-36 rounded-md border-4 border-background object-cover shadow-2xl sm:h-44 sm:w-44"
              />
              {profile.verified && (
                <div className="absolute -bottom-3 -right-3 rounded-full border-4 border-card bg-primary p-2 text-primary-foreground shadow-lg" title="Verified Professional">
                  <BadgeCheck className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Professional profile</p>
                  <h1 className="text-3xl font-bold uppercase tracking-tight text-glow sm:text-5xl">{profile.displayName || "FILMIO Professional"}</h1>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.roles?.map((role) => (
                      <span key={role} className="rounded-sm border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">{role}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onEdit} className="gap-2">
                    <Pencil className="h-4 w-4" /> Edit profile
                  </Button>
                  <Button type="button" size="sm" onClick={() => navigate("/feed")} className="gap-2">
                    Social Feed <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-widest">
                <span className={`rounded-sm border px-3 py-1.5 ${availabilityClass}`}>{availabilityLabel}</span>
                {profile.agencyContact && <span className="text-muted-foreground">{profile.agencyContact}</span>}
                {profile.imdbLink && (
                  <a href={profile.imdbLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary">IMDb ↗</a>
                )}
              </div>
              {profile.bio && <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">{profile.bio}</p>}
              {profile.skills && profile.skills.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.skills.map((skill) => <span key={skill} className="rounded-sm bg-secondary px-2.5 py-1 text-xs uppercase tracking-wider text-muted-foreground">{skill}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <main className="container mx-auto max-w-5xl px-4 py-12">
        <ProfessionalMediaGallery media={media} editable onChanged={onMediaChanged} />
      </main>
    </>
  );
}

function EvidenceEditor({
  portfolio,
  onChanged,
}: {
  portfolio: PortfolioEvidence;
  onChanged: () => void | Promise<void>;
}) {
  const [influenceDraft, setInfluenceDraft] = useState({ name: "", note: "" });
  const [awardDraft, setAwardDraft] = useState({ title: "", organization: "", category: "", year: "", link: "" });
  const [interviewDraft, setInterviewDraft] = useState({ title: "", publication: "", year: "", url: "" });
  const [editing, setEditing] = useState<{ kind: "influence" | "award" | "interview"; id: number } | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuestionAnswers(Object.fromEntries(portfolio.questions.map((item) => [item.id, item.answer ?? ""])));
  }, [portfolio.questions]);

  const request = async (path: string, method: "POST" | "PATCH" | "DELETE", data?: unknown) => {
    const response = await apiFetch(path, {
      method,
      headers: data ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "This profile evidence could not be saved.");
  };
  const finish = async (key: string, action: () => Promise<void>) => {
    setSaving(key);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "This profile evidence could not be saved.");
    } finally {
      setSaving(null);
    }
  };
  const yearValue = (value: string) => value.trim() ? Number(value) : null;

  return (
    <section className="mt-8 space-y-8 border-t border-border pt-8" data-testid="professional-evidence-editor">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">The record</p>
        <h3 className="mt-2 flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wider"><Sparkles className="h-5 w-5 text-primary" /> Creative evidence</h3>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">Give audiences the context behind the work. These notes appear on your public profile; private auditions stay private.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3"><Quote className="h-4 w-4 text-primary" /><h4 className="font-display text-lg font-bold uppercase tracking-wider">Influences</h4></div>
        {portfolio.influences.map((item) => editing?.kind === "influence" && editing.id === item.id ? (
          <div key={item.id} className="grid gap-3 rounded-md border border-primary/50 bg-card p-4 sm:grid-cols-2">
            <input value={influenceDraft.name} onChange={(event) => setInfluenceDraft({ ...influenceDraft, name: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Person, film, book, or place" />
            <input value={influenceDraft.note} onChange={(event) => setInfluenceDraft({ ...influenceDraft, note: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="What stays with you?" />
            <div className="flex gap-2 sm:col-span-2"><Button type="button" size="sm" onClick={() => void finish(`influence-${item.id}`, async () => { await request(`/api/professionals/me/influences/${item.id}`, "PATCH", { name: influenceDraft.name, note: influenceDraft.note || null }); setEditing(null); })} disabled={saving === `influence-${item.id}`}><Save className="mr-2 h-3.5 w-3.5" /> Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        ) : (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-4">
            <div><p className="font-bold">{item.name}</p>{item.note && <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>}</div>
            <div className="flex shrink-0"><Button type="button" size="icon" variant="ghost" onClick={() => { setInfluenceDraft({ name: item.name, note: item.note ?? "" }); setEditing({ kind: "influence", id: item.id }); }} aria-label={`Edit ${item.name}`}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => void finish(`delete-influence-${item.id}`, () => request(`/api/professionals/me/influences/${item.id}`, "DELETE"))} aria-label={`Delete ${item.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
          </div>
        ))}
        <div className="grid gap-3 rounded-md border border-dashed border-border p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input value={influenceDraft.name} onChange={(event) => setInfluenceDraft({ ...influenceDraft, name: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Person, film, book, or place" />
          <input value={influenceDraft.note} onChange={(event) => setInfluenceDraft({ ...influenceDraft, note: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="A short note (optional)" />
          <Button type="button" variant="outline" onClick={() => void finish("add-influence", async () => { await request("/api/professionals/me/influences", "POST", { name: influenceDraft.name, note: influenceDraft.note || null }); setInfluenceDraft({ name: "", note: "" }); })} disabled={!influenceDraft.name.trim() || saving === "add-influence"}><Plus className="mr-2 h-4 w-4" /> Add</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3"><Award className="h-4 w-4 text-primary" /><h4 className="font-display text-lg font-bold uppercase tracking-wider">Awards</h4></div>
        {portfolio.awards.map((item) => editing?.kind === "award" && editing.id === item.id ? (
          <div key={item.id} className="grid gap-3 rounded-md border border-primary/50 bg-card p-4 sm:grid-cols-2">
            <input value={awardDraft.title} onChange={(event) => setAwardDraft({ ...awardDraft, title: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Award title" />
            <input value={awardDraft.organization} onChange={(event) => setAwardDraft({ ...awardDraft, organization: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Organization" />
            <input value={awardDraft.category} onChange={(event) => setAwardDraft({ ...awardDraft, category: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Category" />
            <input type="number" value={awardDraft.year} onChange={(event) => setAwardDraft({ ...awardDraft, year: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Year" />
            <input type="url" value={awardDraft.link} onChange={(event) => setAwardDraft({ ...awardDraft, link: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:col-span-2" placeholder="Proof or announcement link (optional)" />
            <div className="flex gap-2 sm:col-span-2"><Button type="button" size="sm" onClick={() => void finish(`award-${item.id}`, async () => { await request(`/api/professionals/me/awards/${item.id}`, "PATCH", { title: awardDraft.title, organization: awardDraft.organization || null, category: awardDraft.category || null, year: yearValue(awardDraft.year), link: awardDraft.link || null }); setEditing(null); })} disabled={saving === `award-${item.id}`}><Save className="mr-2 h-3.5 w-3.5" /> Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        ) : (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-4">
            <div><p className="font-bold">{item.title}{item.year ? <span className="ml-2 text-primary">· {item.year}</span> : null}</p><p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{[item.organization, item.category].filter(Boolean).join(" · ")}</p>{item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">View record <ExternalLink className="h-3 w-3" /></a>}</div>
            <div className="flex shrink-0"><Button type="button" size="icon" variant="ghost" onClick={() => { setAwardDraft({ title: item.title, organization: item.organization ?? "", category: item.category ?? "", year: item.year?.toString() ?? "", link: item.link ?? "" }); setEditing({ kind: "award", id: item.id }); }} aria-label={`Edit ${item.title}`}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => void finish(`delete-award-${item.id}`, () => request(`/api/professionals/me/awards/${item.id}`, "DELETE"))} aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
          </div>
        ))}
        <div className="grid gap-3 rounded-md border border-dashed border-border p-4 sm:grid-cols-2">
          <input value={awardDraft.title} onChange={(event) => setAwardDraft({ ...awardDraft, title: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Award title" />
          <input value={awardDraft.organization} onChange={(event) => setAwardDraft({ ...awardDraft, organization: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Organization" />
          <input value={awardDraft.category} onChange={(event) => setAwardDraft({ ...awardDraft, category: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Category (optional)" />
          <input type="number" value={awardDraft.year} onChange={(event) => setAwardDraft({ ...awardDraft, year: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Year (optional)" />
          <input type="url" value={awardDraft.link} onChange={(event) => setAwardDraft({ ...awardDraft, link: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm sm:col-span-2" placeholder="Proof or announcement link (optional)" />
          <Button type="button" variant="outline" onClick={() => void finish("add-award", async () => { await request("/api/professionals/me/awards", "POST", { title: awardDraft.title, organization: awardDraft.organization || null, category: awardDraft.category || null, year: yearValue(awardDraft.year), link: awardDraft.link || null }); setAwardDraft({ title: "", organization: "", category: "", year: "", link: "" }); })} disabled={!awardDraft.title.trim() || saving === "add-award"}><Plus className="mr-2 h-4 w-4" /> Add award</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3"><Newspaper className="h-4 w-4 text-primary" /><h4 className="font-display text-lg font-bold uppercase tracking-wider">Interviews</h4></div>
        {portfolio.interviews.map((item) => editing?.kind === "interview" && editing.id === item.id ? (
          <div key={item.id} className="grid gap-3 rounded-md border border-primary/50 bg-card p-4 sm:grid-cols-2">
            <input value={interviewDraft.title} onChange={(event) => setInterviewDraft({ ...interviewDraft, title: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Interview title" />
            <input value={interviewDraft.publication} onChange={(event) => setInterviewDraft({ ...interviewDraft, publication: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Publication" />
            <input type="number" value={interviewDraft.year} onChange={(event) => setInterviewDraft({ ...interviewDraft, year: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Year (optional)" />
            <input type="url" value={interviewDraft.url} onChange={(event) => setInterviewDraft({ ...interviewDraft, url: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="https://..." />
            <div className="flex gap-2 sm:col-span-2"><Button type="button" size="sm" onClick={() => void finish(`interview-${item.id}`, async () => { await request(`/api/professionals/me/interviews/${item.id}`, "PATCH", { title: interviewDraft.title, publication: interviewDraft.publication, year: yearValue(interviewDraft.year), url: interviewDraft.url }); setEditing(null); })} disabled={saving === `interview-${item.id}`}><Save className="mr-2 h-3.5 w-3.5" /> Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        ) : (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-4">
            <div><a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:text-primary">{item.title} <ExternalLink className="ml-1 inline h-3 w-3" /></a><p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{item.publication}{item.year ? ` · ${item.year}` : ""}</p></div>
            <div className="flex shrink-0"><Button type="button" size="icon" variant="ghost" onClick={() => { setInterviewDraft({ title: item.title, publication: item.publication, year: item.year?.toString() ?? "", url: item.url }); setEditing({ kind: "interview", id: item.id }); }} aria-label={`Edit ${item.title}`}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => void finish(`delete-interview-${item.id}`, () => request(`/api/professionals/me/interviews/${item.id}`, "DELETE"))} aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
          </div>
        ))}
        <div className="grid gap-3 rounded-md border border-dashed border-border p-4 sm:grid-cols-2">
          <input value={interviewDraft.title} onChange={(event) => setInterviewDraft({ ...interviewDraft, title: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Interview title" />
          <input value={interviewDraft.publication} onChange={(event) => setInterviewDraft({ ...interviewDraft, publication: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Publication" />
          <input type="number" value={interviewDraft.year} onChange={(event) => setInterviewDraft({ ...interviewDraft, year: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="Year (optional)" />
          <input type="url" value={interviewDraft.url} onChange={(event) => setInterviewDraft({ ...interviewDraft, url: event.target.value })} className="h-10 rounded-md border border-input bg-card px-3 text-sm" placeholder="https://..." />
          <Button type="button" variant="outline" onClick={() => void finish("add-interview", async () => { await request("/api/professionals/me/interviews", "POST", { title: interviewDraft.title, publication: interviewDraft.publication, year: yearValue(interviewDraft.year), url: interviewDraft.url }); setInterviewDraft({ title: "", publication: "", year: "", url: "" }); })} disabled={!interviewDraft.title.trim() || !interviewDraft.publication.trim() || !interviewDraft.url.trim() || saving === "add-interview"}><Plus className="mr-2 h-4 w-4" /> Add interview</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3"><MessageCircle className="h-4 w-4 text-primary" /><h4 className="font-display text-lg font-bold uppercase tracking-wider">Audience room</h4></div>
        <p className="text-xs leading-relaxed text-muted-foreground">Thoughtful questions arrive here first. Publish an answer when you are ready, or hide anything that does not belong in your public conversation.</p>
        {portfolio.questions.length === 0 ? <div className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">No audience questions yet.</div> : portfolio.questions.map((item) => (
          <div key={item.id} className="space-y-3 rounded-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm leading-relaxed">{item.question}</p><span className={`rounded-sm border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${item.status === "published" ? "border-primary/40 bg-primary/10 text-primary" : item.status === "hidden" ? "border-border text-muted-foreground" : "border-amber-500/40 bg-amber-500/10 text-amber-500"}`}>{item.status}</span></div>
            <textarea value={questionAnswers[item.id] ?? item.answer ?? ""} onChange={(event) => setQuestionAnswers((current) => ({ ...current, [item.id]: event.target.value }))} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Write an answer for your audience..." aria-label={`Answer question: ${item.question}`} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void finish(`publish-question-${item.id}`, () => request(`/api/professionals/me/questions/${item.id}`, "PATCH", { answer: questionAnswers[item.id] ?? item.answer ?? "", status: "published" }))} disabled={saving === `publish-question-${item.id}`}>Publish answer</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void finish(`hide-question-${item.id}`, () => request(`/api/professionals/me/questions/${item.id}`, "PATCH", { status: "hidden" }))} disabled={saving === `hide-question-${item.id}`}>Hide</Button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </section>
  );
}

export default function Professionals() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [savedProfile, setSavedProfile] = useState<ProfileWorkspaceData | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [roles, setRoles] = useState("");
  const [bio, setBio] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [demoReelUrl, setDemoReelUrl] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("open_to_projects");
  const [skills, setSkills] = useState("");
  const [agencyContact, setAgencyContact] = useState("");
  const [imdbLink, setImdbLink] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioEvidence>({ work: [], auditions: [], media: [], influences: [], awards: [], interviews: [], questions: [] });
  const [workDraft, setWorkDraft] = useState({ projectName: "", role: "", year: "", movieId: "", collaborators: "", description: "" });
  const [editingWorkId, setEditingWorkId] = useState<number | null>(null);
  const [editingWorkDraft, setEditingWorkDraft] = useState({ projectName: "", role: "", year: "", movieId: "", collaborators: "", description: "" });
  const [savingWorkId, setSavingWorkId] = useState<number | null>(null);
  const [auditionTitle, setAuditionTitle] = useState("");
  const [auditionDescription, setAuditionDescription] = useState("");
  const [auditionPublic, setAuditionPublic] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: professionals, isLoading } = useSearchProfessionals({ q: "" });
  const { data: myProfile } = useGetMyProfessionalProfile({
    query: {
      queryKey: getGetMyProfessionalProfileQueryKey(),
      enabled: isLoaded && !!isSignedIn,
      retry: false,
    },
  });
  const createProfile = useCreateProfessionalProfile();
  const updateProfile = useUpdateProfessionalProfile();
  const profileForForm = myProfile ?? savedProfile;

  useEffect(() => {
    if (!myProfile) return;
    setDisplayName(myProfile.displayName ?? "");
    setRoles(myProfile.roles?.join(", ") ?? "");
    setSkills(myProfile.skills?.join(", ") ?? "");
    setBio(myProfile.bio ?? "");
    setHeadshotUrl(myProfile.headshotUrl ?? "");
    setDemoReelUrl(myProfile.demoReelUrl ?? "");
    setAvailabilityStatus(myProfile.availabilityStatus ?? "open_to_projects");
    setAgencyContact(myProfile.agencyContact ?? "");
    setImdbLink(myProfile.imdbLink ?? "");
  }, [myProfile]);

  const loadPortfolio = async () => {
    if (!isSignedIn) return;
    const response = await apiFetch("/api/professionals/me/portfolio");
    if (response.ok) {
      const data = await response.json();
       setPortfolio({
         work: data.work ?? [],
         auditions: data.auditions ?? [],
         media: data.media ?? [],
         influences: data.influences ?? [],
         awards: data.awards ?? [],
         interviews: data.interviews ?? [],
         questions: data.questions ?? [],
       });
    }
  };
  useEffect(() => { void loadPortfolio(); }, [isSignedIn, myProfile?.id]);
  useEffect(() => {
    if (!isSignedIn) setSavedProfile(null);
  }, [isSignedIn]);

  const submitProfile = async () => {
    setFormError(null);
    setFormMessage(null);
    const parsedRoles = roles.split(",").map((role) => role.trim()).filter(Boolean);
    if (parsedRoles.length === 0) {
      setFormError("Add at least one role, for example Director or Writer.");
      return;
    }
    const data = {
      displayName: displayName.trim() || user?.fullName || undefined,
      roles: parsedRoles,
      skills: skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      bio: bio.trim() || undefined,
      headshotUrl: headshotUrl.trim() || undefined,
      demoReelUrl: demoReelUrl.trim() || undefined,
      availabilityStatus: availabilityStatus as "available" | "not_available" | "open_to_projects",
      agencyContact: agencyContact.trim() || undefined,
      imdbLink: imdbLink.trim() || undefined,
    };
    try {
      const profileMethod = profileForForm ? "PATCH" : "POST";
      console.info("[professionals] profile save started", { method: profileMethod });
      const savedProfileResponse = profileForForm
        ? await updateProfile.mutateAsync({ data } as never)
        : await createProfile.mutateAsync({ data } as never);
      console.info("[professionals] profile save succeeded", { method: profileMethod });
      queryClient.setQueryData(getGetMyProfessionalProfileQueryKey(), savedProfileResponse);
      setSavedProfile(savedProfileResponse as ProfileWorkspaceData);
      setFormMessage(profileForForm ? "Your professional profile has been updated." : "Your professional profile has been created.");
      setShowProfileForm(false);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetMyProfessionalProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ["/api/professionals/search"] }),
      ]);
    } catch (error) {
      console.error("[professionals] profile save failed", error);
      setFormError(error instanceof Error ? error.message : "We couldn't save your profile. Please check the details and try again.");
    }
  };

  const handleProfileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitProfile();
  };

  const addWork = async () => {
    const response = await apiFetch("/api/professionals/me/work", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...workDraft,
      year: workDraft.year ? Number(workDraft.year) : null,
      movieId: workDraft.movieId ? Number(workDraft.movieId) : null,
      collaborators: workDraft.collaborators.split(",").map((item) => item.trim()).filter(Boolean),
    }) });
    if (response.ok) {
      setWorkDraft({ projectName: "", role: "", year: "", movieId: "", collaborators: "", description: "" });
      void loadPortfolio();
    } else {
      const body = await response.json().catch(() => null);
      setFormError(body?.error || "Could not add this project.");
    }
  };
  const startEditingWork = (entry: WorkEntry) => {
    setFormError(null);
    setEditingWorkId(entry.id);
    setEditingWorkDraft({
      projectName: entry.projectName,
      role: entry.role,
      year: entry.year?.toString() ?? "",
      movieId: entry.movieId?.toString() ?? "",
      collaborators: entry.collaborators.join(", "),
      description: entry.description ?? "",
    });
  };
  const cancelEditingWork = () => {
    setEditingWorkId(null);
    setEditingWorkDraft({ projectName: "", role: "", year: "", movieId: "", collaborators: "", description: "" });
  };
  const saveWork = async (id: number) => {
    setSavingWorkId(id);
    setFormError(null);
    try {
      const response = await apiFetch(`/api/professionals/me/work/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingWorkDraft,
          year: editingWorkDraft.year ? Number(editingWorkDraft.year) : null,
          movieId: editingWorkDraft.movieId ? Number(editingWorkDraft.movieId) : null,
          collaborators: editingWorkDraft.collaborators.split(",").map((item) => item.trim()).filter(Boolean),
          description: editingWorkDraft.description.trim() || null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save this project.");
      }
      cancelEditingWork();
      await loadPortfolio();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this project.");
    } finally {
      setSavingWorkId(null);
    }
  };
  const removeWork = async (id: number) => {
    const response = await apiFetch(`/api/professionals/me/work/${id}`, { method: "DELETE" });
    if (response.ok) {
      if (editingWorkId === id) cancelEditingWork();
      void loadPortfolio();
    } else {
      setFormError("Could not remove this project.");
    }
  };
  const uploadAudition = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !auditionTitle.trim()) { setFormError("Add an audition title and choose a file."); return; }
    setUploading(true); setFormError(null);
    try {
      const urlResponse = await apiFetch("/api/professionals/me/auditions/request-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
      const signed = await urlResponse.json();
      if (!urlResponse.ok) throw new Error(signed.error);
      const uploadResponse = await fetch(signed.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("File upload failed");
      const saveResponse = await apiFetch("/api/professionals/me/auditions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: auditionTitle.trim(), description: auditionDescription.trim() || null, objectPath: signed.objectPath, fileName: file.name, contentType: file.type, fileSize: file.size, isPublic: auditionPublic }) });
      if (!saveResponse.ok) throw new Error((await saveResponse.json()).error);
      setAuditionTitle(""); setAuditionDescription(""); setAuditionPublic(false); void loadPortfolio();
    } catch (error) { setFormError(error instanceof Error ? error.message : "Could not upload audition."); }
    finally { setUploading(false); event.target.value = ""; }
  };
  const removeAudition = async (id: number) => { await apiFetch(`/api/professionals/me/auditions/${id}`, { method: "DELETE" }); void loadPortfolio(); };
    const profileExists = Boolean(isSignedIn && profileForForm);
    useEffect(() => {
      if (window.location.hash !== "#auditions" || !profileExists) return;
      const timer = window.setTimeout(() => {
        document.getElementById("audition-room")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return () => window.clearTimeout(timer);
    }, [profileExists]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      <section className="bg-card border-b border-border px-4 pb-16 pt-32">
        <div className={`container mx-auto ${profileExists && profileForForm ? "max-w-5xl text-left" : "max-w-4xl text-center"}`}>
          {profileExists && profileForForm ? (
            <ProfileWorkspace
              profile={profileForForm}
              media={portfolio.media}
              onEdit={() => {
                setFormError(null);
                setFormMessage(null);
                setShowProfileForm(true);
              }}
              onMediaChanged={loadPortfolio}
            />
          ) : (
            <>
              <Briefcase className="mx-auto mb-6 h-16 w-16 text-primary" />
              <h1 className="mb-4 text-4xl font-bold uppercase tracking-tighter text-glow md:text-6xl">
                Industry Network
              </h1>
              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                Connect with verified directors, actors, cinematographers, and crew members.
                The professional side of FILMIO.
              </p>
              <Button
                type="button"
                size="lg"
                className="group gap-3 border border-primary/60 bg-primary px-6 font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_24px_rgba(245,158,11,0.2)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_0_34px_rgba(245,158,11,0.35)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                onClick={() => {
                  if (!isSignedIn) {
                    window.location.href = "/sign-in?redirect=/feed";
                    return;
                  }
                  navigate("/feed");
                }}
              >
                <UsersRound className="h-5 w-5" />
                Join FILMIO
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </>
          )}
          {showProfileForm && isSignedIn && (
            <form onSubmitCapture={(event) => event.preventDefault()} onSubmit={handleProfileSubmit} className="mx-auto mt-8 max-w-2xl space-y-4 rounded-md border border-border bg-background/70 p-6 text-left">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">
                  Display name
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={user?.fullName ?? "Your name"} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" />
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">
                  Roles
                   <input list="professional-role-options" value={roles} onChange={(event) => setRoles(event.target.value)} placeholder="Director, Writer" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" required />
                   <datalist id="professional-role-options">{SUPPORTED_ROLES.map((role) => <option value={role} key={role} />)}</datalist>
                </label>
              </div>
              <label className="block space-y-2 text-xs font-bold uppercase tracking-wider">
                Bio
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Tell audiences what you do..." rows={4} className="w-full rounded-md border border-input bg-card px-3 py-3 text-sm font-normal normal-case tracking-normal" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">Skills
                  <input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Acting, Editing, Dance" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" />
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">Agency / Contact
                  <input value={agencyContact} onChange={(event) => setAgencyContact(event.target.value)} placeholder="Manager or agency email" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">
                  Headshot URL
                  <input type="url" value={headshotUrl} onChange={(event) => setHeadshotUrl(event.target.value)} placeholder="https://..." className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" />
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">
                  Demo reel URL
                  <input type="url" value={demoReelUrl} onChange={(event) => setDemoReelUrl(event.target.value)} placeholder="https://..." className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" />
                </label>
              </div>
              <label className="block space-y-2 text-xs font-bold uppercase tracking-wider">
                Availability
                <select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value)} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal">
                  <option value="open_to_projects">Open to projects</option>
                  <option value="available">Available</option>
                  <option value="not_available">Not available</option>
                </select>
              </label>
              {profileForForm && (
                <div className="space-y-6 border-t border-border pt-6">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-xl uppercase tracking-wider"><Film className="h-5 w-5 text-primary" /> Work history</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Add movies, shows, theatre, ads, and the people you worked with.</p>
                  </div>
                  {portfolio.work.map((entry) => (
                    editingWorkId === entry.id ? (
                      <div key={entry.id} className="rounded-md border border-primary/50 bg-card p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs font-bold uppercase tracking-wider">
                            Project name
                            <input required value={editingWorkDraft.projectName} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, projectName: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal" />
                          </label>
                          <label className="space-y-1 text-xs font-bold uppercase tracking-wider">
                            Role
                            <input required value={editingWorkDraft.role} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, role: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal" />
                          </label>
                          <label className="space-y-1 text-xs font-bold uppercase tracking-wider">
                            Year
                            <input type="number" value={editingWorkDraft.year} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, year: event.target.value })} placeholder="Year" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal" />
                          </label>
                           <label className="space-y-1 text-xs font-bold uppercase tracking-wider">
                             FILMIO movie ID
                             <input type="number" value={editingWorkDraft.movieId} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, movieId: event.target.value })} placeholder="Optional link" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal" />
                           </label>
                          <label className="space-y-1 text-xs font-bold uppercase tracking-wider">
                            Collaborators
                            <input value={editingWorkDraft.collaborators} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, collaborators: event.target.value })} placeholder="Comma separated" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal" />
                          </label>
                          <label className="space-y-1 text-xs font-bold uppercase tracking-wider sm:col-span-2">
                            Description
                            <textarea value={editingWorkDraft.description} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, description: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal" />
                          </label>
                          <div className="flex gap-2 sm:col-span-2">
                            <Button type="button" size="sm" onClick={() => void saveWork(entry.id)} disabled={savingWorkId === entry.id} className="gap-2">
                              {savingWorkId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEditingWork} disabled={savingWorkId === entry.id} className="gap-2"><X className="h-4 w-4" /> Cancel</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={entry.id} className="flex items-start justify-between rounded-md border border-border bg-card p-3">
                        <div>
                          <p className="font-bold">{entry.projectName} <span className="text-primary">· {entry.role}</span></p>
                          <p className="text-xs text-muted-foreground">{entry.year || "Year not specified"} {entry.collaborators.length ? `· With ${entry.collaborators.join(", ")}` : ""}</p>
                          {entry.description && <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>}
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button type="button" size="icon" variant="ghost" onClick={() => startEditingWork(entry)} aria-label={`Edit ${entry.projectName}`}><Pencil className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => void removeWork(entry.id)} aria-label="Remove work"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    )
                  ))}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input required value={workDraft.projectName} onChange={(e) => setWorkDraft({ ...workDraft, projectName: e.target.value })} placeholder="Movie / project name" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input required value={workDraft.role} onChange={(e) => setWorkDraft({ ...workDraft, role: e.target.value })} placeholder="Your role (Actor, Director...)" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input type="number" value={workDraft.year} onChange={(e) => setWorkDraft({ ...workDraft, year: e.target.value })} placeholder="Year" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                     <input type="number" value={workDraft.movieId} onChange={(e) => setWorkDraft({ ...workDraft, movieId: e.target.value })} placeholder="FILMIO movie ID (optional)" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input value={workDraft.collaborators} onChange={(e) => setWorkDraft({ ...workDraft, collaborators: e.target.value })} placeholder="Worked with (comma separated)" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input value={workDraft.description} onChange={(e) => setWorkDraft({ ...workDraft, description: e.target.value })} placeholder="Short description (optional)" className="h-10 rounded-md border border-input bg-card px-3 text-sm sm:col-span-2" />
                     <Button type="button" onClick={() => void addWork()} variant="outline" className="w-fit gap-2"><Plus className="h-4 w-4" /> Add project</Button>
                   </div>
                </div>
              )}
              {profileForForm && (
                 <div id="audition-room" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
                  <div><h3 className="flex items-center gap-2 font-display text-xl uppercase tracking-wider"><Upload className="h-5 w-5 text-primary" /> Audition room</h3><p className="mt-1 text-xs text-muted-foreground">Upload video, audio, image, or PDF up to 500MB. Files are private unless you make them public.</p></div>
                  {portfolio.auditions.map((audition) => (
                    <div key={audition.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                      <div><p className="font-bold">{audition.title} <span className="text-xs text-primary">{audition.isPublic ? "PUBLIC" : "PRIVATE"}</span></p><p className="text-xs text-muted-foreground">{audition.fileName}</p></div>
                      <Button type="button" size="icon" variant="ghost" onClick={() => void removeAudition(audition.id)} aria-label="Remove audition"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={auditionTitle} onChange={(e) => setAuditionTitle(e.target.value)} placeholder="Audition title" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input value={auditionDescription} onChange={(e) => setAuditionDescription(e.target.value)} placeholder="Scene / character (optional)" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={auditionPublic} onChange={(e) => setAuditionPublic(e.target.checked)} /> Show on public profile</label>
                    <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 text-sm font-bold uppercase tracking-wider hover:bg-primary/20">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "Uploading..." : "Choose audition file"}
                      <input type="file" accept="video/*,audio/*,image/*,application/pdf" onChange={uploadAudition} disabled={uploading} className="sr-only" />
                    </label>
                  </div>
                </div>
              )}
               {profileForForm && <EvidenceEditor portfolio={portfolio} onChanged={loadPortfolio} />}
              {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void submitProfile()} disabled={createProfile.isPending || updateProfile.isPending} className="gap-2">
                  {createProfile.isPending || updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {profileForForm ? "Save Changes" : "Create Profile"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowProfileForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          {formMessage && (
            <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-4 rounded-md border border-primary/40 bg-primary/10 p-5 text-center shadow-[0_0_30px_rgba(245,158,11,0.08)]" role="status">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
                <Check className="h-5 w-5" />
                {formMessage}
              </div>
              <Button type="button" size="lg" onClick={() => navigate("/feed")} className="gap-2">
                Go to Social Feed <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {!profileExists && <main className="container mx-auto max-w-6xl px-4 py-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 animate-pulse bg-muted rounded-md" />
            ))}
          </div>
        ) : professionals && professionals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {professionals.map(pro => (
              <Link
                key={pro.id}
                 href={`/professionals/${pro.id}`}
              >
                <div className="group bg-card border border-border rounded-md overflow-hidden hover-elevate transition-all h-full flex flex-col cursor-pointer">
                  <div className="h-24 bg-gradient-to-br from-secondary to-background border-b border-border relative">
                    <img 
                      src={pro.headshotUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${pro.displayName}`}
                      alt={pro.displayName || "Professional"}
                      className="absolute -bottom-10 left-6 w-20 h-20 rounded-full border-4 border-card object-cover bg-muted group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute top-4 right-4">
                      {pro.verified && (
                        <div className="bg-background/80 backdrop-blur text-primary text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded flex items-center gap-1 border border-border">
                          <BadgeCheck className="w-3 h-3" /> Verified
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-14 px-6 pb-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold font-display uppercase tracking-wide group-hover:text-primary transition-colors flex items-center gap-2">
                      {pro.displayName}
                    </h3>
                    
                    <div className="flex flex-wrap gap-2 mt-3 mb-4">
                      {pro.roles?.map(role => (
                        <span key={role} className="text-xs uppercase tracking-widest font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                          {role}
                        </span>
                      ))}
                    </div>
                    
                    <p className="text-sm text-foreground/80 line-clamp-2 mt-auto">
                      {pro.bio || "No biography provided."}
                    </p>
                    
                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs font-medium uppercase tracking-widest">
                      <span className={
                        pro.availabilityStatus === "available" ? "text-green-500" :
                        pro.availabilityStatus === "open_to_projects" ? "text-primary" : "text-muted-foreground"
                      }>
                        {pro.availabilityStatus.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <CinemaEmptyState
            description="Nothing matches exactly. Try a shorter name, a different spelling, or explore the wider FILMIO catalogue."
            actions={[
              { label: "Explore discovery", href: "/discover", testId: "link-empty-professionals-browse" },
              { label: "Search again", href: "/search", testId: "link-empty-professionals-search-again" },
            ]}
          />
        )}
      </main>}
    </div>
  );
}
