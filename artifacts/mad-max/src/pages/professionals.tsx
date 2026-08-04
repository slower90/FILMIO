import { Navbar } from "@/components/navbar";
import { useSearchProfessionals } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Briefcase, Camera, BadgeCheck } from "lucide-react";

export default function Professionals() {
  // Pass an empty string or basic params for full list; maybe there's a better default endpoint but we'll use search
  const { data: professionals, isLoading } = useSearchProfessionals({ q: "" });

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
            The professional side of MAD MAX.
          </p>
          <Button size="lg" variant="outline" className="gap-2">
            <Camera className="w-5 h-5" />
            Set Up Professional Profile
          </Button>
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
