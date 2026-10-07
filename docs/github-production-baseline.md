# GitHub production baseline reconciliation

7 October 2026. Owner-authorized source-control reconciliation only. No deployment or production control-state change is authorized by this checkpoint.

## Identity and topology

Origin: `https://github.com/kleartechnologies/takeme.git`.
Original remote main: `4786b8e9296b8d68688ca8871540e0586770512d`.
Original local main: `cfedcd26ad7288e97caa4a003eac54223a3f58fa` (19 commits ahead, none behind).
Approved detached qualification HEAD: `fb31b8bae897ecbf5dcd3030587c77c72aae9fe4` (48 commits ahead, none behind).
Main is an ancestor of the qualification HEAD; Sell V1.1 `4a55ab17e208e845bdd4223be272a4fbe05d6256` is its immediate approved predecessor. The outgoing history is linear, with no merge commits or divergent remote changes. Main was fast-forwarded; shared history was not rewritten.

The retained deployed frontend source is based on `fb31b8b`; production Worker version `8cc94738-b4fb-4786-8c7e-41751438af68` was deployed from a reviewed publication-enabled source copy. The owner explicitly selected promotion of its five exact publication/configuration files into main. This reconciliation does not redeploy that version.

## Exact live file promotion

The following bytes match the retained deployed source copy:

| File | SHA-256 |
| --- | --- |
| `functions/src/legal-publication.ts` | `76cb7bf890bd4af3afa6adc5bee37d934c70e8064fd62fa0645869eb1ceedf83` |
| `functions/src/release-policy.ts` | `59d1ae82c879412061437b976895b8d60757a469165b4872f29ed42c61b62425` |
| `firestore.rules` | `a432748b7944287a9a00d7847898b0bee2297828379cd1daf3e33bc8ef4c4145` |
| `storage.rules` | `cf645c455c3d12e710701ecc5a84ddd869c0410d775151f1e17ab29406bf042c` |
| `wrangler.jsonc` | `0a5957dafb6651ac99587e2544fe6b2ba68936140cd57618ec030c2a3f08fa92` |

The existing final rule branches, central publication approvals and logging/query-redaction configuration now describe the approved live production baseline. Versions remain 1.0, dates remain 2026-10-12, address disposition remains NOT_PUBLISHED_FOR_V1 and internal counsel status remains OUTSTANDING. No substantive legal wording changes are included.

The staging environment remains available in `wrangler.staging.jsonc`. Staging build, provenance and plan commands select this file explicitly. Root `wrangler.jsonc` is the exact production configuration and contains no preview environment or Access wrapper. Configuration separation neither enables staging routing nor deploys either Worker.

## Publication-phase testing

`npm test` runs named historical preparation suites in an isolated, unpublished fixture, and all remaining suites against actual published main. The fixture uses current checkout source, replacing only central production approval booleans and regenerating their rule block locally. It has no credentials or SDK setup and is removed after testing. Historical test expectations are retained, not silently relaxed to allow publication. The preparation suite list is explicit in `scripts/test-app-phases.mjs`; a changed published source contract aborts fixture construction.

`tests/production-baseline.test.mts` independently checks actual main: approved publication, exact dates/versions, unresolved counsel/address disposition, bilingual metadata, production build proof, generated rule consistency, narrow upload guards, staging isolation, missing/malformed runtime policy denial, absent user acceptance, paused-write enforcement and deletion OFF. Source publication does not create the runtime policy record, grant user consent, enable deletion or reopen maintenance.

Functions test expectations now explicitly default to the published source phase. Their three-phase regression still tests unpublished preparation, published source without a runtime policy mirror, and a valid create-only in-memory mirror. Unknown phase selectors remain rejected.

## Commit review

All original outgoing commits were reviewed by path, file type, safety and prior owner approval. Early messaging WIP is superseded by its approved finishing checkpoint; historical preparation and staging source are intentional contracts, not deployable private bundles. No duplicate/cherry-picked-equivalent patch or suspicious merge was found.

