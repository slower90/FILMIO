import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import { test } from "node:test";
import {
  cleanupExpiredStoryCandidate,
  createStoriesRouter,
  isOwnedStoryObjectPath,
  isStoryMediaType,
  type StoryCreateInput,
  type StoryRouteDependencies,
  type StoryRow,
  STORY_MAX_UPLOAD,
} from "./posts";

test("accepts only image and video media for stories", () => {
  assert.equal(isStoryMediaType("image/jpeg"), true);
  assert.equal(isStoryMediaType("video/mp4"), true);
  assert.equal(isStoryMediaType("audio/mpeg"), false);
  assert.equal(isStoryMediaType("application/pdf"), false);
  assert.equal(isStoryMediaType(undefined), false);
});

test("keeps story object paths scoped to the uploading account", () => {
  assert.equal(
    isOwnedStoryObjectPath("/objects/stories/user_123/asset", "user_123"),
    true,
  );
  assert.equal(
    isOwnedStoryObjectPath("/objects/stories/other_user/asset", "user_123"),
    false,
  );
  assert.equal(
    isOwnedStoryObjectPath("/objects/stories/user_123/../asset", "user_123"),
    false,
  );
});

test("bounds story uploads at 100MB", () => {
  assert.equal(STORY_MAX_UPLOAD, 100 * 1024 * 1024);
});

test("deletes story media before removing the expired story row", async () => {
  const calls: string[] = [];
  const removed = await cleanupExpiredStoryCandidate(
    {
      id: 7,
      authorId: "user_123",
      mediaUrl: "/objects/stories/user_123/asset",
      expiresAt: new Date("2026-08-26T12:00:00.000Z"),
    },
    {
      deleteMedia: async (mediaUrl) => {
        calls.push(`media:${mediaUrl}`);
      },
      deleteStory: async (storyId) => {
        calls.push(`story:${storyId}`);
        return true;
      },
      onFailure: () => {
        throw new Error("cleanup should not fail");
      },
    },
  );

  assert.equal(removed, true);
  assert.deepEqual(calls, [
    "media:/objects/stories/user_123/asset",
    "story:7",
  ]);
});

test("keeps an expired story retryable when media cleanup fails", async () => {
  let deleteStoryCalled = false;
  let loggedError: unknown;
  const removed = await cleanupExpiredStoryCandidate(
    {
      id: 8,
      authorId: "user_123",
      mediaUrl: "/objects/stories/user_123/asset",
      expiresAt: new Date("2026-08-26T12:00:00.000Z"),
    },
    {
      deleteMedia: async () => {
        throw new Error("storage unavailable");
      },
      deleteStory: async () => {
        deleteStoryCalled = true;
        return true;
      },
      onFailure: (error) => {
        loggedError = error;
      },
    },
  );

  assert.equal(removed, false);
  assert.equal(deleteStoryCalled, false);
  assert.ok(loggedError instanceof Error);
  assert.equal((loggedError as Error).message, "storage unavailable");
});

function makeStoryRow(
  input: Pick<StoryCreateInput, "authorId" | "content" | "mediaUrl" | "mediaType" | "mediaName" | "mediaSize" | "expiresAt"> & { id: number },
): StoryRow {
  return {
    story: {
      id: input.id,
      authorId: input.authorId,
      content: input.content,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      mediaName: input.mediaName,
      mediaSize: input.mediaSize,
      createdAt: new Date("2026-08-27T10:00:00.000Z"),
      expiresAt: input.expiresAt,
    },
    user: {
      clerkId: input.authorId,
      displayName: input.authorId === "alice" ? "Alice" : "Bob",
      username: input.authorId,
      avatarUrl: null,
    },
    professional: null,
  };
}

function makeStoryTestHarness(seed: StoryRow[] = []) {
  const stories = new Map(seed.map((row) => [row.story.id, row]));
  const deletedMedia: string[] = [];
  let nextId = Math.max(0, ...seed.map((row) => row.story.id)) + 1;

  const dependencies: StoryRouteDependencies = {
    listActive: async () => [...stories.values()].filter((row) => row.story.expiresAt > new Date()),
    create: async (input) => {
      const row = makeStoryRow({ ...input, id: nextId++ });
      stories.set(row.story.id, row);
      return row;
    },
    findActiveMedia: async (id, now) => {
      const row = stories.get(id);
      return row && row.story.expiresAt > now ? { mediaUrl: row.story.mediaUrl } : undefined;
    },
    deleteOwned: async (id, authorId) => {
      const row = stories.get(id);
      if (!row || row.story.authorId !== authorId) return undefined;
      stories.delete(id);
      return { id: row.story.id, mediaUrl: row.story.mediaUrl };
    },
    signObject: async (objectName, method) => ({
      url: `https://storage.test/${method}/${objectName}`,
      objectPath: `/objects/${objectName}`,
    }),
    deleteMedia: async (mediaUrl) => {
      deletedMedia.push(mediaUrl);
    },
  };

  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.header("x-test-user");
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as express.Request & { userId: string }).userId = userId;
    (req as any).log = {
      error: () => undefined,
      warn: () => undefined,
    };
    next();
  };

  const app = express();
  app.use(express.json());
  app.use("/api", createStoriesRouter(authMiddleware, dependencies));
  return { app, stories, deletedMedia };
}

