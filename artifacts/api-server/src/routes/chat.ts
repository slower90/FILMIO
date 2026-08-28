import { Router, type IRouter } from "express";
import {
  db,
  conversationsTable,
  conversationParticipantsTable,
  chatMessagesTable,
  chatDevicesTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateConversationBody, SendMessageBody } from "@workspace/api-zod";
import { activeDeliveryDevices, conversationAccessError } from "./chat-security";

const deviceLinkChallenges = new Map<string, { userId: string; expiresAt: number }>();

export function createChatRouter(authMiddleware: any = requireAuth as any): IRouter {
const router: IRouter = Router();

async function resolveParticipantId(rawParticipantId: string) {
  const participantId = rawParticipantId.trim();
  if (!participantId) return null;
  const [user] = await db
    .select({ clerkId: usersTable.clerkId })
    .from(usersTable)
    .where(or(
      eq(usersTable.clerkId, participantId),
      sql`${usersTable.id}::text = ${participantId}`,
    ));
  return user?.clerkId ?? null;
}

router.post("/chat/device-links", authMiddleware, async (req: any, res): Promise<void> => {
  const { challenge } = req.body || {};
  if (typeof challenge !== "string" || challenge.length < 32 || challenge.length > 200) {
    res.status(400).json({ error: "A valid device link challenge is required" }); return;
  }
  deviceLinkChallenges.set(challenge, { userId: req.userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.status(201).json({ challenge, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
});

router.post("/chat/device-links/:challenge/complete", authMiddleware, async (req: any, res): Promise<void> => {
  const pending = deviceLinkChallenges.get(req.params.challenge);
  if (!pending || pending.expiresAt < Date.now()) {
    deviceLinkChallenges.delete(req.params.challenge);
    res.status(410).json({ error: "This device link has expired. Create a new code." }); return;
  }
  if (pending.userId !== req.userId) {
    res.status(403).json({ error: "This device link belongs to another account." }); return;
  }
  const { deviceId, publicKey, deviceName } = req.body || {};
  if (typeof deviceId !== "string" || typeof publicKey !== "string" || !deviceId || !publicKey) {
    res.status(400).json({ error: "deviceId and publicKey are required" }); return;
  }
  deviceLinkChallenges.delete(req.params.challenge);
  const [device] = await db.insert(chatDevicesTable).values({
    deviceId,
    publicKey,
    deviceName: deviceName ? String(deviceName).slice(0, 120) : "FILMIO linked device",
    userId: req.userId,
  }).onConflictDoUpdate({
    target: chatDevicesTable.deviceId,
    set: { publicKey, deviceName, revoked: false, lastSeenAt: new Date() },
  }).returning();
  res.status(201).json(device);
});

router.get("/chat/devices", authMiddleware, async (req: any, res): Promise<void> => {
  const devices = await db.select({
    deviceId: chatDevicesTable.deviceId, deviceName: chatDevicesTable.deviceName,
    publicKey: chatDevicesTable.publicKey, revoked: chatDevicesTable.revoked,
    createdAt: chatDevicesTable.createdAt, lastSeenAt: chatDevicesTable.lastSeenAt,
  }).from(chatDevicesTable).where(eq(chatDevicesTable.userId, req.userId));
  res.json(devices);
});

router.post("/chat/devices", authMiddleware, async (req: any, res): Promise<void> => {
  const { deviceId, publicKey, deviceName } = req.body || {};
  if (!deviceId || !publicKey || typeof deviceId !== "string" || typeof publicKey !== "string") {
    res.status(400).json({ error: "deviceId and publicKey are required" }); return;
  }
  const [device] = await db.insert(chatDevicesTable).values({
    deviceId, publicKey, deviceName: deviceName ? String(deviceName).slice(0, 120) : "FILMIO device", userId: req.userId,
  }).onConflictDoUpdate({ target: chatDevicesTable.deviceId, set: { publicKey, deviceName, revoked: false, lastSeenAt: new Date() } }).returning();
  res.status(201).json(device);
});

router.delete("/chat/devices/:deviceId", authMiddleware, async (req: any, res): Promise<void> => {
  const updated = await db.update(chatDevicesTable).set({ revoked: true, lastSeenAt: new Date() })
    .where(and(eq(chatDevicesTable.deviceId, req.params.deviceId), eq(chatDevicesTable.userId, req.userId))).returning();
  if (!updated.length) { res.status(404).json({ error: "Device not found" }); return; }
  res.status(204).end();
});

router.get("/chat/conversations/:id/devices", authMiddleware, async (req: any, res): Promise<void> => {
  const conversationId = Number(req.params.id);
  const [participant] = await db.select().from(conversationParticipantsTable).where(and(
    eq(conversationParticipantsTable.conversationId, conversationId), eq(conversationParticipantsTable.userId, req.userId),
  ));
  if (conversationAccessError(req.userId, participant ? [participant.userId] : [])) {
    res.status(403).json({ error: "Not a participant" }); return;
  }
  const participants = await db.select({ userId: conversationParticipantsTable.userId })
    .from(conversationParticipantsTable).where(eq(conversationParticipantsTable.conversationId, conversationId));
  const ids = participants.map((item) => item.userId);
  const devices = ids.length ? await db.select({
    deviceId: chatDevicesTable.deviceId, userId: chatDevicesTable.userId, publicKey: chatDevicesTable.publicKey,
  }).from(chatDevicesTable).where(and(inArray(chatDevicesTable.userId, ids), eq(chatDevicesTable.revoked, false))) : [];
  res.json(activeDeliveryDevices(devices));
});

// GET /chat/conversations
router.get("/chat/conversations", authMiddleware, async (req: any, res): Promise<void> => {
  // Get conversations where user is a participant
  const participations = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, req.userId));

  if (!participations.length) {
    res.json([]);
    return;
  }

  const convIds = participations.map((p) => p.conversationId);
  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(inArray(conversationsTable.id, convIds))
    .orderBy(desc(conversationsTable.lastMessageAt));

  const participantRows = await db
    .select({
      conversationId: conversationParticipantsTable.conversationId,
      user: usersTable,
    })
    .from(conversationParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.clerkId, conversationParticipantsTable.userId))
    .where(inArray(conversationParticipantsTable.conversationId, convIds));
  const usersByConversation = new Map<number, typeof participantRows>();
  for (const row of participantRows) {
    const rows = usersByConversation.get(row.conversationId) ?? [];
    rows.push(row);
    usersByConversation.set(row.conversationId, rows);
  }

  const enriched = conversations.map((conv) => ({
    id: conv.id,
    participants: (usersByConversation.get(conv.id) ?? []).map(({ user: u }) => ({
      id: String(u.id),
      clerkId: u.clerkId,
      username: u.username ?? null,
      displayName: u.displayName ?? null,
      bio: u.bio ?? null,
      avatarUrl: u.avatarUrl ?? null,
      isProfessional: u.isProfessional,
      credibilityScore: parseFloat(String(u.credibilityScore ?? "1.0")),
      followersCount: 0,
      followingCount: 0,
      reviewsCount: 0,
      isFollowedByMe: false,
      createdAt: u.createdAt.toISOString(),
    })),
    lastMessage: conv.lastMessage ?? null,
    lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
    createdAt: conv.createdAt.toISOString(),
  }));
  res.json(enriched);
});

// POST /chat/conversations
router.post("/chat/conversations", authMiddleware, async (req: any, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const participantId = await resolveParticipantId(parsed.data.participantId);
  if (!participantId) {
    res.status(404).json({ error: "That FILMIO member could not be found." });
    return;
  }
  if (participantId === req.userId) {
    res.status(400).json({ error: "You cannot start a conversation with yourself." });
    return;
  }

  // Check if conversation already exists between these two users
  const existing = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, req.userId));

  for (const { conversationId } of existing) {
    const [other] = await db
      .select()
      .from(conversationParticipantsTable)
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, conversationId),
          eq(conversationParticipantsTable.userId, participantId),
        ),
      );
    if (other) {
      const [conv] = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, conversationId));
      res.status(201).json({
        id: conv.id,
        participants: [],
        lastMessage: conv.lastMessage ?? null,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
        createdAt: conv.createdAt.toISOString(),
      });
      return;
    }
  }

  const [conv] = await db.insert(conversationsTable).values({}).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: req.userId },
    { conversationId: conv.id, userId: participantId },
  ]);

  res.status(201).json({
    id: conv.id,
    participants: [],
    lastMessage: null,
    lastMessageAt: null,
    createdAt: conv.createdAt.toISOString(),
  });
});