| SHA | Date | Subject | Affected area | Classification |
| --- | --- | --- | --- | --- |
| `69031917585d959727d61b286dc0396fdbfdc264` | 2026-10-02 | feat: redesign takeme home explore and profile system | src (32), tests (7) | APPROVED PRODUCT CODE |
| `cd05b51ceccc3debd3996bf61d5cc53ed79603c8` | 2026-10-02 | chore: checkpoint approved redesigns and messaging offers WIP | src (17), tests (1) | APPROVED PRODUCT CODE |
| `42474a5bd11249acdc51c17569817371f9f6452b` | 2026-10-02 | fix: finalize approved messaging and offers accessibility | src (4) | APPROVED PRODUCT CODE |
| `55958f59dec89258781ac1b5450c891f0d6916e7` | 2026-10-02 | feat: finalize approved product detail redesign | src (9) | APPROVED PRODUCT CODE |
| `d002e90d3c2fdcab2d6470ccbfceacc28be7abd9` | 2026-10-03 | feat: finalize approved auction detail redesign | src (6), tests (3) | APPROVED PRODUCT CODE |
| `10679815ea5e9cc38fa939281ebfb0222ff55baa` | 2026-10-03 | Redesign Sell and Create Listing flow | src (13), tests (5) | APPROVED PRODUCT CODE |
| `fcbc9d9efc63f91925f844ec7760b5ec6132b995` | 2026-10-03 | Redesign Notifications and Updates experience | src (8), tests (1) | APPROVED PRODUCT CODE |
| `b3d931d6e259b4acc4997a47929483bd7e8dca83` | 2026-10-03 | Redesign Saved, Wishlist and Following hub | src (18), tests (3) | APPROVED PRODUCT CODE |
| `ed80675f258bad1eeb772022975d37cf3a85e9a2` | 2026-10-03 | Implement demo-only V1 account deletion workflow | docs (1), firestore.indexes.json (1), firestore.rules (1), functions (17), src (6), storage.rules (1), tests (2) | APPROVED PRODUCT CODE |
| `ac17c5130718b9c8c631191be7e0a2e028761c45` | 2026-10-03 | feat: redesign Settings and account management | docs (1), src (23), tests (3) | APPROVED PRODUCT CODE |
| `b864dbea580c7f411a14633494da3209aa71ab1e` | 2026-10-03 | feat: add launch legal and help draft checkpoint | docs (2), src (23), tests (1) | APPROVED PRODUCT CODE |
| `d69e27783ef84aa0a76695c21e2fb7af9bab10e7` | 2026-10-03 | feat: redesign authentication and lightweight onboarding | docs (1), functions (3), public (1), src (21), tests (5) | APPROVED PRODUCT CODE |
| `040fb9a9b4cc902d06e3c75c47fd01fd871e5306` | 2026-10-03 | fix: harden website launch eligibility and release safeguards | .gitignore (1), README.md (1), docs (4), firestore.rules (1), functions (23), next.config.ts (1), package.json (1), scripts (4), src (26), storage.rules (1), tests (27) | APPROVED PRODUCT CODE |
| `0fdfcc18fef073dd2c523ebf232192bcdb77422a` | 2026-10-03 | Prepare Cloudflare Workers hosting with OpenNext qualification guards | .gitignore (1), docs (3), eslint.config.mjs (1), next.config.ts (1), open-next.config.mjs (1), package.json (1), public (1), scripts (9), src (5), tests (2), wrangler.jsonc (1) | APPROVED PRODUCT CODE |
| `62fc03421d0d4f38b8796dfe38c56ca61b4ffda7` | 2026-10-03 | Adopt supported Cloudflare OpenNext dependencies | docs (2), package-lock.json (1), package.json (1), scripts (1) | APPROVED PRODUCT CODE |
| `6e36f40c1aebcbf6cd4e89780926222cdeac16f6` | 2026-10-04 | Add isolated staging safeguards and protected preview plan | docs (4), firestore.rules (1), functions (10), next.config.ts (1), package.json (1), scripts (10), src (11), storage.rules (1), tests (4), workers (2), wrangler.jsonc (1) | APPROVED PRODUCT CODE |
| `5c698d2eb815907e8d0d1e6b8bf2c9f754557b48` | 2026-10-04 | Fix staging Cloudflare Access identity gate | docs (1), tests (1), workers (1) | APPROVED PRODUCT CODE |
| `43b51b8feb08d772491e50ccd8de506240dff84c` | 2026-10-04 | Fix final staging presentation regressions | src (5), tests (4) | APPROVED PRODUCT CODE |
| `cfedcd26ad7288e97caa4a003eac54223a3f58fa` | 2026-10-04 | Fix marketplace destinations after authentication | src (3), tests (2) | APPROVED PRODUCT CODE |
| `6af93ca432fb572e822d135f80f83fa6f5e537c9` | 2026-10-05 | Fix auction bid wording across marketplace cards | src (6), tests (2) | APPROVED PRODUCT CODE |
| `de22d45d46ee83dff27a1c4b91e074fd47ffc9c1` | 2026-10-05 | Allow both approved staging Access testers | tests (1), workers (1) | APPROVED PRODUCT CODE |
| `2e701e2e38641380878e99242b5b573b060af7db` | 2026-10-05 | Harden V1 production readiness and marketplace writes | docs (8), functions (20), package.json (1), scripts (10), src (24), storage.rules (1), tests (21) | APPROVED PRODUCT CODE |
| `4d3176592c2be1c68af8d956a265843694f5a631` | 2026-10-05 | fix: prepare compatible production backend rollout | docs (4), firestore.indexes.json (1), functions (9), tests (4) | APPROVED PRODUCT CODE |
| `576e93f1f0f1bfbf93cf57eb9706abdc9ee165f7` | 2026-10-05 | Prepare production legal and policy bootstrap checkpoint | docs (2), functions (4), src (4), tests (7) | APPROVED PRODUCT CODE |
| `4f9c35bee362bfec9d9df4f083410426d74c9848` | 2026-10-05 | Implement owner-approved V1 policy model and acceptance history | docs (3), functions (8), src (29), tests (10) | APPROVED PRODUCT CODE |
| `0466426ba873c3942fd4c7f50e742b3b5b697213` | 2026-10-05 | Prepare English Privacy Notice v1.0 owner draft | docs (1), src (6), tests (1) | APPROVED PRODUCT CODE |
| `9ecf354d4b8de1d34b21653f1c8a6cf11a64f44c` | 2026-10-05 | Prepare TAKEME Terms of Service v1.0 owner draft | docs (1), src (3), tests (1) | APPROVED PRODUCT CODE |
| `1d7c174d42da0605eb0500480018488b15d40ff4` | 2026-10-05 | Prepare Bahasa Melayu Privacy Notice v1.0 owner draft | docs (1), src (8), tests (3) | APPROVED PRODUCT CODE |
| `544d47e756bc7bfcc868b40f87d3f1fbc5c7ef9b` | 2026-10-05 | Prepare Prohibited Items Policy v1.0 owner draft | docs (1), src (3), tests (1) | APPROVED PRODUCT CODE |
| `8665bccc14999794e5f83f2e8f5e22847c5d387a` | 2026-10-05 | Prepare legal policy activation and coordinated rollout | docs (1), firestore.rules (1), functions (2), scripts (1), storage.rules (1), tests (3) | APPROVED PRODUCT CODE |
| `9241867bcf430fc3a5c023d0e8a30892fdd64c19` | 2026-10-05 | Prepare controlled protected-write maintenance for V1 | docs (2), firestore.rules (1), functions (6), scripts (2), src (16), storage.rules (1), tests (6) | APPROVED PRODUCT CODE |
| `db4b686625092bae1454d65f0be607d434dc23ad` | 2026-10-06 | Finalize V1 activation runbook and auction admission safeguards | docs (3), firestore.rules (1), functions (9), scripts (4), tests (5) | APPROVED PRODUCT CODE |
| `9245501eb132ca68725e3874491c47906c060e5a` | 2026-10-06 | Preserve verified activation and operational timing rehearsals | functions (2), tests (4) | QUALIFICATION-ONLY — approved offline regression support, retained |
| `07a420acb59304325c13d2245691a074e8d83ae4` | 2026-10-06 | Add TAKEME social links to website footers | src (5), tests (1) | APPROVED PRODUCT CODE |
| `5f2fd8a84e7e9071566abd92af581e2a5d7a83a8` | 2026-10-06 | Prepare V1 owner and legal launch gates | docs (1), functions (1), scripts (1), src (6), tests (1) | APPROVED PRODUCT CODE |
| `39f38f33d7e44df176fc9fbb32e1adb673017b0c` | 2026-10-06 | Prepare TAKEME V1 release candidate for 12 October 2026 | docs (2), functions (2), scripts (1), src (8), tests (15) | APPROVED PRODUCT CODE |
| `3e424f4083d2d193c4968646bad43c5d759eae25` | 2026-10-06 | fix: preserve marketplace continuity and qualify RC rollback support | docs (1), scripts (1), src (10), tests (6) | APPROVED PRODUCT CODE |
| `05924d53f4456f1be9edad186fdc07ba998dfb29` | 2026-10-06 | docs: checkpoint V1 monitoring and incident readiness | docs (8) | SAFE DOCUMENTATION |
| `67e8971532e34fbd76b2e9a5e87cf5aa37ed5ef7` | 2026-10-06 | Reconcile Function rollback baseline and durable bridge verification | docs (3), scripts (3), tests (2) | APPROVED PRODUCT CODE |
| `26c5be77212860db1992e9904d78aa7c3f4382b8` | 2026-10-06 | Resolve Phase 1 address and Cloudflare precheck blockers | docs (1), functions (2), src (8), tests (16) | APPROVED PRODUCT CODE |
| `d2d76df09fe33b469fa0ada23fcd6e79ffd15009` | 2026-10-07 | test: distinguish publication preparation from runtime policy activation | functions (6) | APPROVED PRODUCT CODE |
| `243915787074180ded356bc6aeb09e3096e37477` | 2026-10-07 | Fix Privacy publication-facing copy | src (2), tests (3) | APPROVED PRODUCT CODE |
| `99a8c9bb8f5bb8cdfc4cec92b2d758fa99dea743` | 2026-10-07 | fix(legal): neutralize Terms and prohibited-items publication copy | src (2), tests (2) | APPROVED PRODUCT CODE |
| `33140f18256655aab976505fc7824eb9e19f5095` | 2026-10-07 | fix(legal): hide internal review labels from published routes | src (2), tests (3) | APPROVED PRODUCT CODE |
| `8065917378ce4e603d9b21276161e5bb5581b932` | 2026-10-07 | Qualify final Functions runtime pins before deployment and reopening | docs (2), scripts (4), tests (1) | APPROVED PRODUCT CODE |
| `fe02334f9c9c8c385023a3a89fdf19800d42b116` | 2026-10-07 | Fix Settings legal labels and terminal auction Save presentation | docs (1), src (7), tests (1) | APPROVED PRODUCT CODE |
| `4a55ab17e208e845bdd4223be272a4fbe05d6256` | 2026-10-07 | Simplify Sell to four stages with native-only photo preparation | docs (1), src (11), tests (3) | APPROVED PRODUCT CODE |
| `fb31b8bae897ecbf5dcd3030587c77c72aae9fe4` | 2026-10-07 | Polish marketplace status and remove frontend loading bottlenecks | docs (1), src (31), tests (2) | APPROVED PRODUCT CODE |

