import { Navbar } from "@/components/navbar";
import { useParams } from "wouter";
import { useGetUserProfile, useGetUserStats, useListReviews, useFollowUser, useUnfollowUser } from "@workspace/api-client-react";
import { ReviewCard } from "@/components/review-card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, UserPlus, UserMinus, ShieldCheck } from "lucide-react";
import { useUser } from "@clerk/react";

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useUser();
  const isMe = currentUser?.id === id;

  const { data: profile, isLoading: loadingProfile } = useGetUserProfile(id || "", { query: { enabled: !!id } });
  const { data: stats } = useGetUserStats(id || "", { query: { enabled: !!id } });
  const { data: reviews } = useListReviews({ userId: id }, { query: { enabled: !!id } });
  
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const handleFollowToggle = () => {
    if (!profile) return;
    if (profile.isFollowedByMe) {
      unfollowUser.mutate({ params: { id: profile.id } });
    } else {
      followUser.mutate({ params: { id: profile.id } });
    }
  };

  if (loadingProfile) {
    return <div className="min-h-screen bg-background"><Navbar /></div>;
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      {/* Profile Header */}
      <div className="bg-card border-b border-border pt-32 pb-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="relative">
              <img 
                src={profile.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.displayName}`}
                alt={profile.displayName || "User"}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-background shadow-xl"
              />
              {profile.isProfessional && (
                <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full border-4 border-background" title="Verified Professional">
                  <BadgeCheck className="w-6 h-6" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight flex items-center gap-2">
                    {profile.displayName}
                  </h1>
                  <p className="text-muted-foreground font-medium mt-1">@{profile.username}</p>
                </div>
                
                {!isMe && (
                  <Button 
                    variant={profile.isFollowedByMe ? "outline" : "default"} 
                    className="gap-2 shrink-0"
                    onClick={handleFollowToggle}
                    disabled={followUser.isPending || unfollowUser.isPending}
                  >
                    {profile.isFollowedByMe ? (
                      <><UserMinus className="w-4 h-4" /> Unfollow</>
                    ) : (
                      <><UserPlus className="w-4 h-4" /> Follow</>
                    )}
                  </Button>
                )}
              </div>
              
              {profile.bio && (
                <p className="text-foreground/80 max-w-2xl text-sm leading-relaxed mb-6">
                  {profile.bio}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm uppercase tracking-widest font-display">
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-primary">{stats?.followersCount || profile.followersCount || 0}</span>
                  <span className="text-muted-foreground text-xs">Followers</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-foreground">{stats?.followingCount || profile.followingCount || 0}</span>
                  <span className="text-muted-foreground text-xs">Following</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-foreground">{stats?.reviewsCount || profile.reviewsCount || 0}</span>
                  <span className="text-muted-foreground text-xs">Reviews</span>
                </div>
                {profile.credibilityScore > 0 && (
                  <div className="flex flex-col">
                    <span className="font-bold text-xl text-primary flex items-center gap-1">
                      {profile.credibilityScore} <ShieldCheck className="w-4 h-4" />
                    </span>
                    <span className="text-muted-foreground text-xs">Credibility</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-8 pb-2 border-b border-border">
          Reviews by {profile.displayName}
        </h2>
        
        {reviews && reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            No reviews yet.
          </div>
        )}
      </main>
    </div>
  );
}
