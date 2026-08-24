import { Navbar } from "@/components/navbar";
import {
  useSearchProfessionals,
  useGetMyProfessionalProfile,
  useCreateProfessionalProfile,
  useUpdateProfessionalProfile,
  getGetMyProfessionalProfileQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Briefcase, Camera, BadgeCheck, Check, Loader2, Pencil, Plus, Trash2, Upload, Film, X } from "lucide-react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type WorkEntry = { id: number; projectName: string; role: string; year: number | null; collaborators: string[]; description?: string | null };
type Audition = { id: number; title: string; description?: string | null; fileName: string; contentType: string; fileSize: number; isPublic: boolean; createdAt: string };

export default function Professionals() {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const [showProfileForm, setShowProfileForm] = useState(false);
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
  const [portfolio, setPortfolio] = useState<{ work: WorkEntry[]; auditions: Audition[] }>({ work: [], auditions: [] });
  const [workDraft, setWorkDraft] = useState({ projectName: "", role: "", year: "", collaborators: "", description: "" });
  const [editingWorkId, setEditingWorkId] = useState<number | null>(null);
  const [editingWorkDraft, setEditingWorkDraft] = useState({ projectName: "", role: "", year: "", collaborators: "", description: "" });
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
    const response = await fetch("/api/professionals/me/portfolio");
    if (response.ok) setPortfolio(await response.json());
  };
  useEffect(() => { void loadPortfolio(); }, [isSignedIn, myProfile?.id]);

  const handleProfileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    const mutation = myProfile ? updateProfile : createProfile;
    mutation.mutate(
      { data } as never,
      {
        onSuccess: () => {
          setFormMessage(myProfile ? "Your professional profile was updated." : "Your professional profile is live.");
          setShowProfileForm(false);
          void queryClient.invalidateQueries({ queryKey: getGetMyProfessionalProfileQueryKey() });
          void queryClient.invalidateQueries({ queryKey: ["/api/professionals/search"] });
        },
        onError: () => setFormError("We couldn't save your profile. Please check the details and try again."),
      },
    );
  };

  const addWork = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/professionals/me/work", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...workDraft, year: workDraft.year || null, collaborators: workDraft.collaborators.split(",").map((item) => item.trim()).filter(Boolean),
    }) });
    if (response.ok) {
      setWorkDraft({ projectName: "", role: "", year: "", collaborators: "", description: "" });
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
      collaborators: entry.collaborators.join(", "),
      description: entry.description ?? "",
    });
  };
  const cancelEditingWork = () => {
    setEditingWorkId(null);
    setEditingWorkDraft({ projectName: "", role: "", year: "", collaborators: "", description: "" });
  };
  const saveWork = async (event: React.FormEvent, id: number) => {
    event.preventDefault();
    setSavingWorkId(id);
    setFormError(null);
    try {
      const response = await fetch(`/api/professionals/me/work/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingWorkDraft,
          year: editingWorkDraft.year || null,
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
    const response = await fetch(`/api/professionals/me/work/${id}`, { method: "DELETE" });
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
      const urlResponse = await fetch("/api/professionals/me/auditions/request-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
      const signed = await urlResponse.json();
      if (!urlResponse.ok) throw new Error(signed.error);
      const uploadResponse = await fetch(signed.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("File upload failed");
      const saveResponse = await fetch("/api/professionals/me/auditions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: auditionTitle.trim(), description: auditionDescription.trim() || null, objectPath: signed.objectPath, fileName: file.name, contentType: file.type, fileSize: file.size, isPublic: auditionPublic }) });
      if (!saveResponse.ok) throw new Error((await saveResponse.json()).error);
      setAuditionTitle(""); setAuditionDescription(""); setAuditionPublic(false); void loadPortfolio();
    } catch (error) { setFormError(error instanceof Error ? error.message : "Could not upload audition."); }
    finally { setUploading(false); event.target.value = ""; }
  };
  const removeAudition = async (id: number) => { await fetch(`/api/professionals/me/auditions/${id}`, { method: "DELETE" }); void loadPortfolio(); };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      {/* Hero */}
      <section className="bg-card border-b border-border pt-32 pb-16 text-center px-4">
        <div className="container mx-auto max-w-4xl">
          <Briefcase className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tighter mb-4 text-glow">
            Industry Network
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Connect with verified directors, actors, cinematographers, and crew members. 
            The professional side of FILMIO.
          </p>
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (!isSignedIn) {
                window.location.href = "/sign-in?redirect=/professionals";
                return;
              }
              setFormError(null);
              setFormMessage(null);
              setShowProfileForm((open) => !open);
            }}
          >
            <Camera className="w-5 h-5" />
            {myProfile ? "Edit Professional Profile" : "Set Up Professional Profile"}
          </Button>
          {showProfileForm && isSignedIn && (
            <form onSubmit={handleProfileSubmit} className="mx-auto mt-8 max-w-2xl space-y-4 rounded-md border border-border bg-background/70 p-6 text-left">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">
                  Display name
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={user?.fullName ?? "Your name"} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" />
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider">
                  Roles
                  <input value={roles} onChange={(event) => setRoles(event.target.value)} placeholder="Director, Writer" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-normal normal-case tracking-normal" required />
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
              {myProfile && (
                <div className="space-y-6 border-t border-border pt-6">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-xl uppercase tracking-wider"><Film className="h-5 w-5 text-primary" /> Work history</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Add movies, shows, theatre, ads, and the people you worked with.</p>
                  </div>
                  {portfolio.work.map((entry) => (
                    editingWorkId === entry.id ? (
                      <div key={entry.id} className="rounded-md border border-primary/50 bg-card p-4">
                        <form onSubmit={(event) => void saveWork(event, entry.id)} className="grid gap-3 sm:grid-cols-2">
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
                            Collaborators
                            <input value={editingWorkDraft.collaborators} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, collaborators: event.target.value })} placeholder="Comma separated" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal" />
                          </label>
                          <label className="space-y-1 text-xs font-bold uppercase tracking-wider sm:col-span-2">
                            Description
                            <textarea value={editingWorkDraft.description} onChange={(event) => setEditingWorkDraft({ ...editingWorkDraft, description: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal" />
                          </label>
                          <div className="flex gap-2 sm:col-span-2">
                            <Button type="submit" size="sm" disabled={savingWorkId === entry.id} className="gap-2">
                              {savingWorkId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEditingWork} disabled={savingWorkId === entry.id} className="gap-2"><X className="h-4 w-4" /> Cancel</Button>
                          </div>
                        </form>
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
                  <form onSubmit={addWork} className="grid gap-3 sm:grid-cols-2">
                    <input required value={workDraft.projectName} onChange={(e) => setWorkDraft({ ...workDraft, projectName: e.target.value })} placeholder="Movie / project name" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input required value={workDraft.role} onChange={(e) => setWorkDraft({ ...workDraft, role: e.target.value })} placeholder="Your role (Actor, Director...)" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input type="number" value={workDraft.year} onChange={(e) => setWorkDraft({ ...workDraft, year: e.target.value })} placeholder="Year" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input value={workDraft.collaborators} onChange={(e) => setWorkDraft({ ...workDraft, collaborators: e.target.value })} placeholder="Worked with (comma separated)" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
                    <input value={workDraft.description} onChange={(e) => setWorkDraft({ ...workDraft, description: e.target.value })} placeholder="Short description (optional)" className="h-10 rounded-md border border-input bg-card px-3 text-sm sm:col-span-2" />
                    <Button type="submit" variant="outline" className="w-fit gap-2"><Plus className="h-4 w-4" /> Add project</Button>
                  </form>
                </div>
              )}
              {myProfile && (
                <div className="space-y-4 border-t border-border pt-6">
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
              {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={createProfile.isPending || updateProfile.isPending} className="gap-2">
                  {createProfile.isPending || updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {myProfile ? "Save Changes" : "Create Profile"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowProfileForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          {formMessage && <p className="mx-auto mt-4 max-w-xl text-sm text-primary" role="status">{formMessage}</p>}
        </div>
      </section>

      <main className="container mx-auto px-4 py-16 max-w-6xl">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 animate-pulse bg-muted rounded-md" />
            ))}
          </div>
        ) : professionals && professionals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {professionals.map(pro => (
              <Link key={pro.id} href={`/professionals/${pro.id}`}>
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
          <div className="text-center py-20">
            <h2 className="text-2xl font-display uppercase tracking-widest text-muted-foreground">No professionals found</h2>
          </div>
        )}
      </main>
    </div>
  );
}
