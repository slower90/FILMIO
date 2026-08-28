# FILMIO design system

FILMIO treats cinema as a universe of stories, people, cultures, emotions, and
memories. The design system should make those relationships easier to
understand without turning the product into a dashboard or a decorative
streaming clone.

## Foundations

The source of truth for visual tokens is `src/index.css`.

| Token group | Use |
| --- | --- |
| `--background`, `--surface-deep`, `--surface-raised`, `--card` | Screening-room surfaces and clear content hierarchy |
| `--foreground`, `--muted-foreground`, `--primary` | Editorial contrast, metadata, and the FILMIO accent |
| `--border` | Quiet grouping and scan lines; never use borders to make every item look like a card |
| `--font-display` | Film titles, section headings, and compact signal labels |
| spacing utilities | Responsive rhythm; prefer existing container and gap utilities over new one-off offsets |

Typography is intentionally split: Space Grotesk carries premium geometric
headings and Michroma remains reserved for the FILMIO wordmark. All interactive
targets should preserve a 44px minimum touch area on small screens.

## Effects policy

Effects are allowed only when they communicate:

- hierarchy, such as a readable hero overlay;
- state, such as a focused control or loading placeholder;
- navigation, such as a hover lift that confirms a target;
- readability, such as a contrast layer over imagery; or
- emotional context, when the effect is part of a specific story surface.

Do not add gradients, glow, 3D, neon, animation, or panels as decoration.
Respect `prefers-reduced-motion` for every animation that is introduced.

## Shared vocabulary

### Production primitives

| Primitive | Current role | Required states |
| --- | --- | --- |
| `MovieCard` | Reusable poster, title, FILMIO score, and story link | image loading, hover/focus, missing poster, mobile card width |
| `MovieHero` | Hero carousel surface (`HeroCarousel`) | loading, swipe, keyboard, reduced motion, readable image overlay |
| `RatingRing` / `VScore` | Reserved contract for compact FILMIO-owned scoring | no score, loading, accessible score label |
| `ReviewCard` | Community/critic review presentation | loading, empty, error, action focus |
| `UserAvatar` | Current `ProfileAvatar` renderer | image, initial fallback, size variants |
| `ProfileHeader` | Profile identity and viewing-profile surfaces | signed-out, loading, empty avatar, mobile stacking |
| `SearchCommand` | Current navbar search interaction (`NavSearch`) | idle, focused, loading, no results, result focus, escape |
| `TrendPulse` | One observed signal row in Cinema Now | source qualifier, movie/news target, hover/focus |
| `CinemaGraph` | Semantic ordered signal list in Cinema Now | loading skeleton, empty, partial-source notice |

### Extension points

`FilmDNA`, `FilmOracle`, `FilterRail`, `Timeline`, `WorldMap`,
`SignalNotification`, `DiscussionPanel`, `TrailerPlayer`, `SpoilerBlock`,
`TasteGraph`, and `GenreNode` are vocabulary only until a real product surface
needs them. They must not be introduced with placeholder metrics or invented
relationships.

## Data and state contract

Every shared surface should make its data boundary visible:

1. **Loading:** preserve approximate layout with a quiet skeleton; do not use a
   spinner as the only explanation.
2. **Empty:** explain what is missing and offer the nearest useful next action.
3. **Error:** identify the unavailable source and provide retry without taking
   down unrelated homepage content.
4. **Partial:** label the remaining coverage instead of silently filling gaps
   with a different kind of signal.
5. **Interactive:** use semantic links/buttons, visible keyboard focus, and
   `aria-live="polite"` only for meaningful refreshed content.

## Cinema Now source rules

`CinemaNow` is an editorial activity surface, not an analytics claim. Current
signals are explicitly qualified:

- TMDB trending is a provider-ranked catalog signal, not FILMIO watch volume.
- FILMIO rating totals are community context, not recent rating velocity.
- India discovery and upcoming feeds are catalog/release context, not proof of
  regional user behavior.
- Journal entries are sourced scene signals, not “viral” counts.

Real audience momentum, review velocity, discussion volume, cult discovery, or
regional activity require first-party event data and a defined observation
window before they can be named or visualized.