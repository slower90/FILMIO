# FILMIO catalog providers

## Priority and fallback

1. **TMDB (`tmdb`)** is the primary provider. Its API key is read only on the
   server from `TMDB_API_KEY`.
2. **Configured compatible provider** is tried second when
   `CATALOG_FALLBACK_BASE_URL` is set. It must implement the documented
   TMDB-compatible paths used by `routes/movies.ts`; the adapter normalizes
   common camelCase field names and result envelopes.
3. **OMDb (`omdb`)** is the approved metadata fallback when no compatible
   provider URL is configured and `OMDB_API_KEY` is present. It supports
   movie/TV search and IMDb-ID detail metadata. OMDb does not provide
   trailers, recommendations, credits, or streaming availability, so those
   operations fail closed and are never fabricated.
4. If all applicable providers fail, the bounded last-known-good cache may
   serve a stale response. The response source is `cache` internally, and the
   cache is not extended by an outage.

The transport retries transient failures once, opens a provider circuit after
three failed requests for 30 seconds, rejects malformed and empty result
envelopes, and keeps requests server-side. Provider credentials are never
returned to clients or logged.

## Configuration

For a full-capability approved backup, configure:

```text
CATALOG_FALLBACK_BASE_URL=https://approved-provider.example/api
CATALOG_FALLBACK_NAME=approved-provider
CATALOG_FALLBACK_API_KEY=<server-side environment secret, if required>
CATALOG_FALLBACK_ATTRIBUTION=Approved Provider
CATALOG_FALLBACK_QUOTA=Provider plan quota and rate limits
```

`CATALOG_FALLBACK_API_KEY` is only used to create a server-side Authorization
header. Do not put it in frontend code, URLs, response bodies, or chat.
Configured compatible providers always take priority over OMDb.

The compatible provider must return object envelopes for the following
TMDB-shaped paths (or their documented equivalent field names):

- `/movie/:id` with `append_to_response=credits,videos,watch/providers,external_ids`
- `/movie/:id/videos`
- `/movie/:id/watch/providers`

The adapter normalizes common `camelCase` result, trailer, and provider fields
to the snake_case shape consumed by the existing movie routes. Empty trailer or
provider result sets are treated as a failed optional response and may fall
through to the next provider or bounded cache; no data is fabricated.

## Attribution and terms

TMDB and OMDb attribution and usage terms apply to the data returned by each
provider. FILMIO user ratings, reviews, watchlists, and private messages are
never replaced by provider data. Operators must approve the backup provider's
terms, quota, image rights, and endpoint compatibility before setting the
configuration. The adapter does not scrape or bypass rate limits.