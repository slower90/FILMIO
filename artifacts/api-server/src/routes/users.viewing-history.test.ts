import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import { createViewingHistoryRouter } from "./users";

type Movie = {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  voteAverage?: number | null;
};

function makeServer() {
  const history = new Map<string, Movie[]>();
  const repository = {
    async list(userId: string) {
      return history.get(userId) ?? [];
    },
    async merge(userId: string, movies: Movie[]) {
      const current = history.get(userId) ?? [];
      const merged = [...movies, ...current.filter((old) => !movies.some((movie) => movie.id === old.id))].slice(0, 12);
      history.set(userId, merged);
      return merged;
    },
    async clear(userId: string) {
      history.delete(userId);
    },
  };
  const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.header("x-test-user");
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as express.Request & { userId: string }).userId = userId;
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(createViewingHistoryRouter(repository, auth));
  return app.listen(0);
}

const movie = (id: number, title: string): Movie => ({ id, title, posterPath: null, releaseDate: null, voteAverage: 7 });

test("rejects unauthenticated history reads and writes", async () => {
  const server = makeServer();
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/users/me/viewing-history`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { method: "POST", body: JSON.stringify({ movies: [movie(1, "A")] }), headers: { "content-type": "application/json" } })).status, 401);
    assert.equal((await fetch(url, { method: "DELETE" })).status, 401);
  } finally {
    server.close();
  }
});

test("reads, merges, and clears only the signed-in account's history", async () => {
  const server = makeServer();
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/users/me/viewing-history`;
  const request = (user: string, init?: RequestInit) =>
    fetch(url, { ...init, headers: { "x-test-user": user, ...(init?.headers ?? {}) } });
  try {
    await request("alice", { method: "POST", body: JSON.stringify({ movies: [movie(1, "Alice movie")] }), headers: { "content-type": "application/json" } });
    await request("bob", { method: "POST", body: JSON.stringify({ movies: [movie(2, "Bob movie")] }), headers: { "content-type": "application/json" } });
    assert.deepEqual(await (await request("alice")).json(), [movie(1, "Alice movie")]);
    assert.deepEqual(await (await request("bob")).json(), [movie(2, "Bob movie")]);

    assert.equal((await request("alice", { method: "DELETE" })).status, 204);
    assert.deepEqual(await (await request("bob")).json(), [movie(2, "Bob movie")]);
    assert.deepEqual(await (await request("alice")).json(), []);
  } finally {
    server.close();
  }
});