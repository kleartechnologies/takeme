import type { InformationSection } from "@/components/public-information/public-information";
import { productionReleasePolicy } from "../../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../../functions/src/legal-publication.ts";
import { marketplaceOperator } from "./operator.ts";
import { legalOperatorDisclosure } from "./operator-disclosure.ts";
import { prohibitedItemsPolicy } from "./marketplace-rules.ts";

// Owner-approved content model only. Existing central gates still control
// legal approval, publication and activation; this object does not grant consent.
export const termsDocument = Object.freeze({
  title: "TAKEME Terms of Service",
  version: productionReleasePolicy.termsVersion,
  minimumAge: productionReleasePolicy.minimumAge,
  effectiveDate: legalPublicationReadiness.effectiveDate,
  lastUpdated: legalPublicationReadiness.lastUpdated,
  operator: marketplaceOperator,
  ...legalOperatorDisclosure(),
  reviewNotice: "Owner-approved draft content model for Malaysian legal review. This document is not in effect and has not been published. Final legal counsel approval, the actual public launch date and separate publication approval remain required.",
});

export const termsSections: InformationSection[] = [
  { id: "about", title: "1. About TAKEME", paragraphs: [
    `TAKEME is operated by ${marketplaceOperator.name} (SSM ${marketplaceOperator.registrationNumber}). These Terms describe use of the TAKEME marketplace.`,
    "TAKEME provides tools to discover products, create listings, buy and sell directly with other users, message, negotiate offers, bid in auctions, Save items, follow sellers and manage marketplace activity. These Terms cover the current V1 service; conditional references to future services do not mean those services are available today.",
  ] },
  { id: "eligibility", title: "2. Eligibility", paragraphs: [
    `You must be at least ${productionReleasePolicy.minimumAge} years old (18+) to use a TAKEME V1 account and perform protected marketplace actions. You must expressly confirm this age requirement. The current signup does not collect a date of birth or independently verify age.`,
    "If acting for a business, you must have authority to act for it and comply with applicable obligations. Do not create an account for a child or misrepresent your age or authority.",
  ] },
  { id: "browsing", title: "3. Browsing Without Acceptance", paragraphs: [
    "Public browsing may remain available without current Terms or Privacy acceptance. This includes Explore, public listings, public seller profiles and other approved public marketplace content, whether you are signed out or signed in with missing or outdated acceptance.",
    "Current Terms and Privacy acceptance and explicit 18+ confirmation are required before protected marketplace writes such as Sell, Chat, Offer, Bid, Save, Follow, uploads and other actions covered by account eligibility. Login or page refresh alone never counts as consent.",
    "If authentication or reacceptance is needed, TAKEME preserves the intended screen or action context. Returning after authentication or acceptance does not automatically send a message, offer or bid, Save or Follow, publish a listing or execute a purchase-like action. You must confirm or tap again.",
  ] },
  { id: "account", title: "4. Your TAKEME Account", paragraphs: [
    "Use accurate account information, keep credentials and verification codes private, and use only accounts you are entitled to access. Do not impersonate another person, abuse account systems or evade lawful safety restrictions. You are responsible for the content and activity you submit through your account.",
    "A policy version change does not itself delete or rewrite your profile, listings, messages, auctions, Saved or following records, or end your existing session. Missing or outdated acceptance permits public browsing but prevents protected writes until you expressly accept the current policy. Earlier acceptance evidence is preserved as implemented; refresh and login do not replace it.",
  ] },
  { id: "one-account", title: "5. One Account for Buying and Selling", paragraphs: [
    "TAKEME uses one account with both buying and selling capabilities. You do not need to choose a separate buyer or seller account type. You become an active seller by choosing to list an item later.",
    "Normal first-time onboarding leads to the marketplace through Start Exploring. Sell Something is a separate optional choice. A preserved explicit Sell intent can return you to Sell without creating or publishing anything automatically.",
  ] },
  { id: "role", title: "6. Role of TAKEME", paragraphs: [
    "TAKEME generally provides the platform through which users discover listings, communicate and arrange exchanges. Third-party sellers remain responsible for their items and listings. TAKEME does not take ownership of user-listed products.",
    "Buyers and sellers remain responsible for completing their transactions and arranging payment, delivery or collection unless a future TAKEME service expressly provides otherwise under its applicable terms. Listing publication does not mean TAKEME inspected, authenticated or pre-approved the item or seller.",
    "LEGAL REVIEW REQUIRED — marketplace intermediary and additional platform/operator obligations. This description does not exclude obligations or consumer rights imposed by applicable law.",
  ] },
  { id: "sellers", title: "7. Seller Obligations", paragraphs: [
    "Sellers must describe their items and arrangements honestly and comply with applicable law. Individual sellers and sellers acting for a business use the available marketplace tools. A profile, rating or reputation tier is not proof of business registration, authenticity or a verified seller.",
    "LEGAL REVIEW REQUIRED — exact seller disclosure fields; individual vs business seller requirements; national-language disclosure requirements where applicable; and any additional platform/operator obligations. The final required fields and implementation are not legally finalised by this draft.",
  ], bullets: [
    "Have lawful ownership or the right to offer the item and publish its photos and content.",
    "Describe price, category, condition, included accessories and material defects accurately. New and branded goods are permitted only when lawful and truthfully described.",
    "Do not describe counterfeit goods as authentic or claim verification or guarantees that TAKEME does not provide.",
    "Communicate agreed payment, collection, delivery and any costs, and respect accepted deal and auction outcomes. Keep listing status accurate using the available controls.",
  ] },
  { id: "listings", title: "8. Listings", paragraphs: [
    "Listings must be accurate, lawful and relevant to the item offered. Use your own photos or content you are entitled to publish. Do not conceal material defects, mislead users about availability or publish unnecessary private information.",
    "New, Like new, Good and Fair are the supported condition labels. Sellers remain responsible for their factual descriptions; selecting a label is not a platform inspection. Enter accurate auction settings and choose an appropriate general location or public meet-up place. Keep drafts and publication status honest.",
  ] },
  { id: "rules", title: "9. Prohibited and Restricted Items", paragraphs: [
    "Do not list, offer, request or transact in illegal, unsafe, fraudulent, infringing or prohibited goods or services. Any lawful restricted item remains subject to applicable requirements and the TAKEME Prohibited Items Policy.",
    `The TAKEME Prohibited Items Policy is referenced as part of these Terms and follows intended Terms version ${prohibitedItemsPolicy.version}. It applies to relevant listings, content and marketplace activity.`,
    "LEGAL REVIEW REQUIRED — final prohibited-items wording and legal approval. This draft does not claim that every listing is pre-approved or authenticated.",
  ], links: [{ href: "/help/prohibited-items", label: "TAKEME Prohibited Items Policy draft" }] },
  { id: "offers", title: "10. Offers and Negotiations", paragraphs: [
    "Make requests and offers in good faith. Where available, a seller can accept, decline or counter an offer and a buyer can accept a counter through the supported flow. Do not use offers to spam, defraud, harass or manipulate another user.",
    "Acceptance records the agreed marketplace amount and a deal state. It does not mean that payment completed, that a shipment exists or that TAKEME guarantees fulfilment. Buyers and sellers remain responsible for the agreed exchange.",
    "Use the existing deal controls honestly: completion requires the relevant participant confirmations and cancellation requires the existing mutual-resolution process. Do not confirm an exchange that did not happen. Raising a dispute records a concern; it does not automatically adjudicate the matter or issue a refund.",
  ] },
  { id: "auctions", title: "11. Auctions", paragraphs: [
    "Bid genuinely and in good faith. Sellers must not bid on their own auctions. Do not coordinate bids, manipulate prices or outcomes, or submit abusive bids. TAKEME may reject invalid, stale or abusive bids through available controls.",
    "An auction has a starting amount, minimum increment and stated start and end times. A valid first bid must meet the starting amount; later bids must meet the current amount plus the increment. Bids are accepted only while the auction is live and eligible. Timing and order are determined by the server, so submitting near the end does not guarantee acceptance.",
    "The accepted highest bid and system finalisation determine the winner under the recorded rules. An auction with no valid bids has no winner. Being the highest bidder does not guarantee transaction completion; the buyer and seller remain responsible for completing their transaction under the current V1 model.",
    "Late bids do not automatically extend the end time; anti-sniping is not implemented. The current interface does not offer a buyer bid-withdrawal control and a seller cannot cancel an auction with bids. Account deletion does not remove valid live bids or change the winner.",
  ] },
  { id: "messaging", title: "12. Messaging", paragraphs: [
    "Use Chat and messaging for relevant, respectful marketplace communication. Do not send spam, fraudulent offers, threats or harassment, distribute malware, impersonate others or ask for passwords, verification codes or financial credentials.",
    "Private messages are delivered to their intended participants. A message or an agreed amount does not create a TAKEME payment guarantee, escrow arrangement or promise of transaction completion.",
  ] },
  { id: "content", title: "13. User Content", paragraphs: [
    "You retain ownership of the content you submit. You grant TAKEME a non-exclusive licence only as reasonably required to host, store, reproduce, display, resize or process your content and to operate, secure, improve and promote relevant marketplace functionality, subject to applicable retention and legal obligations.",
    "This operational licence is limited to those purposes and is not a claim of ownership of your content. Submit only content you have the right to use. Do not publish other people's private contact or account information. Private messaging is delivered to its participants; this licence does not make private messages public promotional content.",
  ] },
  { id: "intellectual-property", title: "14. Intellectual Property", paragraphs: [
    "Respect copyright, trademarks and other intellectual-property rights. Do not publish listings, images or other content you are not entitled to use, or imply an endorsement or affiliation that does not exist.",
    "Use the existing reporting channels to raise an intellectual-property concern with relevant, truthful information. Reporting does not guarantee a particular outcome or response time.",
  ] },
  { id: "counterfeit", title: "15. Counterfeit and Infringing Goods", paragraphs: [
    "Counterfeit goods, unauthorised replicas and goods that infringe another person's intellectual-property rights are prohibited. Do not describe counterfeit goods as authentic or use another person's brand or content misleadingly.",
    "Sellers are responsible for lawful ownership and truthful authenticity descriptions. A listing, profile or review does not mean TAKEME has authenticated an item.",
  ], links: [{ href: "/help/prohibited-items", label: "Read prohibited-items rules" }] },
  { id: "reviews", title: "16. Reviews and Ratings", paragraphs: [
    "Reviews must reflect authentic eligible marketplace activity, follow the available review flow and avoid unlawful or abusive content. Do not fabricate reviews, manipulate ratings or pressure another user to provide misleading feedback.",
    "A rating, reputation tier or profile is helpful context, not a guarantee of item condition, authenticity, seller performance or transaction completion.",
  ] },
  { id: "reports", title: "17. Complaints and Reports", paragraphs: [
    "Users can report listings, sellers, conversations or another participant's messages through the existing Report actions. Provide relevant, truthful details without unnecessary sensitive information. Reports and necessary evidence can be reviewed with restricted administrator access.",
    "TAKEME may remove or restrict content or accounts that violate marketplace rules, applicable law, intellectual-property rights or safety and fraud controls. This is a policy right, not a claim that every enforcement or appeal action is automated. Reporting does not automatically resolve a deal, adjudicate a dispute or issue a refund.",
  ], links: [{ href: "/help#safety", label: "Safety and reporting help" }, { href: `mailto:${marketplaceOperator.supportEmail}`, label: "Contact TAKEME support" }] },
  { id: "retention", title: "18. Records and Legal Retention", paragraphs: [
    "Certain online marketplace records may need to be retained for three years under applicable Malaysian electronic-trade rules. LEGAL REVIEW REQUIRED — the applicable records, exact statutory retention implementation and reconciliation with the current deletion and retention model.",
    "This draft does not change retention periods, create an indefinite evidence store or automatically extend production deletion schedules. Scope, access restrictions, legal holds and retention/deletion conflicts must be resolved through legal review before the relevant launch decisions are made. Refresh, login and browsing do not create acceptance evidence.",
  ] },
  { id: "privacy", title: "19. Privacy", paragraphs: [
    "The TAKEME Privacy Notice describes collection, use, visibility, provider processing and retention of personal data. Please read it alongside these Terms. Current Privacy acceptance is required with Terms acceptance before protected marketplace writes.",
    "Detailed privacy disclosures belong in the Privacy Notice. This Terms draft does not finalise the English or Bahasa Melayu Privacy Notice or approve unresolved provider and cross-border transfer wording.",
  ], links: [{ href: "/privacy", label: "Read the TAKEME Privacy Notice draft" }] },
  { id: "restrictions", title: "20. Account Suspension and Restrictions", paragraphs: [
    "TAKEME may suspend or restrict content, accounts or actions where supported and reasonably necessary to address unlawful content, marketplace-rule violations, fraud, abuse, safety concerns or applicable legal obligations. Do not evade account restrictions.",
    "An account needing policy reacceptance may still browse public content but cannot perform protected writes. Deletion-pending and other lifecycle restrictions retain their existing safeguards and supported resolution paths. This draft does not claim that every suspension, investigation or appeal procedure is already automated.",
  ] },
  { id: "deletion", title: "21. Account Deletion", paragraphs: [
    "Account-deletion requests are supported through Settings and the public account-deletion route with authentication and identity confirmation. Live auctions with bids, unfinished or disputed transactions and unresolved reports can keep deletion pending until safe resolution. Deletion does not silently cancel or complete marketplace obligations.",
    "Deletion may also need to be delayed or limited for fraud or security investigations, legal holds or statutory retention where lawfully required. LEGAL REVIEW REQUIRED — the applicable obligations and their reconciliation with the implemented cleanup, restricted evidence and retention schedules; this is not a claim that every legal hold is an automatic current system blocker.",
    "Deletion does not imply immediate erasure in all cases. Personal data is removed or minimised as implemented; limited pseudonymised history and restricted evidence can remain temporarily under the approved retention model. Backups and logs are outside synchronous live cleanup. Production deletion execution remains off pending separate qualification and approval.",
  ], links: [{ href: "/account-deletion", label: "Account deletion details and request" }] },
  { id: "safety", title: "22. Marketplace Safety", paragraphs: [
    "Read the listing and ask about condition, authenticity, included items and exchange costs before making a commitment. Take reasonable care when arranging meet-ups and inspecting goods. Use a suitable public place and do not publish a private home address unnecessarily.",
    "Keep communications respectful and credentials private. Do not manipulate marketplace activity, reviews or prices. Report suspicious listings or users through the supported channels. A safety reminder, profile or rating is not a guarantee against fraud or loss.",
  ], links: [{ href: "/help#safety", label: "Marketplace safety help" }] },
  { id: "payments", title: "23. Payments Between Users", paragraphs: [
    "Unless TAKEME expressly introduces an integrated payment service with applicable terms, payment arrangements between the buyer and seller remain their responsibility. TAKEME does not currently receive, hold or transfer buyer funds or provide integrated protected checkout, escrow, Stripe Connect or seller payouts.",
    "An accepted offer, auction result or recorded completion is not evidence that TAKEME processed a payment. Any future integrated payment service would require separate clear terms and review; this draft does not activate it or provide a contractual payment guarantee.",
  ] },
  { id: "shipping", title: "24. Shipping, Delivery and Collection", paragraphs: [
    "Unless TAKEME expressly provides an integrated shipping service, buyers and sellers arrange shipping, delivery or collection and any related costs themselves. TAKEME does not currently create shipments, provide integrated shipping or generate airway bills (AWB).",
    "Agree the exchange arrangements and costs before proceeding. Future integrated shipping or AWB functionality may have separate terms; mentioning it here does not mean it is currently available or that TAKEME guarantees delivery.",
  ] },
  { id: "fees", title: "25. Fees", paragraphs: [
    "Any applicable marketplace fee or promoted feature must be clearly disclosed before a user chooses the relevant service. Future fees or promoted services may have additional terms. This draft does not claim that category transaction fees are active at launch.",
    "TAKEME will not impose an undisclosed fee retroactively. New payments, fees, payouts, refunds or shipping require further Terms and Privacy review before the relevant feature is introduced.",
  ] },
  { id: "third-party", title: "26. Third-Party Services", paragraphs: [
    "TAKEME uses third-party technical services to operate the marketplace. Relevant provider and personal-data processing disclosures belong in the Privacy Notice. Third-party links or services do not create a TAKEME guarantee of the third party's performance.",
    "LEGAL REVIEW REQUIRED — final provider and cross-border transfer wording. This draft does not expand provider access, finalise privacy disclosures or migrate backend services.",
  ] },
  { id: "availability", title: "27. Service Availability", paragraphs: [
    "The service is subject to reasonable availability and technical limitations. Maintenance, connectivity problems, errors or interruptions can affect access and actions. Do not rely on submitting at the last possible moment, including near an auction deadline.",
    "TAKEME does not promise uninterrupted or error-free service. Future services such as Seller Centre, short-video commerce or live commerce remain conditional and are not currently offered as V1 capabilities by these Terms.",
  ] },
  { id: "no-guarantee", title: "28. No Guarantee of Transactions", paragraphs: [
    "TAKEME does not guarantee payment, delivery, product condition, authenticity, seller performance, refunds or completion of a transaction. Buyers and sellers remain responsible for their agreed exchange and the rights and obligations applicable to it.",
    "A recorded dispute is not a final legal determination. Participants can communicate and use supported cancellation or dispute controls, but those controls do not replace lawful rights or remedies or automatically settle an exchange.",
  ] },
  { id: "liability", title: "29. Limitation of Liability", paragraphs: [
    "To the extent permitted by applicable law, TAKEME is not responsible for loss caused by inaccurate user content, another user's failure to perform an exchange or events outside its reasonable control. No clause excludes liability or consumer rights that cannot lawfully be excluded.",
    "LEGAL REVIEW REQUIRED — final Malaysian limitation-of-liability drafting. This conservative owner draft does not add a liability cap or a broader exclusion of platform responsibilities.",
  ] },
  { id: "indemnity", title: "30. Indemnity", paragraphs: [
    "You remain responsible for the lawful content and marketplace activity you submit and for your own obligations under these Terms and applicable law.",
    "LEGAL REVIEW REQUIRED — final indemnity scope and Malaysian drafting. No additional indemnity, defence obligation or open-ended reimbursement obligation is imposed by this unresolved draft section.",
  ] },
  { id: "updates", title: "31. Changes to These Terms", paragraphs: [
    `Changes should have a clear version, last-updated date and effective date, with appropriate notice and acceptance where required. Terms v${termsDocument.version} becomes effective only on the actual approved public launch date; last updated uses that date unless the owner separately approves a change. ${termsDocument.effectiveDate ? `The central owner-approved launch date is ${termsDocument.effectiveDate}; publication remains separately gated.` : "No launch date is set by this draft."}`,
    "When the required Terms or Privacy version changes, earlier acceptance is not treated as current consent. Users may continue public browsing and must expressly reaccept before protected writes. Historical acceptance evidence and existing marketplace records are preserved as implemented, and returning to an intended context does not execute the action automatically.",
  ] },
  { id: "law", title: "32. Governing Law", paragraphs: [
    "These Terms are governed by the laws of Malaysia, subject to mandatory legal rights. This clause does not limit a consumer's non-excludable rights or lawful complaint avenues.",
  ] },
  { id: "severability", title: "33. Severability", paragraphs: [
    "If a provision cannot lawfully be enforced, the remaining provisions continue only to the extent permitted by applicable law. This does not validate an unlawful restriction or remove mandatory consumer rights.",
  ] },
  { id: "no-waiver", title: "34. No Waiver", paragraphs: [
    "A delay or failure to exercise a right does not by itself waive that right, subject to applicable law and mandatory consumer protections.",
  ] },
  { id: "contact", title: "35. Contact", paragraphs: [
    `Operator: ${marketplaceOperator.name}. SSM registration: ${marketplaceOperator.registrationNumber}. Support, privacy and legal enquiries: ${marketplaceOperator.supportEmail}.`,
    `Business or publishable address: ${termsDocument.businessAddressStatus}. No address is published in this draft. A private or home address must not be substituted.`,
  ], links: [{ href: `mailto:${marketplaceOperator.supportEmail}`, label: `Contact ${marketplaceOperator.supportEmail}` }, { href: "/contact", label: "TAKEME contact information" }, { href: "/help", label: "Help Centre" }] },
];
