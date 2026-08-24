import { Navbar } from "@/components/navbar";
import { Link, useParams } from "wouter";
import { getGetUserProfileQueryKey, getGetUserStatsQueryKey, getGetWatchlistQueryKey, getListReviewsQueryKey, useGetUserProfile, useGetUserStats, useListReviews, useFollowUser, useUnfollowUser, useGetWatchlist } from "@workspace/api-client-react";
import { ReviewCard } from "@/components/review-card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, UserPlus, UserMinus, ShieldCheck, LogOut, Bookmark, Heart, Star, Eye, ArrowLeft } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFollowPayload } from "@/lib/authenticated-flow-contracts";

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useUser();
  const { signOut } = useClerk();
  const isMe = currentUser?.id === id;

  const { data: profile, isLoading: loadingProfile } = useGetUserProfile(id || "", { query: { queryKey: getGetUserProfileQueryKey(id || ""), enabled: !!id } });
  const { data: stats } = useGetUserStats(id || "", { query: { queryKey: getGetUserStatsQueryKey(id || ""), enabled: !!id } });
  const { data: reviews } = useListReviews({ userId: id }, { query: { queryKey: getListReviewsQueryKey({ userId: id }), enabled: !!id } });
  const { data: myWatchlist } = useGetWatchlist({
    query: { queryKey: getGetWatchlistQueryKey(), enabled: !!id && isMe },
  });
  const likesReceived = reviews?.reduce((total, review) => total + (review.likesCount || 0), 0) ?? 0;
  const watchedCount = myWatchlist?.filter((entry) => entry.status === "watched").length ?? 0;
  
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const queryClient = useQueryClient();

  const handleFollowToggle = () => {
    if (!profile) return;
    if (profile.isFollowedByMe) {
      unfollowUser.mutate(createFollowPayload(profile.clerkId), {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(id || "") });
          void queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(id || "") });
        },
      });
    } else {
      followUser.mutate(createFollowPayload(profile.clerkId), {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(id || "") });
          void queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(id || "") });
        },
      });
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
          <Link
            href={currentUser ? "/discover" : "/"}
            className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
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
                 {!isMe ? (
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
                 ) : (
                   <Button
                     variant="outline"
                     className="gap-2 shrink-0 text-muted-foreground hover:border-destructive hover:text-destructive"
                     onClick={() => void signOut()}
                   >
                     <LogOut className="w-4 h-4" /> Sign Out
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
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 font-bold text-xl text-foreground">
                    <Star className="h-4 w-4 text-primary" />
                    {stats?.ratingsCount ?? 0}
                  </span>
                  <span className="text-muted-foreground text-xs">Movies Rated</span>
                </div>
                <Link href="/watchlist" className="flex flex-col transition-colors hover:text-primary">
                  <span className="flex items-center gap-1 font-bold text-xl text-foreground">
                    <Bookmark className="h-4 w-4 text-primary" />
                    {stats?.watchlistCount ?? 0}
                  </span>
                  <span className="text-muted-foreground text-xs">Watchlist</span>
                </Link>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 font-bold text-xl text-foreground">
                    <Heart className="h-4 w-4 text-primary" />
                    {likesReceived}
                  </span>
                  <span className="text-muted-foreground text-xs">Likes Received</span>
                </div>
                {isMe && (
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 font-bold text-xl text-foreground">
                      <Eye className="h-4 w-4 text-primary" />
                      {watchedCount}
                    </span>
                    <span className="text-muted-foreground text-xs">Movies Checked</span>
                  </div>
                )}
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
