# Admin editorial backend MVP

Local preparation only. No production deployment, records, controls, schedules, payments, deletion or TTL changed. Owner campaigns use their own collections; paid seller promotions and existing promotion endpoints retain their semantics.

## Existing versus new capabilities

Reuse `getAdminPage`, `getAdminRecord`, `updateAdminReport` and the existing admin-claim/marketplace lifecycle, policy and maintenance guards. `getAdminMetrics` remains available for deeper existing analytics, but the new overview deliberately uses four aggregate counts and a capped 101-document campaign window, not its larger historical graph. Existing promotion APIs are retained and not repurposed.

New callables: `getAdminSession`, `getAdminControlOverview`, `getAdminEditorialPage`, `getAdminEditorialRecord`, `mutateAdminEditorial`, `previewAdminHomepage`, `publishAdminHomepage`, `getPublicHomepage`, `requestAdminAssetPermit`, `finalizeAdminAsset`, `loadAdminReportContext`. Three new invalidation triggers cover listing, public seller profile and account-lifecycle changes. `getPublicListingPage` adds an optional, strictly boolean `includeHomepage`; omitted means no editorial read.

All Admin MVP editorial and marketplace-admin endpoints require revocation-aware Firebase ID-token verification, verified `admin === true` and a fresh current Auth admin claim. The dedicated-app cookie is revalidated through the same boundary on each protected server read. See [admin session security and operator-removal procedure](admin-session-security.md). No email allowlist or request-body admin flag grants access. Editorial mutations reuse server policy, account and maintenance checks, including transactional rechecks. The explicit report-context action audits access without changing marketplace state.

## Private data model

`editorial_campaigns`, `editorial_banners`, `editorial_collections`, `editorial_announcements`, `editorial_homepage/current`, `editorial_categories/current`: validated content, optimistic version, created/updated operator UID and server timestamps. `homepagePublished/current` stores a compiled projection plus private validation references and version metadata. `adminAssets`, `adminAssetQuotas`, `adminAuditEvents` are server-owned. The existing final Firestore default-deny boundary already denies browser access to these new collections, including admins; no Firestore rule change is needed. Use callables.

Bounds: 30 editorial records per page; 20 marketplace rows; 16 homepage sections; 12 products/sellers and four banners per placement; 48 distinct products/sellers across a published snapshot; 150,000-character projection budget. Searches use one selective predicate plus bounded post-filtering and a scan cursor. An empty filtered page can still have a next page. Reported-listing pages scan at most 21 report references and fetch at most 20 distinct targets, not the entire report collection. Seller summaries use a bounded trust batch plus two aggregate counts per displayed user. This is an operational view of dual-capability accounts, not a new seller account type.

Campaign actions: save draft, schedule with a future start and end, publish now, end, duplicate into a new draft. Server time derives effective scheduled/live/ended state. Priority is stored editorial metadata; explicit homepage section order controls placement. Dates persist as UTC ISO timestamps; the app displays Malaysia time. Empty/invalid schedules and unknown fields fail validation. Destinations must be bounded, marketplace-relative paths.

Homepage save does not publish. Preview performs validated transactional reads only. Publish checks both draft version and live version, compiles active references and updates asset publication flags atomically. Conflicts require reload/review; there is no last-writer overwrite. Campaign end invalidates a bound snapshot and remains available even if a previously featured item has become ineligible. Ordinary draft edits to campaigns, collections, announcements and categories require another explicit homepage publish to affect its snapshot. Scheduled section/banner windows are filtered by server time at each public read; no new scheduler is introduced.

Listings must be public-safe, active, positive-price and owned by an available seller. Auctions additionally need a supported public state, positive starting bid and future end. Removed/disabled/deletion-pending sellers fail featuring. Preview and publish revalidate references. Listing public-field changes or invalidation, public seller changes/removal and account-lifecycle entry invalidate affected snapshots; the consumer then uses the existing feed fallback until explicit republication. Invalidation atomically revokes anonymous asset publication flags; authenticated operator previews remain possible. Trigger propagation is asynchronous, not a transactional guarantee against every subsequent source update.

## Privacy and moderation

Default user responses omit email, private address and payment-profile identifiers. Operational counts, trust summary and account state remain available. No new email retrieval API was added. Default report detail returns report metadata and attached report details, not recent messages or deletion evidence.

`loadAdminReportContext` requires a message report, exact conversation/message relationship, reporter participation and a 10–200-character moderation purpose. It returns the reported message with at most two preceding and two following messages. The relationship is rechecked before the audit transaction commits. There is no arbitrary conversation browser. Record components remount by record ID, preventing old context from remaining on a different report.

Audit events contain operator UID, action, resource, server timestamp and a short structured summary; they do not contain tokens or full source-content snapshots. Existing report triage also gains an audit event.

## Asset security

Existing Firebase Storage, separate `admin-assets/{assetId}/image.png` namespace. Operator UID stays in private permit metadata, never in the public asset URL. Server issues a 120-second, exact-path/size/type create permit, capped at 30 per operator/hour. The browser normalizes PNG/JPEG/WebP through canvas into an 8-bit non-interlaced RGB/RGBA PNG. Final upload is capped at 2 MB, 320–2560 × 120–2560 and four megapixels. Backend validates complete chunk checksums, bounded decompression, dimensions and row filters. Placement aspect-ratio rules are checked again when saving/publishing banners. HEIC and the parked media processor are not used.

Storage requires an admin claim, matching owner/path/bucket and unexpired permit. Overwrite/delete is denied. As with existing upload leases, an already-issued 120-second permit may settle after maintenance starts; new permits and finalization are guarded. Private previews use authenticated SDK reads; token-free anonymous asset reads are allowed only after the asset is referenced by the approved published snapshot. Scheduled artwork in an approved published snapshot can already be public; draft-only assets are not. No automatic cleanup or TTL is added. Public caches cannot retract an already-downloaded image.

## Future backend rollout

Create a separately reviewed deployment manifest with all eleven new callables, three triggers, and the changed existing admin/public feed endpoints. Preserve reviewed production runtime pins and readback guards. Deploy and verify the compatible `getPublicListingPage` extension before the consumer starts sending `includeHomepage`, since the previous strict request parser rejects that new key. Deploy invalidation triggers before enabling editorial publication. Deploy only the reviewed rule diff; do not regenerate policy branches or change existing listing upload rules.

Before production, qualify the pinned staging configuration, cross-service Storage rule lookups, authorized operator claims, current policy eligibility, runtime-pin readback, representative content and rollback. Retain the existing fallback and prior frontend/backend/rule baselines. Stop if an authorization, private-data or consumer-feed regression appears. No claims, config or cloud resources were changed by this task.
