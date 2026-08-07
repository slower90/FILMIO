---
name: GSAP animations in MAD MAX
description: How GSAP ScrollTrigger, hover, and page fade are wired into the movie carousel system
---

# GSAP Animation Architecture

## Where it lives
- `artifacts/mad-max/src/components/movie-row.tsx` — ScrollTrigger row entrance + GSAP hover on cards + momentum wheel scroll
- `artifacts/mad-max/src/App.tsx` — PageFade component wrapping the Wouter Switch

## Key decisions

**ScrollTrigger setup (MovieRow)**
- `gsap.set(el, { opacity: 0, y: 48 })` runs before the trigger so elements start invisible
- `start: "top 90%", once: true` — fires immediately for in-viewport rows, animates as user scrolls for below-fold rows
- Always call `ctx.revert()` in the useEffect cleanup to avoid ScrollTrigger leaks

**Hover (MovieCard)**
- `y: -7, scale: 1.06` on enter; `y: 0, scale: 1` on leave — both `duration: 0.22`
- `boxShadow` animated on the image wrapper div (separate ref `imgWrapRef`) with initial value `"0 0px 0px rgba(0,0,0,0)"`
- `overwrite: "auto"` prevents competing tweens on fast mouse movement

**Momentum scroll**
- Wheel handler: `Math.abs(e.deltaX) > Math.abs(e.deltaY)` guard lets native trackpad horizontal pass through
- `gsap.to(track, { scrollLeft: target, duration: 0.5, ease: "power2.out", overwrite: "auto" })`
- Button clicks use same GSAP approach: `gsap.to(track, { scrollLeft: ..., duration: 0.55, ease: "power2.inOut" })`

**Page fade (PageFade in App.tsx)**
- `useLocation()` from Wouter as the trigger
- `gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" })`
- Must be inside the Router context (inside ClerkProviderWithRoutes, not in App)

## Package
`gsap` installed at `artifacts/mad-max` — ScrollTrigger imported from `gsap/ScrollTrigger`, registered once at module level.

**Why:** `gsap.registerPlugin(ScrollTrigger)` must happen before any `scrollTrigger:` config is used; doing it at module level (outside any component) is safe and idiomatic.
