# Post-launch Settings and auction Save polish

Local frontend patch based on checkpoint `8065917378ce4e603d9b21276161e5bb5581b932`.

## Scope

- Settings sidebar and Account overview use `Legal`, `Terms of Service` and `Privacy Notice`, preserving existing routes.
- Settings privacy guidance uses neutral Privacy Notice copy instead of an unconditional draft/review claim.
- Auction Detail hides Save for terminal listing or auction states, including cancelled auctions and elapsed auctions awaiting server finalization.
- Scheduled, live and ending-soon published auctions keep their existing Save behavior.
- Saved cards can remove an existing terminal save. Once removed, the control disappears; no new terminal Save is exposed.
- Save checks current presentation eligibility before and after the asynchronous account check. A deadline timer hides the control at the end time without adding recurring polling to listing cards.

Firestore remains authoritative. Its existing active-listing requirement and permitted removal of an existing saved record are unchanged. No rules, Functions, legal content, policy/version/date values, activation controls, infrastructure or production configuration changed. Legitimate listing Draft labels and explicitly gated local legal-review presentation remain intact.

## Qualification

- App suite: 466 passed, 2 existing skips, 0 failures (468 total).
- Six focused regressions cover neutral Settings labels/routes, scheduled/live/ending-soon Save, terminal states, the exact end-time boundary, remove-only terminal history, and shared-control mutation guards.
- TypeScript, ESLint and whitespace/diff review pass.
- Isolated local Next.js presentation fixtures exercised Settings, privacy guidance, scheduled/live/ending-soon/ended/cancelled auction detail at 390×844, 430×932, 768×1024 and 1440×900.
- No horizontal overflow or captured hydration errors. Auction action bars remain within the viewport at mobile/tablet widths and in their desktop position; controls retain 48px height.
- Local service doubles confirmed active Save and terminal removal; no Save control appears after terminal removal. No production write smoke was performed for this presentation patch.
- Fixture source, screenshots, logs and browser receipts are private outside Git and are not release artifacts.

## Release status

Prepared locally, uncommitted and not deployed. Existing migration/runbook deployment gates require separate owner approval for upload/deployment; this task conditionally permits automatic deployment only where an explicit safe post-launch procedure exists. No such procedure was found.

A future approved frontend release must preserve the reviewed publication-enabled production build settings and production resource identity. Do not deploy the local unpublished preparation configuration directly. Deploy only `takeme-web`, preserve routing and backend state, verify the two fixes remotely, inspect Worker telemetry and retain the existing rollback evidence.
