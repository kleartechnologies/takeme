# Settings / Account V1 — local review

Baseline account deletion: `ed80675f258bad1eeb772022975d37cf3a85e9a2`. Its backend, frontend flow, lifecycle guards, retention implementation, rules and public deletion route are unchanged.

## Supported features and routes

| Feature | Route and behavior |
| --- | --- |
| Settings | `/profile/settings`: grouped utility menu, compact mobile header, desktop navigation, existing Firebase logout. |
| Edit profile | `/profile/settings/edit`: existing `updatePublicProfile` service and avatar path; display name, photo and general Malaysian area only. JPG/PNG/WebP up to 8 MB. Both location fields may be cleared. |
| Addresses / meet-up | Existing `/profile/locations`: private address summary and edit form; saved-place add/edit/remove/default. Private addresses are never copied into public listing locations. A saved default does not replace explicit listing selection. Removing a place leaves existing listing snapshots unchanged. |
| Notifications | Existing `/notification-preferences`: eight backend-supported optional categories, In-app/Off. Essential offers, transactions, disputes and auction wins remain on. Profile Notifications and Updates settings both point here. |
| Privacy | `/profile/settings/privacy`: accurate visibility information, profile/address management links and unpublished-policy status. No decorative visibility switches. |
| Security | `/profile/settings/security`: actual Firebase `providerData`, private account email and existing password-reset email helper for password accounts. Google-only accounts receive provider-specific guidance. |
| Help | `/profile/settings/help`: small FAQ based on existing buying/selling/offers/auction/messages/account behavior; existing tiers and deletion links. |
| Safety | `/profile/settings/safety`: practical guidance and navigation to existing listing/conversation report actions. No new reporting backend or payment guarantees. |
| Legal status | Public `/terms` and `/privacy-policy` placeholders explicitly say no policy is published. No invented policy or acceptance mechanism. Both are noindex. |
| Account deletion | Settings links to the existing `/account-deletion`. Pending accounts are redirected there instead of mounting normal Settings forms. |

Settings waits for authentication and an owner-scoped lifecycle check before mounting private content. All eight utility routes redirect signed-out visitors to the existing login route with a return path. Private form components remount by UID on account changes. Backend access rules and callable authorization remain authoritative and unchanged. Save/reset feedback is announced, forms have labels, controls meet the 44px target, and inline location forms move/restore keyboard focus.

## Launch status

| Area | Status |
| --- | --- |
| Privacy Policy public route | **Partial / launch-critical gap:** honest local placeholder exists; approved public policy missing. |
| Terms public route | **Partial / launch-critical gap:** honest local placeholder exists; approved Terms missing. |
| In-app deletion | **Implemented and verified locally:** existing demo-only authenticated workflow preserved. Production enablement requires separate authorization and review. |
| Public account deletion | **Implemented locally:** accessible without an account, secure sign-in initiation; URL not published/deployed. |
| Help Centre | **Implemented:** concise V1 FAQ. |
| Direct support contact | **Missing:** no verified channel found; no email or phone invented. |
| Safety / reporting | **Implemented:** guidance and existing Report controls. Report submission does not promise a response time or outcome. |
| Logout | **Implemented:** existing Firebase sign-out. |
| Notification preferences | **Implemented for in-app delivery:** eight optional categories. Push/email/SMS/digests deferred. |
| Language | **Deferred:** English only; no localization picker. |
| Security / password management | **Implemented within current support:** email/password and Google provider display, existing reset-email flow. Advanced security features deferred. |

Persistent blocked-user management, username, bio, configurable privacy, 2FA and device/session management are unsupported and omitted. Existing dispute/admin-resolution and production deletion launch gaps remain as documented in `account-deletion.md`.

## Verification

All Firebase interaction used `demo-takeme` with Auth 9099, Firestore 8080, Storage 9199 and Functions 5001. No production credentials, `.env.local`, default project, remote deployment or publication was used.

- Browser: profile/name/general-area save, existing avatar upload, rejected street-address location, private address, meet-up add/edit/default/remove, notification persistence, actual connected providers, emulator reset-email request, Help keyboard interaction, Safety/report navigation, logout and account switching.
- Owner isolation: second browser account showed no first-account address, places, preferences or Google connection; emulator tests deny unauthorized reads/writes. Reset requests were checked only in emulator OOB records, without displaying codes.
- Deletion: approved 32-check emulator suite; browser failed reauthentication, real pending state, Settings redirect, two-party cancellation of a disposable agreed demo deal through existing resolution callables, reauthenticated retry, actual Auth/data/file deletion and unaffected second account.
- Responsive: all eight Settings views at 390×844, 393×852, 430×932, 768×1024 and 1440×900; no horizontal overflow. Mobile control heights checked. A hidden-file-input width regression was corrected within Settings CSS.
- Frozen surfaces: Home, Explore, Profile, Updates, Saved, Messaging inbox/conversation at 390×844; product Report form and conversation-sheet focus/escape also checked. Profile changed only its Notifications destination; Updates remains unchanged.
- Automated: 103 app tests, 47 Functions tests, Settings emulator integration (10 groups), existing location callable/privacy suites adapted outside Git to the same demo project/ports and scoped to their unique fixture seller, TypeScript, ESLint and local production build.

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run test:functions
PATH=/opt/homebrew/opt/node@22/bin:$PATH node --experimental-strip-types tests/settings-emulator.integration.mjs
PATH=/opt/homebrew/opt/node@22/bin:$PATH node --experimental-strip-types tests/account-deletion-emulator.integration.mjs
PATH=/opt/homebrew/opt/node@22/bin:$PATH npx tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run lint
PATH=/opt/homebrew/opt/node@22/bin:$PATH NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-takeme npm run build
```

Pause the local deletion maintenance runner during fault-injection integration tests, then resume it. No changes to that runner were needed.

Screenshots/logs/browser fixtures are outside Git under `/tmp`. Integration credentials are generated in memory, not committed. The existing credential fixture `tests/messaging-ui-fixture.mjs` remains locally excluded.

Local environment repairs: empty duplicate `functions/node_modules/@types/* 2` directories were reversibly moved to `/tmp/takeme-settings-empty-type-cache`; canonical installed types were intact. The previous Turbopack dev process stalled compiling Updates, so the session was restarted with `next dev --webpack` and the same explicit demo environment. Neither repair changes tracked configuration or frozen screen sources.

Settings / Account is approved for a local commit. Production deployment and publication require separate authorization.
