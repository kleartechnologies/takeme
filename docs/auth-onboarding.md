# Authentication + lightweight onboarding — local review

Baseline: `b864dbea580c7f411a14633494da3209aa71ab1e` (Launch Legal + Help draft checkpoint). Changes remain uncommitted for owner visual and launch review. Only `demo-takeme` emulators were used; no production credentials, `.env.local`, installation, deployment, publication or store submission.

## Existing architecture and preserved behavior

Firebase email/password and Google popup sign-in are the supported providers. No Apple, phone, Facebook, passkey or 2FA implementation exists in this repository. Separate `/login` and `/register` routes are preserved; there is no email-account detection request. Firebase browser session persistence, sign-out, shared transactional profile bootstrap, existing Firestore/Storage rules, public-profile services and deletion reauthentication remain in place. Mandatory email verification was not present and has not been introduced.

The auth screens use approved TAKEME typography, logo, colors, inputs and buttons. Desktop uses a 440px form card; mobile uses a simple scrollable form without fixed marketplace navigation. Google uses the official G image, obtained from Google's branding documentation. The official Happy 3D mascot appears only on the single welcome screen. The private onboarding route tree is noindex/nofollow. Approved marketplace, Settings, deletion and legal screen implementations are unchanged; shared chrome hides only on the six exact auth/setup routes.

## Flow and acceptance boundary

- Email signup asks only for email/password and two initially unchecked confirmations: age 18+, and combined Terms/Privacy agreement. Both are required before creating the Auth identity through this form. Profile information follows separately.
- New Google authentication leads to `/onboarding/acceptance`, then `/onboarding/profile`, then one `/onboarding/welcome` screen. An Auth identity necessarily exists before Google's acceptance step; it is not a completed TAKEME onboarding record.
- Acceptance and completion are determined from authenticated backend status, not localStorage. Missing/current-version acceptance, profile completion and welcome completion select the next required step. Completed returning email/Google accounts skip setup.
- A partial Auth/bootstrap/acceptance failure can leave an authenticated identity. The form offers continuation/retry using that identity rather than creating a duplicate account. Profile/status failures have retry paths, and errors retain entered fields.
- Any lifecycle marker takes priority over onboarding. Pending accounts go to `/account-deletion`; already approved messages/deal-resolution routes and public information remain available. Normal marketplace views do not mount for an incomplete local account or an unresolved status request. Existing backend lifecycle guards remain authoritative; bootstrap still cannot recreate a profile under a lifecycle marker.
- Authenticated incomplete demo accounts are gated at the application UI. Existing marketplace callable/rules authorization is not rewritten into a global consent enforcement or policy re-consent engine. This checkpoint must not be described as production-ready consent enforcement.

The `next` destination is validated as a local path, rejecting external destinations, control characters, backslashes and auth/setup loops. It survives login/signup, acceptance, profile and welcome. Save, Follow, Chat, Make Offer, Sell and Bid preserve their existing sign-in prompts. Bid return does not place a bid or open a bid sheet; a separate explicit action is still required.

## Private server-owned record

`users/{uid}/private/onboarding` is not a public profile field. Existing default-deny rules deny direct reads/writes, including the owner; authenticated callables expose only the setup step. Callers cannot choose another UID, acceptance source or timestamps.

| Field | Stored value |
| --- | --- |
| `termsVersion`, `privacyVersion` | Stable approved local draft identifier `1.0-draft` |
| `termsAcceptedAt`, `privacyAcceptedAt` | Separate Firestore server timestamps |
| `age18ConfirmedAt` | Its own Firestore server timestamp; no inferred age or date of birth |
| `acceptanceSource` | `web`, set by the dedicated web callable |
| `profileCompletedAt` | Server timestamp after the existing public-profile service saves a valid display name |
| `welcomeCompletedAt` | Server timestamp after the single welcome action |

`acceptWebPolicies`, `completeFirstTimeProfile` and `finishAccountWelcome` use the existing lifecycle-protected callable/transaction infrastructure, including a lifecycle check in the write transaction. Retries preserve original completion/acceptance timestamps. Status checks validate that the actual Firebase Auth user exists and is enabled. The approved account-deletion recursive user cleanup removes this private subdocument; the integration suite verifies both record removal and actual Auth deletion.

The web preview requires development mode, emulator mode and exact project `demo-takeme`. New setup callables require exact demo project plus loopback Auth/Firestore hosts. Other environments reject draft setup. Terms/Privacy/Contact publication guards remain unchanged: these drafts remain unavailable in a production build. Production policy/signup activation requires separate approval and implementation review.

## Profile, password and accessibility behavior

Profile setup uses the existing 2–80-character display-name validation and public-profile/avatar service. Email is not used as the public default. Google/provider names may prefill; the generic fallback becomes an empty required name. Photo and general district/city plus Malaysian state are optional and can be skipped/cleared. No private address, precise location, DOB, seller verification or payment data is collected.