## Artifact and documentation review

Current-tree and outgoing-history blob scans cover credential literals, private keys, service-account JSON, bearer/OAuth/session tokens, GitHub/Stripe/AWS keys and prohibited artifact paths. Public resource identifiers, approved operator contacts and synthetic test formats are not secrets. Scans also cover reconciliation additions before commit/push. No credential or generated/private artifact is included.

- `docs/sell-v11-qualification.md` and `docs/v1-1-ux-performance-polish.md` are owner-approved repository technical summaries: product contracts, limitations, measured aggregate performance, tests and known follow-ups. They contain no raw profiles, image captures, customer payloads or credentials and remain in Git.
- HEIC conversion and Cloudflare HEIC evaluation reports are private historical evidence outside Git; neither named evaluation report is tracked in the outgoing history.
- `docs/function-rollback-baseline-reference.json` is an intentional nonsecret resource/hash reference consumed by verifier tests. Actual rollback packages, environment readbacks and evidence remain private.
- Detailed monitoring delivery receipts, release bundles, profiling captures, screenshots, logs, emulator exports and deployed build output remain outside Git or ignored.
- Current RC documentation uses private-root placeholders in place of two literal local-machine paths. Their prior nonsecret path references remain in preserved history; this cleanup is not a history rewrite or a claim that earlier text was erased.

