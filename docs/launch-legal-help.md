# Launch Legal + Help / Support — local working review

## Current readiness update (5 October 2026)

The remaining historical sections record the earlier checkpoint and its verification, not current production approval. The current operator is TAKEME TECHNOLOGIES, SSM **KT0622373-U**; support and privacy/legal email are **support.takeme@gmail.com**. Registration is owner-confirmed in source. Address applicability, final Terms, final Privacy, approved BM privacy notice, final content/routes and publication remain unresolved. No legal policy was activated or published.

Current onboarding requires separate Terms, Privacy and 18+ confirmations, with server-owned versions and timestamps. Production acceptance remains closed because `functions/src/release-policy.ts` has publication approval false and both versions null. A build cannot supply policy versions or approve acceptance through environment variables.

Current legal routes have a final production branch in addition to protected staging and local demo review. Production publication requires all actual source decisions in `functions/src/legal-publication.ts`, final central policy versions, and a matching production build proof. Closed legal routes return 404 before rendering; draft captions and preview links remain conditional. Existing public Help and account-deletion information retain their operational roles. The draft dates remain proposed and must be reviewed with final content before publication.

The real production build now qualifies as `production-build` using actual SDK resource identity, actual false/null policies and explicit deletion execution off. This does not qualify launch, publish routes, activate deletion or write a policy mirror. The independent `npm run release:launch` checker remains closed until actual final policy/legal decisions and explicit deletion activation are present. See `docs/production-policy-bootstrap.md` for create-only planning and the remaining approval sequence.

Focused release/proof/bootstrap/artifact/staging/legal tests: 63 passed; TypeScript, targeted lint and diff checks passed. Full artifact/integration qualification is reported separately by the sprint.

## Historical checkpoint (3 October 2026)

Baseline: `ac17c5130718b9c8c631191be7e0a2e028761c45`. Public information work only. Approved marketplace screens, Settings functionality and account-deletion backend/flow remain frozen; Settings receives link/copy integration only. The owner approved a local draft checkpoint commit on 3 October 2026. Production access, deployment, policy publication and store submission remain unauthorised.

## Source audit

Source truth: `docs/account-deletion.md` and its owner-approved V1 retention supersede early phase documentation that predates messaging/deletion/price alerts. See `docs/store-privacy-disclosure.md` for each actual data type and module. Reviewed models, Auth/client configuration, Firestore/Storage rules, listing media, auction validation/finalisation, transactions/reviews, reports/admin, intelligence/discovery, engagement and promotion modules.

- Firebase email/password + Google sign-in; no signup Terms acceptance checkbox, acceptance version/timestamp or age check. Auth/Onboarding changes are out of scope.
- Public seller identity/listing content vs private account email/address; selected listing meet-up snapshot. Admin access is separate from ordinary user privacy.
- Participant-only text messaging and limited reported-context administration; no current message attachments, typing indicators or read receipts.
- Real offers/deals/bids/reviews, no current platform buyer funds or shipping. Stripe is a disabled architectural stub; promotion requests also have an unavailable gateway. No guarantee language added.
- Private saves/follows/searches, optional in-app alerts, authenticated recommendation signals/sessions/attribution. No external tracker SDK found. Validity/expiry fields are not certified TTL deletion.
- Existing reports support status/resolution/internal notes. No verified user suspension/removal UI or standard disputed-transaction final resolution workflow was found. Policy authority to restrict is distinct from a completed enforcement workflow.

## Owner-approved direction (3 October 2026)

- Legal operator: **TAKEME TECHNOLOGIES**, supplied directly by the owner. Customer support and privacy/legal contact: **support.takeme@gmail.com**. These are public source values in `src/content/operator.ts`; no production configuration or credentials were used. Email delivery/mailbox access was not tested.
- V1 account age: 18+. No age verification was added.
- Governing law: Malaysia, with Malaysian competent courts and preservation of mandatory rights, subject to final legal review.
- Proposed effective date: 5 October 2026. Draft last updated: 3 October 2026. Static source version `1.0-draft`; no date changes on builds.
- Detailed 18-category prohibited-items rules supplied by owner, including illegal/regulatory, weapons/drugs, counterfeits/stolen goods, sexual/exploitative content, hazardous materials, unlawful/age-restricted nicotine/alcohol, scams, malicious/illegal digital access, IP and protected wildlife, plus reasonably determined legal/safety/fraud risk. Draft `/help/prohibited-items` contains those rules and truthful reporting limits.
- Backups/logs: limited documented necessary retention, restricted purposeful/expiring security holds, no immediate erasure promise. Restores must reapply deletion state/cleanup before deleted accounts/data can become active. **This is an approved operational requirement, not an implemented automated recovery mechanism.**

