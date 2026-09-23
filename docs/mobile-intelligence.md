# TAKEME Intelligence — web and Flutter contract

The current Discovery 2.0 contract is documented in [discovery-architecture.md](discovery-architecture.md). Phase 12 extends, rather than replaces, the Phase 6 deterministic interest model. Organic ranking is server-owned; Boost and Featured placements are separate and visibly labeled. Neither Flutter nor web should calculate recommendation scores.

## Callables

- `getMarketplaceDiscovery({})`: authenticated initial discovery, returning ordered sections, metadata and a private `sessionId`.
- `getMarketplaceDiscovery({sectionId, cursor})`: authenticated bounded continuation for one section. Display at most four returned cards per page; deduplicate listing IDs as inventory can change.
- `getMarketplaceSimilar({listingId})`: public, server-ranked similar active listings with an optional session for signed-in users.
- `getMarketplaceRecommendations({})`: legacy homepage contract, now version `v2` and session-backed. Use the structured discovery callable for the For You route.
- `trackMarketplaceEvent({type, ...})`: semantic actions. Recommendation impressions and clicks require a returned session ID and served listing ID. The server supplies source, section and reason from that session. Never submit raw interest scores or client-derived ranking data.

## Native interaction pattern

Render `/for-you` as compact, horizontal swipe rails on phones and a three-/four-column layout on larger screens. Preserve the server's section title and reason, omit empty sections, show honest cold-start copy, and keep 44px touch targets. Observe each card—not a whole feed container—and report its impression once it is meaningfully visible. Report a recommendation click only from an actual listing tap. The Not interested control is listing-level, offers Undo, and must roll back on an API error. Native loading, empty and retry states should match the web behavior. Bottom navigation remains Explore / For You / Sell / Updates / Me.

Raw searches, category scores, hidden listings, recent views and exposure counters remain private. Do not read their documents from a client or infer precise GPS. Only a user's explicitly entered general profile location can label local discovery. Auction and price labels must reflect the server listing state. A completed transaction signal is server-verified; a bid or pending order is not a purchase.

## Operational notes

Authenticated intent is deduplicated and capped at 100 accepted client events per user-day. Interests decay with a 30-day half-life, trends with a seven-day half-life, and Not interested hides one listing for at most 30 days. Sessions last two hours. Promotional impressions use the separate promotion pipeline. Recommendation saves are attributed only after a verified discovery click within seven days; this is not a conversion claim. Before production rollout, deploy Functions, rules and indexes together and configure TTL/monitoring as detailed in the architecture document. No rollout is part of this phase.
