import { Navbar } from "@/components/navbar";
import { useParams, Link } from "wouter";
import { useGetProfessionalProfile, useCreateConversation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BadgeCheck, PlayCircle, Mail, MessageSquare, ExternalLink, Briefcase } from "lucide-react";
import { useUser } from "@clerk/react";

export default function ProfessionalDetail() {
  const { id } = useParams();
  const proId = parseInt(id || "0", 10);
  const { user } = useUser();
  const createConversation = useCreateConversation();

  const { data: pro, isLoading } = useGetProfessionalProfile(proId, { query: { enabled: !!proId } });

  const handleMessage = () => {
    if (!pro || !user) return;
    // Assuming pro.userId maps to the user id to start a conversation with
    createConversation.mutate(
      { data: { participantId: pro.userId } },
      { onSuccess: (conv) => window.location.href = `/chat?conv=${conv.id}` }
    );
  };

  if (isLoading) return <div className="min-h-screen bg-background"><Navbar /></div>;
  if (!pro) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      <div className="bg-card border-b border-border pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
            <div className="shrink-0">
              <div className="relative inline-block">
                <img 
                  src={pro.headshotUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${pro.displayName}`}
                  alt={pro.displayName || "Professional"}
                  className="w-48 h-48 md:w-64 md:h-64 object-cover rounded-md border-4 border-background shadow-2xl"
                />
                {pro.verified && (
                  <div className="absolute -bottom-4 -right-4 bg-primary text-primary-foreground p-3 rounded-full border-4 border-card shadow-lg" title="Verified Professional">
                    <BadgeCheck className="w-8 h-8" />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 space-y-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight text-glow mb-2">
                  {pro.displayName}
                </h1>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  {pro.roles?.map(role => (
                    <span key={role} className="text-sm font-display uppercase tracking-widest font-bold text-primary bg-primary/10 px-3 py-1 rounded-sm border border-primary/20">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium uppercase tracking-widest">
                <div className={`px-3 py-1.5 rounded-sm border ${
                  pro.availabilityStatus === "available" ? "border-green-500/50 text-green-500 bg-green-500/10" :
                  pro.availabilityStatus === "open_to_projects" ? "border-primary/50 text-primary bg-primary/10" : 
                  "border-muted text-muted-foreground bg-muted/20"
                }`}>
                  {pro.availabilityStatus.replace(/_/g, " ")}
                </div>
                
                {pro.agencyContact && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="w-4 h-4" /> Agency Rep
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <Button size="lg" className="gap-2" onClick={handleMessage} disabled={createConversation.isPending}>
                  <MessageSquare className="w-5 h-5" />
                  Message
                </Button>
                
                {pro.demoReelUrl && (
                  <Button size="lg" variant="outline" className="gap-2" asChild>
                    <a href={pro.demoReelUrl} target="_blank" rel="noopener noreferrer">
                      <PlayCircle className="w-5 h-5" /> Demo Reel
                    </a>
                  </Button>
                )}

                {pro.imdbLink && (
                  <Button size="lg" variant="ghost" className="gap-2 text-muted-foreground hover:text-primary" asChild>
                    <a href={pro.imdbLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-5 h-5" /> IMDb
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-12">
            <section>
              <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-6 pb-2 border-b border-border">Biography</h2>
              <p className="text-lg text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {pro.bio || "No biography provided."}
              </p>
            </section>
            
            {pro.skills && pro.skills.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-6 pb-2 border-b border-border">Skills & Expertise</h2>
                <div className="flex flex-wrap gap-3">
                  {pro.skills.map(skill => (
                    <span key={skill} className="bg-secondary px-4 py-2 rounded-sm text-sm uppercase tracking-widest font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
          
          <div className="space-y-8">
            <div className="bg-card border border-border rounded-md p-6">
              <h3 className="font-display font-bold uppercase tracking-wider text-lg mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> Contact
              </h3>
              
              {pro.agencyContact ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Representation</p>
                  <p className="font-medium">{pro.agencyContact}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Contact directly via MAD MAX messaging.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
