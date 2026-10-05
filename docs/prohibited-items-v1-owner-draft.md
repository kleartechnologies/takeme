# TAKEME Prohibited Items Policy v1.0 owner draft

This is a local content-preparation checkpoint based on the reviewed 18-category TAKEME rules and the owner's requested V1 coverage. It does not grant final Malaysian legal approval, publication approval or activation permission. No frontend, Functions or rules deployment, remote policy write, deletion activation or infrastructure change forms part of this work.

## Source and policy alignment

- The original `prohibitedItems` array is preserved verbatim, in order. The expanded sections explain those rules and add the requested hazardous, exploitative, fraudulent, digital, health and regulated-item examples.
- Broader existing bans on firearms/ammunition/explosives/regulated weapons, unauthorised replicas, pornography/explicit sexual content/services, and unlawful or age-restricted alcohol/nicotine remain TAKEME platform restrictions. They are not assertions that every instance is inherently unlawful. Lawful restricted goods are not automatically permitted on TAKEME.
- Version comes from `productionReleasePolicy.termsVersion` and remains `1.0`. Dates come from `legalPublicationReadiness` and remain null. Publication requires both central policy approval and the existing legal-publication readiness gates; neither has changed.
- Confirmed operator details are reused: TAKEME TECHNOLOGIES, SSM KT0622373-U and support.takeme@gmail.com. The business address remains null with `LEGAL REVIEW / OWNER INPUT REQUIRED`.
- The existing Terms v1.0 links already reference `/help/prohibited-items`; no Terms or English/BM Privacy content changes are needed. The policy remains incorporated into Terms rather than introducing another consent/version system.

## Product and enforcement boundaries

The draft covers listing eligibility and marketplace conduct. References to illegal digital or service offers do not announce a new digital-goods or services marketplace. There are no active integrated payment, payout, shipping/AWB, Seller Centre, video/live commerce or push-notification claims.

Enforcement rights are framed as reasonable policy measures, including removal/hiding, restrictions, documentation requests and report investigation. The page does not promise automatic moderation, police reporting in every case, authentication of every item, guaranteed outcomes or an implemented formal appeals system. Existing in-app Report actions and support contact are referenced; support can review claimed errors without a guaranteed reversal or deadline.

Evidence preservation and authority reporting remain subject to applicable law, restricted access and legal review. This content does not change any retention, deletion or evidence-handling implementation.

## Regulated-category context and unresolved review

The wording intentionally avoids asserting that all alcohol, nicotine, medicines, health products or wildlife products have the same legal status. Online sale, authorisation, age, product-safety and advertising requirements still need category-specific counsel review. An adult account is not permission to list age-restricted or otherwise prohibited products.

Primary-source context checked during preparation:

- [MOH Act 852 enforcement FAQ](https://infosihat.moh.gov.my/images/media_sihat/lain_lain/Akta%20852%20%26%20Akta%20Makanan%20Pindaan%202024/FAQ%20PELAKSANAAN%20PENGUATKUASAAN%20AKTA%20852.pdf) addresses smoking-product sale restrictions, including online-sale controls. Final scope must be checked against applicable law and regulations, rather than assuming an age check permits a listing.
- [MOH medicine-registration guidance](https://pharmacy.moh.gov.my/en/faq/how-identify-medicines-are-registered-moh.html) and [NPRA cosmetic guidance](https://www.npra.gov.my/index.php/my/cosmetic-main-page) distinguish regulated product requirements. The draft leaves sellers responsible for lawful sale and truthful claims, without presenting a TAKEME listing as regulatory approval.

Explicit `LEGAL REVIEW REQUIRED` markers remain for exact regulated-goods scope, weapons/accessories, drugs/medicines/health products, alcohol/tobacco/nicotine, wildlife/environment, intermediary reporting, and enforcement/evidence-retention duties. Final policy wording, the publishable business address and actual launch dates also remain unresolved. No statute-specific exemption, species list, retention period or licensing workflow is invented.

## Route and metadata

`/help/prohibited-items` uses the existing legal-information availability guard and shared mobile/desktop legal renderer. Its custom review notice describes an unpublished draft without demo/staging text. Metadata uses the policy title, canonical route and matching Open Graph title; the closed publication gate yields `noindex, nofollow`. Dates are shown as pending, with no invented date or `<time>` value.

## Verification

- Full app suite: 334/334 pass, including 23 new prohibited-items tests and the existing Terms/Privacy/legal-route and policy-source checks. No failures, skips or cancellations.
- TypeScript `tsc --noEmit`, full ESLint and `git diff --check`: pass.
- Local browser inspection at 390×844, 430×932 and 1440×900: all 18 sections render; no horizontal overflow or broken displayed image; no console warnings/errors or hydration entries observed.
- Mobile contents disclosure works with the keyboard; activating a section link focuses its heading. Reporting/support links remain reachable. Desktop contents remain available alongside the article.
- Policy → Terms → policy client navigation and policy refresh pass. Terms still renders its 35 sections. Draft metadata is `noindex, nofollow`; there are no rendered date values or demo/staging text in the policy article.
- Protected source hashes confirm Terms, English/BM Privacy, operator identity and central publication/policy gates are unchanged. Main HEAD and its pre-existing review files are unchanged. The original 18-category array is byte-for-byte identical to the approved source.

Browser checks used only the local demo-qualified legal preview; no production or remote staging resources were accessed. Screenshots, browser logs and test output remain outside the repository. These results qualify the local owner draft, not final legal compliance, production publication or live moderation execution.

Changed files are limited to the policy content, `/help/prohibited-items` route, its metadata helper, prohibited-items tests and this review document. No commit, push, deployment, policy activation, deletion enablement or infrastructure change was performed.
