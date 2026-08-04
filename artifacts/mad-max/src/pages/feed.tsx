import { Navbar } from "@/components/navbar";
import { useGetFeed } from "@workspace/api-client-react";
import { ReviewCard } from "@/components/review-card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Users } from "lucide-react";

export default function Feed() {
  const { data: reviews, isLoading } = useGetFeed({ page: 1 });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 max-w-3xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-display font-bold uppercase tracking-wider text-glow">Following Activity</h1>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 w-full animate-pulse bg-card border border-border rounded-md" />
            ))}
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 border border-dashed border-border rounded-lg bg-card/50">
            <Users className="w-16 h-16 mx-auto mb-6 text-muted-foreground/30" />
            <h2 className="text-2xl font-display uppercase tracking-widest mb-4">It's quiet here</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              You aren't following anyone yet, or they haven't posted any reviews. Find industry professionals and critics to follow.
            </p>
            <Button asChild size="lg">
              <Link href="/professionals">Find People to Follow</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
