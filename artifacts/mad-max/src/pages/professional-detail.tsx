import { Navbar } from "@/components/navbar";
import { ProfessionalMediaGallery, type ProfessionalMedia } from "@/components/professional-media-gallery";
import { useParams, Link } from "wouter";
import { useCreateConversation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Award, BadgeCheck, Briefcase, ExternalLink, Film, Loader2, Mail, MessageCircle, Newspaper, PlayCircle, Quote, Send, Sparkles } from "lucide-react";
import { useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { apiFetch, apiUrl } from "@/lib/api-url";

type WorkEntry = {
  id: number;
  projectName: string;
  role: string;
  year: number | null;
  movieId?: number | null;
  collaborators: string[];
  description?: string | null;
};
type Influence = { id: number; name: string; note?: string | null };
type AwardEntry = { id: number; title: string; organization?: string | null; category?: string | null; year?: number | null; link?: string | null };
type InterviewEntry = { id: number; title: string; publication: string; url: string; year?: number | null };
type AudienceQuestion = {
  id: number;
  question: string;
  answer?: string | null;
  status: "pending" | "published" | "hidden";
  createdAt?: string;
  asker?: { displayName?: string | null };
};
type Portfolio = {
  workHistory: WorkEntry[];
  publicAuditions: Array<{ id: number; title: string; description?: string | null; fileName: string; contentType: string }>;
  media: ProfessionalMedia[];
  influences: Influence[];
  awards: AwardEntry[];
  interviews: InterviewEntry[];
  questions: AudienceQuestion[];
};
type PublicProfile = {
  id: number;
  userId: string;
  displayName?: string | null;
  headshotUrl?: string | null;
  demoReelUrl?: string | null;
  bio?: string | null;
  roles: string[];
  skills: string[];
  agencyContact?: string | null;
  availabilityStatus: string;
  verified: boolean;
  imdbLink?: string | null;
};

const emptyPortfolio: Portfolio = { workHistory: [], publicAuditions: [], media: [], influences: [], awards: [], interviews: [], questions: [] };

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

function SectionHeading({ icon: Icon, children }: { icon: typeof Film; children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3 border-b border-border pb-3">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="font-display text-2xl font-bold uppercase tracking-wider">{children}</h2>
    </div>
  );
}

export default function ProfessionalDetail() {
  const { id } = useParams();
  const proId = Number.parseInt(id || "0", 10);
  const { user, isSignedIn } = useUser();
  const createConversation = useCreateConversation();
  const [pro, setPro] = useState<PublicProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>(emptyPortfolio);
  const [question, setQuestion] = useState("");
  const [questionNotice, setQuestionNotice] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!proId) return;
    setLoadingProfile(true);
    setProfileError(null);
    apiFetch(`/api/professionals/${proId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("This professional profile is unavailable right now.");
        return response.json();
      })
      .then((data) => {
        setPro(data);
        setPortfolio({
          workHistory: data.workHistory ?? [],
          publicAuditions: data.publicAuditions ?? [],
          media: data.media ?? [],
          influences: data.influences ?? [],
          awards: data.awards ?? [],
          interviews: data.interviews ?? [],
          questions: data.questions ?? [],
        });
      })
      .catch((error) => setProfileError(error instanceof Error ? error.message : "This professional profile is unavailable right now."))
      .finally(() => setLoadingProfile(false));
  }, [proId]);

  const handleMessage = () => {
    if (!pro || !user) {
      window.location.href = `/sign-in?redirect=/professionals/${proId}`;
      return;
    }
    createConversation.mutate({ data: { participantId: pro.userId } }, {
      onSuccess: (conversation) => { window.location.href = `/chat?conv=${conversation.id}`; },
    });
  };

  const submitQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    setQuestionNotice(null);
    setQuestionError(null);
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect=/professionals/${proId}`;
      return;
    }
    if (trimmed.length < 10 || trimmed.length > 1000) {
      setQuestionError("Write a thoughtful question between 10 and 1,000 characters.");
      return;
    }
    setAsking(true);
    try {
      const response = await apiFetch(`/api/professionals/${proId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Your question could not be submitted.");
      setQuestion("");
      setQuestionNotice("Your question is with the filmmaker for review.");
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "Your question could not be submitted.");
    } finally {
      setAsking(false);
    }
  };

  if (loadingProfile) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 pt-32"><div className="h-72 animate-pulse rounded-md bg-muted" /></div></div>;
  if (!pro) return <div className="min-h-screen bg-background"><Navbar /><main className="container mx-auto px-4 pt-32 text-center"><Film className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-5 font-display text-3xl font-bold uppercase">Profile unavailable</h1><p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{profileError || "This professional record could not be found."}</p><Link href="/professionals" className="mt-6 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><ArrowLeft className="h-4 w-4" /> Back to professionals</Link></main></div>;

  return (
    <div className="film-grain min-h-screen bg-background pb-20">
      <Navbar />
      <header className="border-b border-border bg-card pt-28">
        <div className="container mx-auto max-w-6xl px-4 pb-12">
          <Link href="/professionals" className="mb-8 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Industry professionals</Link>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end">
            <div className="relative shrink-0">
              <img src={pro.headshotUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${pro.displayName || "FILMIO"}`} alt={pro.displayName || "Professional"} className="h-40 w-40 rounded-md border-4 border-background object-cover shadow-2xl sm:h-52 sm:w-52" />
              {pro.verified && <div className="absolute -bottom-3 -right-3 flex items-center gap-2 rounded-full border-4 border-card bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg"><BadgeCheck className="h-4 w-4" /> Verified</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">FILMIO / industry record</p>
                  <h1 className="mt-3 text-4xl font-bold uppercase tracking-tight text-glow sm:text-6xl">{pro.displayName || "FILMIO Professional"}</h1>
                  <div className="mt-5 flex flex-wrap gap-2">{pro.roles?.map((role) => <span key={role} className="rounded-sm border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">{role}</span>)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" onClick={handleMessage} disabled={createConversation.isPending} className="gap-2"><MessageCircle className="h-5 w-5" /> {createConversation.isPending ? "Opening…" : "Message"}</Button>
                  {pro.demoReelUrl && <Button size="lg" variant="outline" asChild className="gap-2"><a href={pro.demoReelUrl} target="_blank" rel="noopener noreferrer"><PlayCircle className="h-5 w-5" /> Demo reel</a></Button>}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-widest">
                <span className={`rounded-sm border px-3 py-1.5 ${pro.availabilityStatus === "available" ? "border-green-500/50 bg-green-500/10 text-green-500" : pro.availabilityStatus === "open_to_projects" ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/20 text-muted-foreground"}`}>{pro.availabilityStatus.replace(/_/g, " ")}</span>
                {pro.agencyContact && <span className="flex items-center gap-1.5 text-muted-foreground"><Briefcase className="h-4 w-4" /> Representation available</span>}
                {pro.imdbLink && <a href={pro.imdbLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">IMDb ↗</a>}
              </div>
              {pro.bio && <p className="mt-6 max-w-3xl whitespace-pre-wrap text-base leading-8 text-foreground/75">{pro.bio}</p>}
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4">
            {[["Filmography", portfolio.workHistory.length], ["Influences", portfolio.influences.length], ["Awards", portfolio.awards.length], ["Interviews", portfolio.interviews.length]].map(([label, value]) => <div key={String(label)} className="bg-background/80 px-4 py-4"><p className="font-display text-2xl font-bold text-primary">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p></div>)}
          </div>
        </div>
      </header>

      <main className="container mx-auto grid max-w-6xl gap-12 px-4 py-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-14">
          {portfolio.workHistory.length > 0 && <section><SectionHeading icon={Film}>Filmography / career timeline</SectionHeading><div className="relative ml-2 space-y-7 border-l border-primary/30 pl-7">{portfolio.workHistory.map((work) => <article key={work.id} className="relative rounded-md border border-border bg-card p-5 shadow-[0_18px_50px_-40px_hsl(var(--ink))]"><span className="absolute -left-[2.05rem] top-6 h-3 w-3 rounded-full border-2 border-background bg-primary" /><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-xl font-bold uppercase tracking-wide">{work.projectName}</h3>{work.year && <time className="text-sm font-bold text-primary">{work.year}</time>}</div><p className="mt-1 text-sm font-bold uppercase tracking-wider text-primary">{work.role}</p>{work.collaborators?.length > 0 && <p className="mt-3 text-sm text-muted-foreground">With {work.collaborators.join(", ")}</p>}{work.description && <p className="mt-3 text-sm leading-relaxed text-foreground/75">{work.description}</p>}</article>)}</div></section>}
          {portfolio.influences.length > 0 && <section><SectionHeading icon={Quote}>Creative influences</SectionHeading><div className="grid gap-4 sm:grid-cols-2">{portfolio.influences.map((item) => <article key={item.id} className="rounded-md border border-border bg-card p-5"><h3 className="font-display text-lg font-bold uppercase tracking-wide">{item.name}</h3>{item.note && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.note}</p>}</article>)}</div></section>}
          {portfolio.awards.length > 0 && <section><SectionHeading icon={Award}>Awards & recognition</SectionHeading><div className="grid gap-4 sm:grid-cols-2">{portfolio.awards.map((item) => <article key={item.id} className="rounded-md border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><Award className="h-5 w-5 shrink-0 text-primary" />{item.year && <span className="text-sm text-primary">{item.year}</span>}</div><h3 className="mt-4 font-display text-lg font-bold uppercase tracking-wide">{item.title}</h3><p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{[item.organization, item.category].filter(Boolean).join(" · ")}</p>{item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:underline">View record <ExternalLink className="h-3 w-3" /></a>}</article>)}</div></section>}
          {portfolio.interviews.length > 0 && <section><SectionHeading icon={Newspaper}>In conversation</SectionHeading><div className="space-y-3">{portfolio.interviews.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"><span><strong className="block font-display text-lg uppercase tracking-wide">{item.title}</strong><span className="mt-1 block text-xs uppercase tracking-widest text-muted-foreground">{item.publication}{item.year ? ` · ${item.year}` : ""}</span></span><ExternalLink className="h-4 w-4 shrink-0 text-primary" /></a>)}</div></section>}
          <section><SectionHeading icon={Sparkles}>Selected work</SectionHeading><ProfessionalMediaGallery media={portfolio.media} /></section>
          {portfolio.publicAuditions.length > 0 && <section><SectionHeading icon={PlayCircle}>Public audition reels</SectionHeading><div className="grid gap-3 sm:grid-cols-2">{portfolio.publicAuditions.map((audition) => <a key={audition.id} href={apiUrl(`/api/professionals/auditions/${audition.id}/file`)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md border border-border bg-card p-4 hover:border-primary"><PlayCircle className="h-8 w-8 shrink-0 text-primary" /><span><strong className="block">{audition.title}</strong><small className="text-muted-foreground">{audition.fileName}</small></span></a>)}</div></section>}
          <section><SectionHeading icon={MessageCircle}>Audience room</SectionHeading><div className="space-y-4">{portfolio.questions.length > 0 ? portfolio.questions.map((item) => <article key={item.id} className="rounded-md border border-border bg-card p-5"><div className="flex items-start gap-3"><MessageCircle className="mt-1 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm leading-relaxed text-foreground/80">{item.question}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.asker?.displayName || "FILMIO audience"} {formatDate(item.createdAt) && `· ${formatDate(item.createdAt)}`}</p>{item.answer && <div className="mt-4 border-l-2 border-primary/50 pl-4"><p className="text-sm leading-relaxed">{item.answer}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary">Response from {pro.displayName}</p></div>}</div></div></article>) : <p className="rounded-md border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">No public questions yet. Start the conversation with a thoughtful question.</p>}</div><form onSubmit={submitQuestion} className="mt-6 rounded-md border border-primary/25 bg-primary/5 p-5"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ask about the work<textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={4} placeholder="What would you like to understand about their process?" className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm normal-case tracking-normal text-foreground focus:border-primary focus:outline-none" /></label><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{question.length}/1,000 · Questions are reviewed before publishing.</span><Button type="submit" disabled={asking || !question.trim()} className="gap-2">{asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {isSignedIn ? "Submit question" : "Sign in to ask"}</Button></div>{questionNotice && <p className="mt-3 text-sm text-primary" role="status">{questionNotice}</p>}{questionError && <p className="mt-3 text-sm text-destructive" role="alert">{questionError}</p>}</form></section>
        </div>
        <aside className="space-y-6">
          <section className="rounded-md border border-border bg-card p-6"><h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wider"><Mail className="h-5 w-5 text-primary" /> Connect</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">For serious audience notes, collaborations, and questions about the craft, use FILMIO's direct bridge.</p><Button onClick={handleMessage} disabled={createConversation.isPending} className="mt-5 w-full gap-2"><MessageCircle className="h-4 w-4" /> Message {pro.displayName?.split(" ")[0] || "professional"}</Button></section>
          {pro.skills && pro.skills.length > 0 && <section className="rounded-md border border-border bg-card p-6"><h2 className="font-display text-lg font-bold uppercase tracking-wider">Craft & skills</h2><div className="mt-4 flex flex-wrap gap-2">{pro.skills.map((skill) => <span key={skill} className="rounded-sm bg-secondary px-2.5 py-1 text-xs uppercase tracking-wider text-muted-foreground">{skill}</span>)}</div></section>}
          <section className="rounded-md border border-border bg-card/60 p-6"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Profile note</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Verification is controlled by FILMIO. Portfolio evidence and audience responses are owned by the professional.</p></section>
        </aside>
      </main>
    </div>
  );
}