---
name: GitHub sync fallback
description: When Git HTTPS credentials fail but the GitHub connector is healthy, use guarded GraphQL commits instead of force-pushing.
---

Use the authenticated GitHub connector's GraphQL commit flow as a safe fallback when Git HTTPS transport is unavailable but repository API access works. Guard each `createCommitOnBranch` mutation with the last verified branch head so concurrent remote changes reject instead of being overwritten.

**Why:** Git transport credentials and the Replit-managed GitHub connection can fail independently; the connector may still have repository write access.

**How to apply:** Verify the repository and branch head first, preserve remote-only paths, split large file changes into bounded commits, and re-read the branch head and target file blobs after the final commit.

GitHub connector reads and authentication can remain healthy while repeated content-write calls are blocked by the Replit/Cloudflare layer with an HTML 403 response.

**Why:** Retrying REST blobs, Contents API, or GraphQL mutations in a tight loop can leave only a partial sync while obscuring which ref actually moved.

**How to apply:** Re-read the branch after every successful guarded commit, stop repeated writes after the WAF response, and report the exact remote head plus remaining files instead of claiming a complete push.

For large existing files, validate the remote blob SHA, byte size, first line, and changed-file list after every connector write; a successful-looking commit can leave the old blob or a truncated payload in place.

**Why:** The GitHub connector accepted a malformed stylesheet write without changing the existing blob, and a raw shell read also truncated a large file; only a full workspace read plus Git Data blob/tree/ref update produced the correct remote file.

**How to apply:** Use `readFile` for complete workspace content, write existing files through the Git Data API when Contents/GraphQL results do not change the blob, and require exact local/remote blob SHA equality before declaring sync complete.

Large text payloads assembled from shell command output can be silently truncated near the durable callback output boundary even when a larger limit is requested.

**Why:** A connector commit accepted the truncated payload and produced plausible-looking but incomplete blobs for several files.

**How to apply:** For large syncs, split base64 into bounded chunks or use complete workspace reads, then compare every remote blob SHA and byte size against the local Git blob before declaring success.

After a cooldown, the connector's direct `proxyFetch` Git endpoints can sometimes complete small guarded writes when Octokit/GraphQL writes receive Cloudflare 403 responses; large web-source writes may remain blocked.

**Why:** The same authorized connection accepted small generated-file updates through proxyFetch but repeatedly rejected several larger MAD MAX page blobs.

**How to apply:** Treat each successful write as a separate verified commit, never assume a failed batch partially landed, and leave blocked paths explicitly reported with their remote SHA. Large multi-file durable payloads can trigger a sandbox pattern error even when single-blob writes work; split them only while the proxy remains healthy, then stop on the first WAF response.

Cloudflare can also reject one specific source path or payload while accepting adjacent files of similar size; final synchronization must therefore be verified per target blob, not inferred from the branch head alone.

**Why:** A Free Classics sync accepted backend, page, generated-contract, and most frontend files but repeatedly blocked one route-metadata source file across Contents, Git Data, blob, and GraphQL writes.

**How to apply:** Report the exact mismatching path and SHA, preserve the remote head, and do not claim a complete sync until every intended blob matches.

GraphQL branch and blob reads can remain available when the GitHub connector returns `Forbidden` for REST repository reads and its content-write paths reject larger source payloads with a sandbox pattern error.

**Why:** A delayed parity check could verify the remote head and 15 of 16 feature blobs through GraphQL, but guarded GraphQL and Git Data writes were rejected before GitHub accepted them.

**How to apply:** Use GraphQL for the final head/blob audit, re-read the head after a short delay, report every missing or stale path with its remote SHA, and stop rather than falling back to an unguarded push.