The five pre-existing main-checkout review/probe files were backed up by hash and preserved in a scoped stash before fast-forwarding. They are not included in this baseline: `docs/auth-onboarding.md`, `docs/abuse-resistance-audit.md`, `docs/production-qualification.md`, `tests/disabled-session-emulator.probe.mjs`, and `tests/marketplace-abuse-emulator.integration.mjs`.

Ignore rules preserve legitimate source/configuration while excluding explicit local-only qualification/profiling/screenshot/export/bundle/receipt directories and private-key/profile file extensions. Existing environment, dependencies, emulator logs and build ignores remain intact.

## Push and deployment boundaries

Only a normal fast-forward `main` push is authorized after clean-tree, tests, build, scan and remote-state checks. No tags, staging or qualification branches are pushed. GitHub has no repository workflows or webhooks; the retained Netlify site has builds stopped. Cloudflare API read access returned HTTP 403. The authenticated Dashboard Settings → Builds section showed GitHub/GitLab connection buttons and no connected repository, so no automatic main deployment is configured. No permission workaround or serving configuration change is part of this task. The documented [Cloudflare trigger API](https://developers.cloudflare.com/api/resources/workers_builds/subresources/triggers/methods/list/) was used only to identify the read-only check.

Main and qualification worktrees are retained. Stale/prunable worktree registrations and the local staging branch are listed for later owner-approved cleanup; none is removed automatically. Preserve rollback evidence and the review/probe stash until separately reconciled.

## Qualification outcome

Locked root and Functions installs completed without lockfile changes. App checks: 496 PASS, 2 existing emulator-dependent SKIP (198 preparation fixture checks, 298 actual-main checks). Functions: 169/169 PASS. TypeScript, ESLint, whitespace/diff review, and the Cloudflare production build/check PASS. The build recorded 1,883 Worker artifact files with no outbound application requests under the private build network guard. Generated output and all raw logs remain ignored/private. No deployment was performed. The expanded history/current scan found 16 deliberate credential-URL rejection fixtures, all reviewed as synthetic; no genuine secrets or prohibited paths were found.
