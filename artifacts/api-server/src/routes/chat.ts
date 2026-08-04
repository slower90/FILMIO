import { Router, type IRouter } from "express";
import {
  db,
  conversationsTable,
  conversationParticipantsTable,
  chatMessagesTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateConversationBody, SendMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /chat/conversations
router.get("/chat/conversations", requireAuth as any, async (req: any, res): Promise<void> => {
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
    .where(sql`${conversationsTable.id} = ANY(${convIds})`)
    .orderBy(desc(conversationsTable.lastMessageAt));

  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const participants = await db
        .select({ userId: conversationParticipantsTable.userId })
        .from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.conversationId, conv.id));

      const participantIds = participants.map((p) => p.userId);
      const users = participantIds.length
        ? await db
            .select()
            .from(usersTable)
            .where(sql`${usersTable.clerkId} = ANY(${participantIds})`)
        : [];

      return {
        id: conv.id,
        participants: users.map((u) => ({
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
      };
    }),
  );
  res.json(enriched);
});

// POST /chat/conversations
router.post("/chat/conversations", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { participantId } = parsed.data;

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
  requireAuth as any,
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
    if (!part) {
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
          .where(sql`${usersTable.clerkId} = ANY(${senderIds})`)
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
  requireAuth as any,
  async (req: any, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    const parsed = SendMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        conversationId: id,
        senderId: req.userId,
        content: parsed.data.content,
      })
      .returning();

    await db
      .update(conversationsTable)
      .set({ lastMessage: parsed.data.content, lastMessageAt: new Date() })
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

export default router;
