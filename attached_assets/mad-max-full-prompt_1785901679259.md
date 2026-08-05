# MAD MAX — Full Combined Replit Prompt

Paste this whole thing into Replit Agent's "Message Agent" box in one go.

---

Build/update the MAD MAX movie platform with the following. I already have `TMDB_API_KEY` and `OMDB_API_KEY` set in Secrets — use them.

### 1. Homepage & Browsing (Netflix-style)
- Replace any list-style/sidebar-text movie display with **horizontal-scrolling carousel rows** (like Netflix/Rotten Tomatoes homepage). Each row is a category: Trending, Popular, Top Rated, New Releases, and one row per genre (Action, Drama, Comedy, Horror, Sci-Fi, Anime, etc.)
- Fetch each category with pagination (2-3 pages, ~40-60 titles) from TMDB so rows don't run out quickly
- Movie posters must be directly clickable to open the movie detail page instantly
- Add a **dedicated "Browse by Genre" page** listing all genres for easy discovery

### 2. Navigation
- Add a **persistent search bar** in the top navbar (visible on every page) that live-searches movies/TV/actors as the user types, using TMDB's `/search/multi` endpoint
- Add a **hamburger menu (3-line icon)** in the navbar that opens a side drawer listing all categories: Genres, TV Shows, Top Box Office, Anime, News, Actor Profiles — similar to Rotten Tomatoes' menu

### 3. Movie Detail Page — Combined Ratings
- Fetch from OMDb API (`http://www.omdbapi.com/?apikey={OMDB_API_KEY}&t={movie_title}` or by IMDB ID) to get **IMDB rating, Rotten Tomatoes score, and Metacritic score**
- Display all three ratings side by side next to our existing TMDB rating
- Calculate and show a combined **"MAD MAX Score"** — the average of all available ratings, as our own unified rating system
- Keep existing: trailer embed, watch providers/OTT links, cast/crew, synopsis, watchlist button, rate & review

### 4. Recommendations
- On each movie page, add "You Might Also Like" using TMDB's `/movie/{movie_id}/recommendations` endpoint
- Add "More in [Genre]" row using `/discover/movie` filtered by genre ID

### 5. Anime Section
- Integrate the **Jikan API** (unofficial MyAnimeList API — `https://api.jikan.moe/v4`, completely free, no API key needed)
- Add a dedicated "Anime" category/browse page pulling titles, ratings, synopses, and cover images
- Style it consistently with the rest of the site (same carousel/card design)

### 6. News Section
- Add a "News" page/tab with movie and anime news
- Do NOT use NewsAPI (its free tier isn't licensed for production use) — instead parse these **free RSS feeds server-side** (use an RSS parser library, no key needed, no limits):
  - `https://variety.com/feed/`
  - `https://www.hollywoodreporter.com/feed/`
  - `https://www.animenewsnetwork.com/all/rss.xml`
- Display headline, thumbnail, publish date, and a link back to the original source
- Auto-refresh the feed periodically (e.g. every hour) so it stays current

### 7. Actor/Industry Professional Section (separate onboarding)
- Homepage entry point "For Industry Professionals" opens a **separate profile-creation flow** distinct from regular user signup
- Profile includes: headshots, showreel/demo videos, filmography, skills/roles, agency contact, availability
- Direct messaging between verified professional profiles using the **Signal Protocol / libsignal** (proven, audited end-to-end encryption — not a custom scheme)
- "Pitch" feature: structured message with reel link, role interest, availability (LinkedIn-InMail style)
- Verification badge so profiles can't be spammed by fakes

### 8. Design
- Keep the current premium dark theme (near-black background, gold/amber accent) — no generic purple/blue AI-template gradients
- Mobile-first responsive layout

---

Test that every section — carousels, search, hamburger menu, combined ratings, recommendations, anime, news — is populated with real, clickable content before stopping. Don't leave placeholders.