async function withStoryServer<T>(
  harness: ReturnType<typeof makeStoryTestHarness>,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = await new Promise<Server>((resolve) => {
    const instance = harness.app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function storyRequest(
  baseUrl: string,
  userId: string | undefined,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (userId) headers.set("x-test-user", userId);
  const apiPath = path.startsWith("/api/") ? path : `/api${path}`;
  return fetch(`${baseUrl}${apiPath}`, { ...init, headers });
}

test("authenticated users can create text stories and read them from the active list", async () => {
  const harness = makeStoryTestHarness();

  await withStoryServer(harness, async (baseUrl) => {
    const createResponse = await storyRequest(baseUrl, "alice", "/stories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "  A late screening.  " }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { id: number; content: string; mediaUrl: string | null; isOwner: boolean };
    assert.equal(created.content, "A late screening.");
    assert.equal(created.mediaUrl, null);
    assert.equal(created.isOwner, true);

    const listResponse = await storyRequest(baseUrl, "alice", "/stories");
    assert.equal(listResponse.status, 200);
    const stories = await listResponse.json() as Array<{ id: number; content: string }>;
    assert.deepEqual(stories.map((story) => story.id), [created.id]);
    assert.equal(stories[0]?.content, "A late screening.");
  });
});

test("authenticated users can create media stories and retrieve active media through a signed redirect", async () => {
  const harness = makeStoryTestHarness();

  await withStoryServer(harness, async (baseUrl) => {
    const createResponse = await storyRequest(baseUrl, "alice", "/stories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "One frame from tonight.",
        mediaUrl: "/objects/stories/alice/frame.jpg",
        mediaType: "image/jpeg",
        mediaName: "frame.jpg",
        mediaSize: 2048,
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { id: number; mediaUrl: string | null };
    assert.equal(created.mediaUrl, `/api/stories/${created.id}/media`);

    const mediaResponse = await storyRequest(baseUrl, "alice", created.mediaUrl, { redirect: "manual" });
    assert.equal(mediaResponse.status, 302);
    assert.equal(mediaResponse.headers.get("location"), "https://storage.test/GET/stories/alice/frame.jpg");
  });
});

test("expired stories stay out of the active list and cannot serve media", async () => {
  const harness = makeStoryTestHarness([
    makeStoryRow({
      id: 11,
      authorId: "alice",
      content: "Yesterday's frame.",
      mediaUrl: "/objects/stories/alice/yesterday.jpg",
      mediaType: "image/jpeg",
      mediaName: "yesterday.jpg",
      mediaSize: 2048,
      expiresAt: new Date("2026-08-26T10:00:00.000Z"),
    }),
  ]);

  await withStoryServer(harness, async (baseUrl) => {
    const listResponse = await storyRequest(baseUrl, "bob", "/stories");
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), []);

    const mediaResponse = await storyRequest(baseUrl, "bob", "/stories/11/media");
    assert.equal(mediaResponse.status, 404);
    assert.deepEqual(await mediaResponse.json(), { error: "Story media not found or expired." });
  });
});

test("a different signed-in user cannot delete another user's story", async () => {
  const harness = makeStoryTestHarness([
    makeStoryRow({
      id: 12,
      authorId: "alice",
      content: "Keep this one.",
      mediaUrl: "/objects/stories/alice/keep.jpg",
      mediaType: "image/jpeg",
      mediaName: "keep.jpg",
      mediaSize: 2048,
      expiresAt: new Date("2026-08-28T10:00:00.000Z"),
    }),
  ]);

  await withStoryServer(harness, async (baseUrl) => {
    const deleteResponse = await storyRequest(baseUrl, "bob", "/stories/12", { method: "DELETE" });
    assert.equal(deleteResponse.status, 404);
    assert.equal(harness.stories.has(12), true);
    assert.deepEqual(harness.deletedMedia, []);
  });
});

test("owner deletion removes the story from the active list and deletes its media", async () => {
  const harness = makeStoryTestHarness([
    makeStoryRow({
      id: 13,
      authorId: "alice",
      content: "Final frame.",
      mediaUrl: "/objects/stories/alice/final.jpg",
      mediaType: "image/jpeg",
      mediaName: "final.jpg",
      mediaSize: 2048,
      expiresAt: new Date("2026-08-28T10:00:00.000Z"),
    }),
  ]);

  await withStoryServer(harness, async (baseUrl) => {
    const deleteResponse = await storyRequest(baseUrl, "alice", "/stories/13", { method: "DELETE" });
    assert.equal(deleteResponse.status, 204);
    assert.equal(harness.stories.has(13), false);
    assert.deepEqual(harness.deletedMedia, ["/objects/stories/alice/final.jpg"]);

    const listResponse = await storyRequest(baseUrl, "alice", "/stories");
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), []);
  });
});