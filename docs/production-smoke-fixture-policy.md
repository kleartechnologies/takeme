# Production smoke-fixture lifecycle

Production smoke tests must use explicitly approved TAKEME-owned synthetic accounts and bounded fixture IDs. Prefer private drafts or staging fixtures; never leave public smoke listings active after qualification.

Before a production test:

- Record the exact account UID, listing ID, purpose, UTC timestamp and approved cleanup plan in a private receipt outside Git.
- Identify the fixture internally in that receipt. Use only existing supported fields; adding schema or production cleanup code requires separate review.
- Confirm the test account can use the existing authoritative removal action, including current policy eligibility. Never fabricate acceptance to make cleanup succeed.
- Preserve customer data, immutable acceptance history, operational audit records and records subject to retention or existing obligations.

If publication is required, withdrawal and cleanup are part of the same procedure. Use the reviewed owner removal/cancellation path immediately after qualification. Verify Home, discovery, search and storefront exclusion; verify the direct URL shows the intended unavailable state. Confirm exact listing media removal through Storage readback. Never delete by loose title keywords or a broad bucket prefix.

Check bids, offers, transactions, conversations, reviews, Saved/watchers and notifications before cleanup. If any participant is real or unknown, withdraw public visibility and retain historical references for owner review. Avoid direct counter/notification edits that bypass authoritative side effects. Already-terminal records with retained transaction or auction evidence remain historical fixtures until a separately reviewed retention-safe procedure exists.

A bounded cleanup receipt must record: evidence of synthetic ownership, before/after state, authoritative action, exact media paths/generations, deleted-object readback, historical records retained, public-render checks and aggregate monitoring outcome. Store credentials and qualification artifacts outside Git; receipts must contain no tokens or passwords.

If removal is blocked, stop on that record and report the precise blocker. Do not weaken policy/security, fabricate consent, enable account deletion, deploy new cleanup code or change Auth/DNS. Auth account deletion is a separate controlled process.

Synthetic accounts with immutable acceptance or marketplace obligations are KEEP until separately reviewed. An unused account may be SAFE TO REMOVE LATER only after its obligations and retention needs are established; this document does not authorize deletion.