// GET /chat/conversations/:id/messages
router.get(
  "/chat/conversations/:id/messages",
  authMiddleware,
  async (req: any, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);

    // Verify participant
    const [part] = await db
      .select()
      .from(conversationParticipantsTable)
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, id),
          eq(conversationParticipantsTable.userId, req.userId),
        ),
      );
    if (conversationAccessError(req.userId, part ? [part.userId] : [])) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.conversationId, id))
      .orderBy(chatMessagesTable.createdAt);

    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    const users = senderIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(inArray(usersTable.clerkId, senderIds))
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.clerkId, u]));

    res.json(
      messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        content: m.content,
        senderName: userMap[m.senderId]?.displayName ?? null,
        senderAvatarUrl: userMap[m.senderId]?.avatarUrl ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    );
  },
);

// POST /chat/conversations/:id/messages
router.post(
  "/chat/conversations/:id/messages",
  authMiddleware,
  async (req: any, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    const parsed = SendMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [participant] = await db.select().from(conversationParticipantsTable).where(and(
      eq(conversationParticipantsTable.conversationId, id), eq(conversationParticipantsTable.userId, req.userId),
    ));
    if (conversationAccessError(req.userId, participant ? [participant.userId] : [])) {
      res.status(403).json({ error: "Not a participant" }); return;
    }
    let envelope: unknown;
    try {
      envelope = JSON.parse(parsed.data.content);
      if (
        !envelope ||
        typeof envelope !== "object" ||
         !("version" in envelope) ||
         envelope.version !== 2 ||
         !("algorithm" in envelope) ||
         envelope.algorithm !== "P-256-ECDH/HKDF-SHA-256/AES-GCM" ||
        !("senderDeviceId" in envelope) ||
        !("senderPublicKey" in envelope) ||
         !("createdAt" in envelope) ||
         !("recipients" in envelope) ||
         typeof envelope.recipients !== "object" ||
         Object.values(envelope.recipients as Record<string, unknown>).some((recipient) => {
           if (!recipient || typeof recipient !== "object") return true;
           const item = recipient as Record<string, unknown>;
           return typeof item.ephemeralPublicKey !== "string" || typeof item.iv !== "string" || typeof item.ciphertext !== "string";
         })
      ) throw new Error();
    } catch {
      res.status(400).json({ error: "Messages must be encrypted on the device before sending." }); return;
    }
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        conversationId: id,
        senderId: req.userId,
        content: JSON.stringify(envelope),
      })
      .returning();

    await db
      .update(conversationsTable)
      .set({ lastMessage: "[Encrypted message]", lastMessageAt: new Date() })
      .where(eq(conversationsTable.id, id));

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.userId));

    res.status(201).json({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      content: msg.content,
      senderName: user?.displayName ?? null,
      senderAvatarUrl: user?.avatarUrl ?? null,
      createdAt: msg.createdAt.toISOString(),
    });
  },
);

return router;
}

export default createChatRouter();
