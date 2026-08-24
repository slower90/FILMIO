export type ConversationDevice = {
  deviceId: string;
  userId: string;
  revoked?: boolean;
};

export function conversationAccessError(
  authenticatedUserId: string | null | undefined,
  participantIds: readonly string[],
): "unauthorized" | "forbidden" | null {
  if (!authenticatedUserId) return "unauthorized";
  return participantIds.includes(authenticatedUserId) ? null : "forbidden";
}

export function activeDeliveryDevices<T extends ConversationDevice>(
  devices: readonly T[],
): T[] {
  return devices.filter((device) => device.revoked !== true);
}