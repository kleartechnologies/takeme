# Admin session revocation boundary

Local security checkpoint only; no deployment, cloud account, claim, or production change is authorized by this checkpoint.

## Verification contract

`verifyAdminIdentity` is shared by the dedicated-app handshake, editorial callables and existing marketplace/admin callables. The Firebase callable transport's decoded claim is insufficient: the boundary extracts the bearer ID token and calls Firebase Admin `verifyIdToken(token, true)`. The SDK validates signature, issuer, audience, expiry, disabled-user state and revocation. The verified UID must match the callable identity, the verified token must carry the boolean claim `admin === true`, and expiry must be a future integer timestamp.

A fresh, admin-only `getUser(uid)` read additionally requires current `customClaims.admin === true` and an enabled user. There is no email/UID allowlist or cross-request authority cache. This extra point read is required to enforce current role removal even when an issued token still embeds the old claim. The SDK revocation check also performs an Auth lookup; existing marketplace lifecycle/eligibility guards remain intact. These bounded checks are deliberately confined to admin authentication, not consumer AuthProvider or public-first browsing.

## Cookie model and reuse

`takeme-admin-session` is an HttpOnly ID-token cookie, not a Firebase `createSessionCookie()` credential. Consequently `verifySessionCookie()` would be the wrong verifier. Creation validates the ID token through `getAdminSession`; every protected server-session read calls the same backend again with `cache: no-store`. Direct admin callable actions also pass through the shared verifier, so a mounted/stale client cannot bypass revocation merely by retaining its old token. No privileged result is cached across requests.

The lifetime is bounded by the verified ID token's remaining expiry and a 3,600-second ceiling; it is not renewed beyond token expiry. Cookies use HttpOnly, SameSite Strict, path `/`, and Secure on HTTPS. Tokens with less than one whole second left cannot create a cookie. Failed creation returns no UID/future expiry and never sets a usable session cookie; an existing cookie may receive a deletion tombstone. No session record or successful-login audit event is written. Same-origin checks protect cookie creation/logout; ordinary logout only clears the admin cookie, without revoking all account sessions.

Already-rendered UI cannot be remotely erased by revocation. The next protected server read or admin backend request denies access after Firebase exposes the revoked/current-role state. Admin Storage rules still use their existing token-claim/permit model; this checkpoint neither changes rules nor claims instant Storage revocation from role removal alone. Staging must qualify that boundary separately.

## Required operator removal procedure

1. In the explicitly approved Firebase project, retrieve the operator's custom claims using trusted Admin SDK tooling.
2. Remove only `admin`, preserving unrelated claims; await `setCustomUserClaims(uid, remainingClaims)`.
3. Immediately await `revokeRefreshTokens(uid)`.
4. Read back the current user: admin must be absent/false and `tokensValidAfterTime` must reflect the revocation.
5. Test the old ID token AND an already-issued admin cookie: both must be denied. The old authentication timestamp must precede the revocation timestamp; Firebase's revocation comparison has second-level resolution. Do not declare removal complete solely from the UI or a same-second test.
6. If either step/readback fails, stop operator admission and investigate; do not restore a stale session. Any later reinstatement requires separately approved authority and fresh authentication.

Removing a Firebase custom claim does not rewrite tokens already issued. TAKEME's additional current-user read denies admin callables when it observes removal even without revocation; the explicit two-step procedure is still required to invalidate prior credentials under Firebase's supported revocation model and cover other token consumers. No cloud removal command was executed in this task.

## Failure handling and qualification

The admin boundary returns one generic message: “Admin access is no longer available. Please sign in again.” SDK details, token contents, cookies, claim history and account existence are not returned or logged. This boundary adds no token-bearing logs.

Offline tests execute actual compiled handlers and the SDK revocation algorithm with synthetic JWT-validation/Auth collaborators. Dedicated-app tests execute the real cookie route and server-session reader with an in-memory cookie store and the shared verifier. Demo-only emulator integration exercises real Auth issuance, current-claim removal, refresh-token revocation and direct admin endpoint denial. Emulator tokens do not prove production cryptographic verification; production validation is delegated to the supported Admin SDK verifier and must be qualified in isolated staging next.

Required matrix: valid admin; normal account; forged/malformed token; expired token; revocation only; claim removal plus revocation; claim removal alone/current-role denial; verified UID mismatch; disabled user; Auth failure; valid existing cookie; revoked/expired/malformed existing cookie; cross-origin denial; same-origin cookie creation and logout; no cookie issuance on failure. Existing editorial, privacy, campaign, asset and consumer regressions remain required.

References: [Firebase session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions), [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).

## Local checkpoint results

- Original stale-admin/revocation scenario: rejected by the compiled handshake using the real SDK revocation algorithm and synthetic offline JWT-validation/Auth collaborators; `checkRevoked=true` observed.
- Functions: 189/189 pass, including 15 focused admin-session regressions.
- App: 524 pass, two pre-existing skips; 14 focused cookie/session regressions included.
- Real demo Auth issuance/revocation: 20 integration assertions pass; existing editorial/Storage/privacy integration: 70 assertions pass.
- Independent admin and consumer production-mode builds, the admin OpenNext build and Wrangler dry run pass with outbound network blocked. TypeScript is qualified against clean isolated generated files because the working checkout contains pre-existing duplicate ignored cache/type files; Functions use explicit Node types. No ignored files or dependencies were removed or changed.
- Cookie-route coverage uses the real route/server-session source with an in-memory Next cookie store; real HTTPS cookie/browser behavior and staging cryptographic credentials remain part of the next staging qualification.

Staging qualification may resume from this scoped security checkpoint. It is not a production or staging deployment authorization, and no cloud deployment was performed.
