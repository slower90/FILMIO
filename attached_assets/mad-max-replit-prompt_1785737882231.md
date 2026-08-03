# MAD MAX — Replit Build Prompt

Copy-paste this whole thing into Replit's AI Agent (Ghostwriter / Replit Agent) as your build instruction.

---

## Prompt to paste into Replit

Build a full-stack web application called **MAD MAX** — a next-generation movie review and discovery platform positioned as a better, modern alternative to IMDB.

### Core Concept
MAD MAX fixes IMDB's biggest weaknesses: outdated UI, no video reviews, no personalized genre-based discovery, no OTT deep-linking, and no way for film industry professionals to network. It should feel premium, fast, and modern — like a mix of Letterboxd's design taste + Netflix's content browsing + a professional network for actors.

### Tech Stack
- Frontend: React + Tailwind CSS (dark, premium theme — deep charcoal/black base, one signature accent color like amber-gold or electric red, NOT generic purple/blue "AI app" gradients)
- Backend: Node.js + Express (or Next.js full-stack)
- Database: PostgreSQL (Replit DB or Neon)
- Auth: email + Google OAuth
- Real-time chat: WebSockets (Socket.io)
- File/video storage: use a cloud bucket (S3-compatible) for uploaded review videos and actor profile media

### 1. Public Movie Database & Search
- Movie/TV detail pages: poster, trailer embed (YouTube/official), synopsis, cast, crew, runtime, release date, genre tags
- Search bar with instant results (title, actor, director)
- On opening a movie: show **which OTT platforms it's streaming on** with direct deep links (use a free API like JustWatch/TMDB "watch providers" for this — TMDB API is free and has this data)
- Star rating (1–10) + written review + optional **uploaded video review** (short clips, like a "Letterboxd meets TikTok" review)
- Critic reviews vs. audience reviews shown separately (fixes IMDB's mixing of the two)
- No user-review manipulation: verified/weighted rating system (see below) instead of raw average

### 2. Recommendation Algorithm
- Genre + viewing-history based "Because you watched X" recommendations
- Collaborative filtering: users with similar taste get similar suggestions (like Instagram/Facebook's feed logic, but for movies)
- "Best of [Genre]" auto-curated lists that update based on aggregate weighted ratings, not just raw star average
- Weighted rating formula: factor in number of reviews + reviewer credibility score (a user who reviews thoughtfully and consistently gets more weight) — this directly fixes IMDB's bot/brigading rating problem

### 3. Ratings/Review Integrity Model
- Anti-bot/anti-brigade detection: flag sudden rating spikes from new/unverified accounts
- "Verified Watch" badge — user has to confirm they streamed/watched before reviewing (optional honesty toggle)
- Reviewer credibility score visible on profile (built from review quality/engagement, not just count)

### 4. Social Layer
- Follow other users, see their reviews in a feed (Instagram/Facebook-style feed of reviews from people you follow)
- Comment + like on reviews
- Shareable review cards (auto-generated image for sharing to Instagram/WhatsApp stories)

### 5. Actor/Industry Professional Section (separate from regular users)
- A distinct "For Industry Professionals" entry point on the homepage — clicking it opens a **separate onboarding flow** (not the regular signup) so actors/directors/crew can build a professional profile without friction
- Profile includes: headshots, showreel/demo videos, filmography, skills/roles, agency contact, availability status
- **Direct messaging between verified industry profiles** — end-to-end encrypted chat using a proven, audited protocol (implement using the **Signal Protocol / libsignal** — this is the actual gold-standard for E2EE, used by Signal and WhatsApp; there is no legitimate reason to build a custom, unaudited encryption scheme, since unaudited crypto is far less safe than a battle-tested open standard)
- "Pitch" feature: actors can send a structured pitch (like a LinkedIn InMail) to casting directors/other professionals — pitch includes reel link, role interest, availability
- Verification badge system so professionals aren't spammed by fake profiles

### 6. Design Direction
- Avoid anything that looks like a template/stock "AI generated" site — no default indigo-to-purple gradients, no generic Inter font, no rounded-everything cards
- Go for a cinematic premium feel: near-black backgrounds, sharp typography (something like a condensed display font for headers + clean sans for body), one bold accent color, generous negative space, subtle motion on hover
- Mobile-first responsive layout

### 7. IMDB Feature Parity (must-haves, done better)
- Full cast/crew pages with filmographies
- Trivia, goofs, quotes sections — but crowd-moderated with upvote/downvote instead of unmoderated clutter
- "Watchlist" and "Watched" list per user
- Box office/awards data

---

Build this as an MVP first: auth, movie DB (seed from TMDB API), search, reviews (text first, video upload as phase 2), basic recommendation logic, and the actor profile section with chat. Add the social feed and advanced weighted-rating algorithm after the core MVP works.
