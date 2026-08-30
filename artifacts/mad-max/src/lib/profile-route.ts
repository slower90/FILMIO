export function resolveProfileId(routeId?: string, currentUserId?: string) {
  return routeId?.trim() || currentUserId?.trim() || "";
}