Signup uses Firebase `validatePassword` policy data; returning login adds no new strength rule. The Auth emulator explicitly does not implement `getPasswordPolicy`. Only that specific unsupported-emulator error, on the explicit demo emulator connection, uses a six-character fallback. Real emulator signup rejects five and accepts six characters. Ordinary network failures do not use this fallback.

Reset email preserves the existing Firebase flow and returns the same generic success for existing/unknown accounts. Account-deletion password/Google reauthentication is unchanged. Passwords/provider tokens are not logged. Error copy hides raw codes, error regions are announced/focused (including repeated identical validation), and ref guards prevent duplicate submission. Inputs have linked labels, suitable types/autocomplete, 16px text, accessible password visibility and 44px primary controls/checkbox rows. Legal links are keyboard reachable and announce their new-tab behavior. Short viewport content remains scrollable.

## Verification completed

Node 22.23.2 and the existing OpenJDK 21 emulator session; Auth 9099, Firestore 8080, Storage 9199, Functions 5001, Emulator UI 4000 and Next 3000. Explicit `demo-takeme` project and emulator mode throughout.

- App tests: **109/109 passed**. Functions: **50/50 passed**.
- New auth emulator integration: **11 groups passed**, covering email and mock Google setup, strict independent age/Terms/Privacy validation, server-owned versions/timestamps/source, account isolation, direct-read/write denial, profile completion, returning accounts, duplicate/wrong-password/actual password minimum, reset and reauthentication, pending/stale-token guards, real deletion cleanup and unavailable local Auth failure.
- Approved account-deletion emulator suite: **32/32 passed**. Settings emulator suite: **10/10 groups passed**. The local maintenance worker was paused for deletion fault injection and resumed afterward.
- TypeScript `--noEmit`, ESLint, production build with explicit demo configuration and `git diff --check`: passed.
- Browser: new email signup; new and returning Google through the emulator mock popup in Chrome; returning email; wrong password; duplicate email; unchecked confirmations; profile/avatar/area skip; one welcome; logout/login and reload persistence; generic reset success for existing/unknown addresses; keyboard password toggle, legal-link tab order and repeated-error focus. No real Google OAuth credentials or production provider configuration were tested.
- Real pending-deletion demo account redirected from Sell to deletion status, retained legitimate deal-resolution access, and was later removed by the approved deletion process. Normal bootstrap/acceptance did not resurrect it.
- Save/Chat/Offer/Follow return paths, first-time Google-to-Sell continuation and Bid return passed. Signing in did not submit a marketplace action or place a bid.
- Signed-out Profile, Settings, Saved, Messages, Sell and Updates are guarded. Home, Product Detail, Seller Profile, Privacy, Terms, Help, Contact and deletion information remain accessible locally without an account.
- Six auth/setup screens checked at **390×844, 393×852, 430×932, 768×1024 and 1440×900**: 30 combinations without horizontal overflow. Reduced-height 390×500 scrolling checked. These are browser viewport checks, not physical iOS/Android keyboard tests.
- Frozen Home, Profile, Settings, Account Deletion and Product Detail reviewed at 390×844; Messaging empty inbox and public seller also checked. No approved screen was redesigned. Existing Messaging offer journeys were not rerun because their implementation is unchanged.

Screenshots, logs and browser verification results are outside Git in `/tmp/takeme-auth-review` and `/tmp/takeme-auth-*.log`. Test identities/passwords are generated in memory; no credential fixture was added to tracked source. `tests/messaging-ui-fixture.mjs` remains locally excluded. Temporary duplicate ignored `.next` declaration files were removed after TypeScript identified duplicate generated declarations; canonical installed dependencies/source files were unchanged.

## Launch items still requiring approval

Operator/support values remain **TAKEME TECHNOLOGIES** and **support.takeme@gmail.com**. Applicable registration/address details, final legal review/publication, native SDK/platform audit and prior deletion/retention operational gaps remain as documented in `launch-legal-help.md` and `account-deletion.md`. This local draft does not publish legal URLs or enable production deletion/acceptance.

Apple Sign In is absent; no native iOS project was found. If the final native iOS app offers Google for its primary account and no exception applies, Apple App Review Guideline 4.8 requires an equivalent login option with the stated privacy properties. Sign in with Apple or another compliant option needs an explicit native launch decision/review; none was fabricated here. Google was verified only through the local Auth emulator mock flow. Store submission is not approved by this checkpoint.

Primary references: [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Google branding](https://developers.google.com/identity/branding-guidelines), [Apple App Review Guidelines, 4.8](https://developer.apple.com/app-store/review/guidelines/).

The owner approved this implementation as a local checkpoint commit. Production policy acceptance, deployment, legal publication and store submission remain blocked pending separate approval and launch review.
