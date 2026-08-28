import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListProfilesQueryKey,
  useListProfiles,
  useSelectProfile,
  type ViewingProfile,
} from "@workspace/api-client-react";

type ProfileContextValue = {
  profiles: ViewingProfile[];
  activeProfile: ViewingProfile | null;
  activeProfileId: number | null;
  isReady: boolean;
  isLoading: boolean;
  error: unknown;
  setActiveProfileId: (profileId: number) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const [activeProfileId, setActiveProfileIdState] = useState<number | null>(null);
  const { data: profiles = [], isLoading, isFetched, error } = useListProfiles({
    query: {
      enabled: isLoaded && !!isSignedIn,
      queryKey: getListProfilesQueryKey(),
    },
  });
  const selectProfile = useSelectProfile();
  const storageKey = user?.id ? `filmio-active-profile:${user.id}` : null;
  const profilesBelongToUser = !isSignedIn || !user?.id || profiles.every((profile) => profile.userId === user.id);
  const visibleProfiles = profilesBelongToUser ? profiles : [];

  useEffect(() => {
    setActiveProfileIdState(null);
    void queryClient.removeQueries({ queryKey: getListProfilesQueryKey() });
  }, [user?.id, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !profilesBelongToUser || !storageKey || !isFetched || visibleProfiles.length === 0) return;
    const saved = Number(window.localStorage.getItem(storageKey));
    const savedProfile = Number.isSafeInteger(saved) ? visibleProfiles.find((profile) => profile.id === saved) : undefined;
    const next = savedProfile ?? visibleProfiles.find((profile) => profile.isDefault) ?? visibleProfiles[0];
    setActiveProfileIdState(next.id);
    window.localStorage.setItem(storageKey, String(next.id));
  }, [isSignedIn, isFetched, profilesBelongToUser, storageKey, visibleProfiles]);

  const setActiveProfileId = useCallback((profileId: number) => {
    const next = visibleProfiles.find((profile) => profile.id === profileId);
    if (!next) return;
    setActiveProfileIdState(next.id);
    if (storageKey) window.localStorage.setItem(storageKey, String(next.id));
    selectProfile.mutate({ profileId: next.id });
    void queryClient.invalidateQueries();
  }, [queryClient, selectProfile, storageKey, visibleProfiles]);

  const activeProfile = useMemo(
    () => visibleProfiles.find((profile) => profile.id === activeProfileId) ?? visibleProfiles.find((profile) => profile.isDefault) ?? null,
    [activeProfileId, visibleProfiles],
  );
  const value = useMemo<ProfileContextValue>(() => ({
    profiles: visibleProfiles,
    activeProfile,
    activeProfileId: activeProfile?.id ?? null,
    isReady: isLoaded && (!isSignedIn || (isFetched && profilesBelongToUser)),
    isLoading: isSignedIn === true && (!isLoaded || isLoading),
    error,
    setActiveProfileId,
  }), [activeProfile, error, isFetched, isLoaded, isLoading, isSignedIn, profilesBelongToUser, setActiveProfileId, visibleProfiles]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useActiveProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useActiveProfile must be used inside ProfileProvider");
  return value;
}