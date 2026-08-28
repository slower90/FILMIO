export function isConversationUnread(
  lastMessageAt: string | null | undefined,
  readAt: string | null | undefined,
  isActive: boolean,
) {
  if (isActive || !lastMessageAt) return false;
  if (!readAt) return true;
  return new Date(lastMessageAt).getTime() > new Date(readAt).getTime();
}