## Routes and publication boundary

| Route | Local implementation |
| --- | --- |
| `/privacy` | Comprehensive English working draft: actual data, visibility, provider processing, choices, age, approved deletion/retention, backup/restoration requirements. |
| `/terms` | Working draft for current marketplace role, parties’ responsibilities, offers/auctions, content permission, rules, reports, deletion, limitations and Malaysian-law direction. |
| `/help` | Public V1 FAQ across nine topic groups; existing behavior and practical navigation, no payment/protection promises. |
| `/contact` | Local review page identifying TAKEME TECHNOLOGIES, with owner-supplied customer support and privacy/legal mailto links plus Help/account/report paths. No invented registration, address, phone or contact form. |
| `/account-deletion` | Existing public disclosure and authenticated flow, same backend/component; compact public wrapper/header/footer and canonical metadata only. |
| `/privacy-policy` | Compatibility redirect to `/privacy`. |
| `/help/prohibited-items` | Owner-supplied rules draft; no pre-approval/authentication claim. |

Incomplete Privacy/Terms/Contact/rules drafts are **not publishable**. The server gate permits only `NODE_ENV=development`, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-takeme`. Otherwise they return HTTP 404, including the local production build and the legacy privacy alias. `src/proxy.ts` enforces this before rendering because a streamed Next `notFound()` alone can return HTTP 200. The page-level guard remains in place. No browser/query parameter bypass exists. All legal/contact drafts are noindex/nofollow. This gate must not be removed until required owner facts, final legal review and publication permission exist.

Drafts do not display business/contact template tokens or pretend that unknown facts are known. Contact is explicitly local development review. Existing metadataBase resolves canonicals; no production origin was guessed. `/help` and `/account-deletion` remain public in source; publication and production deletion enablement are separately prohibited.

Exact public paths use compact TAKEME navigation and footer without bottom app navigation. Existing mobile Home/Profile/Settings footer suppression is preserved. Website footer adds compact Help/legal links. Settings routes only receive draft/legal destinations and a full public Help link; their supported forms, private lifecycle guards and original Help/Safety content are not redesigned.

## User input required — real values still missing

The operator name and support/privacy/legal email are now confirmed by the owner and incorporated into Privacy, Terms, Contact and the existing Settings Help support card. The initial template answers remain unresolved only for these fields:

| Missing field | Why needed | Placement |
| --- | --- | --- |
| Registration number/status, if applicable/intended | Accurate entity details; do not imply registration | Operator/contact section where legal review requires it |
| Approved publishable business/mailing address, if required | Operator and legal/privacy correspondence | Policy/contact details |

No repeat jurisdiction/age/date/prohibited-rule input is needed. Still required operational decisions: actual limited backup/log periods and provider retention/hosting configuration; deletion-safe recovery procedure/validation; standard disputed-deal resolution ownership/channel. Owner/legal review must approve Bahasa Melayu privacy notice and applicable Malaysian data-access, cross-border, incident/DPO requirements before launch. These are not solved by an English draft alone.

## Existing deletion consistency

Privacy matches operation 30 days; counterparty ordinary messages maximum deal closure +90 days (no-deal cleanup +90); minimal pseudonymised closed history 12 months; closed case evidence closure +180; explicit security/fraud purpose/expiry; backups/logs separate. Cleanup success is conditional on actual Auth deletion. Active auction/deal/case pending, reauthentication/retry and honest winner/outcome handling are preserved. No deletion callable, component, lifecycle guard, rule or retention code is changed.

## Store review and launch gaps

`docs/store-privacy-disclosure.md` prepares a source inventory for both Apple App Privacy and Google Play Data Safety, not submission answers. Official references were checked online. Privacy URL and in-app link, public deletion entry and documented data practices are covered locally. Real HTTPS publication, store developer/operator identity alignment, remaining entity details where required, native SDK/platform audit, legal approval and production deletion enablement remain prerequisites. No store forms were opened/submitted.

Terms content licence/limitations/jurisdiction need operator-specific legal approval. Current signup contains no Terms/Privacy acceptance/version persistence; no new acceptance UI was added. The prohibited-items policy was missing at baseline; the owner has now supplied V1 rules and their local draft route. Moderation removal/suspension/appeals and standard disputed-deal resolution still need an operational launch workflow; existing report review is narrower.

## Verification

Owner-details follow-up (3 October 2026): confirmed operator and shared support/privacy/legal email integrated into the policy introductions/enquiry links, Contact and the existing Settings Help support card. Application tests **105/105**, TypeScript, ESLint, build and diff checks passed again. Updated Privacy/Terms/Contact checked at all five requested viewport sizes (15 combinations): confirmed operator text, correct `mailto:` recipients, 44px control height and no horizontal overflow. Corresponding screenshots refreshed outside Git. Local production-build checks still block the three drafts with HTTP 404; Help/account deletion remain 200. No email was sent and no mailbox/SMTP/delivery was tested. The production test server was stopped.

- Application tests: **105/105** passed, including the exact public-route boundary and strict demo-only draft-preview guard.
- Functions tests: **47/47** passed. No Functions source changed.
- Settings emulator integration: **10/10** groups passed against `demo-takeme` only, covering profile/private-address separation, meet-up CRUD/defaults, avatar ownership/limits, optional vs essential notification preferences, connected Auth providers, password reset and logout. Expected permission-denied assertions passed.
- TypeScript `--noEmit`, ESLint, production build and `git diff --check`: passed. Read-only final scope review confirmed no changes to deletion implementation, lifecycle/retention code, Firebase rules/configuration, dependencies, marketplace services or approved screen implementations.
- All five public routes validated signed out at **390×844, 393×852, 430×932, 768×1024 and 1440×900** (25 route/viewport combinations), with one H1, no horizontal overflow and no broken images. Public pages have compact navigation/footer and no app bottom navigation. Final 390×844 visible links, inputs, buttons and summary controls meet 44px minimum height.
- Keyboard checks: mobile section disclosure, retention anchor and focus, skip-to-content and FAQ Enter expansion passed; headings clear the sticky header. Desktop contents is separately scrollable so long legal outlines remain reachable in a 900px viewport.
- Logged-in disposable demo account: Settings Terms/Privacy links, internal Privacy-to-policy link, full Help link, Safety and Delete account destinations passed. Public deletion sign-in returns through `/login?next=/account-deletion`; authenticated form still requires current password and typed confirmation. No deletion was submitted for this browser regression.
- Mobile regression: loaded Home, Explore, Profile, Settings and Messaging empty state checked at **390×844**, with no horizontal overflow, appropriate existing navigation and no reintroduced marketplace footer. Existing demo listings used; the disposable review account had no deals or conversations. Full Messaging offer journeys were not rerun because no messaging implementation changed.
- Local production-build HTTP checks: Privacy/Terms/Contact/rules/legacy alias **404** with no draft content; query preview bypass **404**; Help/account deletion and Home/Explore/Profile/Settings/Messages **200**. The development legacy privacy alias returns HTTP **307** to `/privacy`. Help omits links to unpublished rules/Contact in the production build. Test server stopped afterward; no remote production service used.
- Seven required screenshots saved outside Git in `/tmp/takeme-legal-review/`, plus supplementary regression captures/results. The disposable Auth/profile/activity fixture and its temporary credential file/script were removed. Existing `tests/messaging-ui-fixture.mjs` remains ignored.

Two local installed/generated type-cache problems were repaired without changing dependencies: verified empty duplicate `@types/* 2` folders and duplicate generated `.next` declarations were reversibly moved to `/tmp/takeme-legal-empty-type-cache` and `/tmp/takeme-legal-generated-type-cache`. Canonical installed packages remain intact; no install or lockfile change was made.

Verification was completed against baseline `ac17c5130718b9c8c631191be7e0a2e028761c45` plus the changes described here. The owner approved these as a local draft checkpoint; registration/address fields remain unresolved and publication stays blocked. Screenshots, logs, fixtures, credentials and verification artifacts are excluded from the checkpoint. No push, deployment, policy publication, deletion enablement or store submission occurred.
