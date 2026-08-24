# FILMIO Security Notes

## Security posture

- Authentication is handled by Clerk; state-changing application routes require authenticated identity.
- API responses use secure browser headers, bounded JSON/url-encoded bodies, strict CORS allowlisting, and per-client request throttling.
- Sensitive ownership checks remain server-side for ratings, reviews, watchlists, profiles, professional resources, auditions, history, and encrypted messages.
- API keys are loaded from Replit Secrets. Do not commit provider keys or paste them into chat.
- The mobile static server accepts only `GET`/`HEAD`, limits URL length and request rate, rejects malformed/encoded traversal, confines paths to the generated build, rejects symlink escapes, and serves only known asset extensions.

## Residual risk

- Expo/Metro uses a vendored, bounded image-dimension parser instead of the vulnerable `image-size` package. It supports Metro's image asset formats and rejects malformed or oversized inputs before parsing.
- SAST still reports generic dynamic-file-path warnings in the mobile static server. The request path is decoded, rejects traversal segments and unsafe characters, is confined with `path.resolve`, and is checked again with `realpath` to prevent symlink escapes. The remaining report is retained for re-review when the scanner supports this validation pattern.

## Operational requirements

1. Rotate any provider key that was ever committed to repository history.
2. Keep `CORS_ORIGINS` limited to exact trusted web origins in production.
3. Re-run dependency, SAST, and dataflow scans after dependency or server changes.
4. Use distributed rate limiting at the edge for multi-instance production deployments; the in-process limiter is a defense-in-depth fallback.