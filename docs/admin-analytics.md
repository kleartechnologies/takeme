# Phase 9 — admin dashboard and marketplace analytics

`/admin` is a read-only operations interface. Dashboard data comes only from three regional Firebase callables (`getAdminMetrics`, `getAdminPage`, `getAdminRecord`) running with the Admin SDK. Every callable checks a Firebase Auth ID token for `admin === true` before any read. The browser checks the claim to choose between dashboard and unauthorized UI, but that check is **not** the security boundary. Unauthenticated visitors are sent to sign-in. No user is automatically promoted, and neither a public profile field nor a URL parameter grants access.

## Assigning an administrator manually

Only a trusted Firebase project operator may set a custom claim, using the Admin SDK in a separately reviewed, privileged environment. Confirm the exact Firebase project and UID first. Preserve other claims: `const user = await getAuth().getUser(uid); await getAuth().setCustomUserClaims(uid, { ...user.customClaims, admin: true });`. To revoke, repeat with `admin` removed. The user must obtain a fresh ID token (sign out/in or token refresh). Do not put service-account credentials in the web application, commit them, or run this against an unverified production UID. This repository does not contain a self-service admin-grant function.

## Sources, definitions and time

Dates use Asia/Kuala_Lumpur midnight. Presets are Today, 7/30/90 days, This year and All time; a custom range is limited to 366 days. Period cards use document event dates; current-snapshot cards intentionally ignore the range. All time sums are from retained authoritative records. Eight bounded buckets at most provide trend charts; All time has exact KPI totals but no misleading unbounded trend scan. Dashboard data refreshes only on request/navigation.

| Metric | Authority and definition |
| --- | --- |
| Users, new registrations | `users` count / `createdAt` count. Public-profile documents, not Auth sign-in records. |
| Active users | Distinct `userInterests` documents whose last accepted event is within a current-ended range. Historical custom ranges return unavailable because last activity overwrites prior activity. |
| Buyer/seller/both | `trustSummaries` with completedCount > 0 in each role. Tiers are the current trusted role-specific summary. |
| Listings | `listings` aggregate counts by current status/type and selected-period `createdAt`; category IDs are the 14 official `src/data/categories.ts` categories. |
| Completed transaction | `transactions.status == completed`, attainable only through the Phase 8 dual-confirmation process for ordinary users. Pending, cancelled and disputed agreements are excluded. |
| GMV | Sum of integer `transactions.amountSen` on completed records whose `completedAt` falls in the selected period. GMV is **total monetary value of legitimate completed marketplace transactions**, not TAKEME revenue, payment proof, listing price, bid, offer or promotion spend. |
| Average completed value | Completed GMV sen / number of completed transactions, rounded to integer sen; unavailable if count is zero. |
| Completed Transaction Value | A specific user's completed purchase or sale amounts, kept as separate buyer and seller totals on the admin detail page. It is not a balance, payout, or money earned. |
| Reviews | Released `publicReviews` only; period uses `publishedAt`, including rating sum/count and 1–5-star distribution. Private reviews are never counted before release. |
| Promotion requests | `promotions` by type and `createdAt`; these are unpaid requests, **not purchases**. Active paid placement and lifetime engagement counters are read separately. |
| Promotion Revenue / Spend | Money paid to TAKEME for Boost/Featured; currently unavailable because there is no verified payment provider or webhook. Never substitute `priceSen` from a pending request. Promotion revenue is not GMV. |
| Intelligence | Accepted deduplicated `marketplaceEvents` counts by type and selected event date. Category views are counted by official category. Raw event TTL policy is 90 days, so All time may not represent all historic behavior. |
| Reports and disputes | Current report status counts from `reports`; unresolved dispute count from `transactions.status == disputed`. No moderation mutation exists. |

`Listing Price` is the current advertised price. A `Bid` is an auction bid. An `Offer` is a proposal. None is GMV until a legitimate transaction is completed. A winning auction alone is not completion.

## Data access, security and cost

Firestore `count()` and `sum()` aggregation queries return exact aggregate results without downloading collections into a browser. They still scan matching index entries and incur reads proportional to scanned entries; they are not free. The metrics endpoint runs a fixed set of aggregate queries (up to 14 category queries plus at most eight time buckets per relevant series), never a collection scan. Overview combines section metrics and is the most expensive call; there is no polling. List endpoints read 21 documents at a time to return 20 plus a next-page cursor, and detail endpoints read one target plus bounded related counts/records. Existing Firestore rules continue to deny ordinary-user access to raw events, offers, transactions and promotion records; no rule is relaxed for this dashboard. Client writes cannot create financial or trust aggregates. The new composite indexes cover bounded filters and aggregation queries. Deploy Functions and indexes together only after a separately approved release plan, and wait for all indexes to be READY before using `/admin` in production.

No separate `adminAnalytics` materialized collection is created in this phase. At larger scale, replace expensive repeated index scans with trusted server-owned daily/monthly aggregates and an audited backfill. Do not silently backfill or overwrite production analytics now. Cache/revalidation can be added after real usage is measured; current explicit refresh avoids stale operational decisions.

## Metrics that are intentionally not available yet

- Boost/Featured purchases, promotion revenue, promotion spend and revenue charts: no verified payment event exists.
- Recommendation CTR: existing impression events batch up to eight listings while clicks are per listing, so batch count is not a valid impression denominator. Post-recommendation conversion is not causally attributed.
- Top search terms, exact most-viewed/saved listings, review-tag rankings and distinct listings with offers: no group aggregate exists; the dashboard will not scan raw documents to guess them.
- Historical distinct active users for a custom past range: the interest profile stores only the last accepted event time.
- Completion rate by agreement cohort: current status divided by period agreements would mix cohorts. A cohort model is required.
- Transaction GMV by location: transaction records do not snapshot a verified exchange location.
- Moderation actions, dispute resolution, payments, payouts, subscriptions, commissions and wallet balances: no secure backend workflow exists.

## Verification and deployment prerequisites

Local demo-project checks: `npm run test:functions`, `npm test`, `node tests/admin-emulator.integration.mjs`, and the auction, trust, transaction, intelligence and promotion emulator suites; then lint, TypeScript, build and responsive QA at 320/375/390/430/768/1024 px. The integration test creates a custom-claimed admin **only in `demo-takeme`**. No production users, reports, listings or analytics are seeded.

Before production: manually approve and assign at least one exact admin UID; deploy the three Functions and composite indexes with the existing rules/functions; verify region, Auth claims, indexes, billing and Firestore query cost; review privacy/retention, event TTL, App Check and incident response. Validate zero/limited-data screens and GMV against known legitimate completed transactions. This phase does not deploy Firebase or Vercel and does not push GitHub.
