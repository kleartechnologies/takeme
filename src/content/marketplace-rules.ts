import type { InformationSection } from "@/components/public-information/public-information";
import { productionReleasePolicy } from "../../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../../functions/src/legal-publication.ts";
import { marketplaceOperator } from "./operator.ts";
import { legalOperatorDisclosure } from "./operator-disclosure.ts";

export const prohibitedItemsIntro = "This policy explains goods, content, offers and listings that are prohibited or restricted on TAKEME. It protects users, marketplace integrity, safety, intellectual property and lawful trade.";

export const prohibitedItemsReviewNotice = "Owner draft for Malaysian legal review. This policy is not in effect and has not been published. Final legal counsel approval, the actual public launch date and separate publication approval remain required. Unresolved regulated-category and enforcement obligations are marked LEGAL REVIEW REQUIRED.";

// V1 prohibited-items content is incorporated into the Terms version. This does
// not create a separate consent or imply counsel approval of the actual text.
export const prohibitedItemsPolicy = Object.freeze({
  title: "TAKEME Prohibited Items Policy",
  version: productionReleasePolicy.termsVersion,
  effectiveDate: legalPublicationReadiness.effectiveDate,
  lastUpdated: legalPublicationReadiness.lastUpdated,
  operator: marketplaceOperator,
  registrationNumber: marketplaceOperator.registrationNumber,
  supportEmail: marketplaceOperator.supportEmail,
  ...legalOperatorDisclosure(),
  reviewNotice: prohibitedItemsReviewNotice,
  publicationApproved: legalPublicationReadiness.publicationApproved && legalPublicationReadiness.finalContentApproved,
});

// Owner-approved V1 scope, supplied 3 October 2026; publication remains a separate review.
export const prohibitedItems = [
  "Illegal goods or services.",
  "Firearms, ammunition, explosives and regulated weapons.",
  "Illegal drugs and controlled substances.",
  "Counterfeit goods and unauthorised replicas.",
  "Stolen goods.",
  "Pornography, explicit sexual content or sexual services.",
  "Human trafficking or exploitation.",
  "Dangerous or hazardous materials.",
  "Prescription medicines sold unlawfully.",
  "Tobacco or nicotine products where unlawful or age-restricted.",
  "Alcohol where unlawful or age-restricted.",
  "Gambling services or products where unlawful.",
  "Fake documents, IDs or credentials.",
  "Financial scams, pyramid schemes or fraudulent investment offers.",
  "Malware, stolen accounts, hacked credentials or illegal digital access.",
  "Goods that infringe copyright, trademark or other intellectual-property rights.",
  "Wildlife or protected-species products where prohibited.",
  "Any item TAKEME reasonably determines creates legal, safety, fraud or abuse risk.",
];

export const prohibitedItemsSections: InformationSection[] = [
  { id: "scope", title: "1. Purpose and General Rule", paragraphs: [
    `This policy is operated by ${marketplaceOperator.name} (SSM ${marketplaceOperator.registrationNumber}) and forms part of TAKEME Terms of Service version ${prohibitedItemsPolicy.version}. It applies to listings, photos, descriptions, offers, requests, advertisements and related marketplace conduct.`,
    "Do not list, offer, request, advertise, buy or sell goods or services that are illegal, unsafe, fraudulent, counterfeit, stolen, regulated without required authorisation, prohibited by TAKEME policy or otherwise unsuitable for the marketplace. TAKEME may remove listings or restrict accounts where reasonably necessary to address legal, safety, fraud or abuse risk.",
    "A platform prohibition can be stricter than what is lawful in another setting. This policy preserves the reviewed TAKEME prohibitions; it does not say that every platform-prohibited item is unlawful in all circumstances. It governs listing eligibility and does not introduce new marketplace categories or services.",
  ] },
  { id: "responsibility", title: "2. Seller Responsibility and Restricted Goods", paragraphs: [
    "Sellers remain responsible for lawful ownership, any required permission or authorisation, accurate descriptions and claims, applicable safety requirements and the right to use listing content. A lawful item may still be prohibited by TAKEME platform rules. Do not assume that selecting a category, stating that an item is a replica or showing a document makes it eligible.",
    "A listing, profile, review or publication does not mean TAKEME inspected, authenticated or pre-approved an item or seller. TAKEME may request relevant documentation where appropriate without guaranteeing authenticity or regulatory compliance.",
    "LEGAL REVIEW REQUIRED — exact regulated-goods wording, required authorisations and seller/platform duties. This policy does not replace regulator requirements or provide blanket approval for a restricted category.",
  ] },
  { id: "stolen-fraud", title: "3. Illegal, Stolen and Fraudulently Obtained Goods", paragraphs: [
    "Illegal goods or services, stolen property and goods obtained through fraud are prohibited. Do not sell property you do not own or lack authority to offer, disguise its origin or help another person dispose of stolen goods.",
    "Forged documents, fake identification or credentials, stolen financial credentials, fraudulent vouchers or codes and fraudulent access keys are prohibited. Do not impersonate another person or misrepresent a document, code or entitlement as genuine.",
  ] },
  { id: "counterfeit-ip", title: "4. Counterfeit and Infringing Goods", paragraphs: [
    "Counterfeit branded products and unauthorised replicas are prohibited under TAKEME platform rules. Labelling an item as a replica, imitation or not genuine does not override this restriction. Do not present a counterfeit item as authentic.",
    "Pirated goods and digital content, and listings that unlawfully infringe copyright, trademarks or other intellectual-property rights, are prohibited. Sellers must have the right to offer the item and publish the relevant photos, text and other content.",
    "TAKEME may request relevant authenticity or ownership evidence where appropriate and review reported concerns. This does not mean TAKEME authenticates every item or guarantees a particular investigation result.",
  ] },
  { id: "weapons", title: "5. Weapons, Ammunition and Explosives", paragraphs: [
    "Firearms, ammunition, explosives and regulated weapons are prohibited under the existing TAKEME platform rules. Prohibited weapons, unlawful weapon accessories and items offered with the intent to cause serious harm are not permitted.",
    "Do not use listings, messages or disguised categories to arrange prohibited weapon sales or unlawful access to accessories. A claim that a buyer is an adult or holds a licence does not override a TAKEME platform prohibition.",
    "LEGAL REVIEW REQUIRED — exact regulated-weapons and accessory scope, lawful classifications and applicable seller/platform obligations. This notice gives no instructions for acquiring, making or modifying weapons.",
  ] },
  { id: "drugs-medicines", title: "6. Drugs, Controlled Substances and Medicines", paragraphs: [
    "Illegal drugs, controlled substances and unlawful drug paraphernalia are prohibited. Prescription or restricted medicines must not be sold unlawfully or without required authorisation. Do not use listings or messages to arrange these prohibited offers.",
    "An over-the-counter or other health product is not automatically eligible. Where an item is otherwise permitted, sellers remain responsible for lawful sale, accurate descriptions and claims, required authorisations and applicable safety requirements. Do not imply a medical approval or treatment claim that is not lawfully supported.",
    "LEGAL REVIEW REQUIRED — exact medicines, restricted health-product and paraphernalia scope, required authorisations and applicable marketplace duties. This policy does not approve a medicines category or provide sourcing guidance.",
  ] },
  { id: "hazardous", title: "7. Dangerous and Hazardous Materials", paragraphs: [
    "Dangerous or hazardous materials are prohibited under the reviewed TAKEME platform rules. This includes toxic substances, hazardous chemicals, radioactive materials, unsafe pesticides, dangerous precursors and dangerous recalled goods.",
    "Do not disguise hazardous contents, omit material safety risks or use ordinary categories to evade restrictions. A disclaimer or proposed private exchange does not make a prohibited item eligible.",
    "LEGAL REVIEW REQUIRED — exact regulated-material classifications, chemical/precursor scope and relevant authorisation and safety duties. No handling, production or acquisition instructions are supplied by this policy.",
  ] },
  { id: "alcohol-tobacco", title: "8. Alcohol, Tobacco and Nicotine", paragraphs: [
    "The reviewed TAKEME restrictions prohibit tobacco or nicotine products where unlawful or age-restricted, and alcohol where unlawful or age-restricted. Do not offer these products in breach of applicable restrictions or required authorisations.",
    "These are the existing platform restrictions, not a claim that every alcohol, tobacco or nicotine product is always unlawful in every setting. TAKEME's 18+ account requirement does not itself authorise a regulated sale or override listing restrictions. Do not offer a product online where that sale is prohibited, even if the buyer is an adult.",
    "LEGAL REVIEW REQUIRED — exact alcohol, tobacco and nicotine scope, age restrictions, online-sale restrictions, required permissions and platform obligations.",
  ] },
  { id: "health-consumables", title: "9. Food, Cosmetics, Health and Consumer Products", paragraphs: [
    "Unsafe or recalled products, adulterated food or consumables, unsafe cosmetic or health products, illegal supplements and restricted health products sold without required authorisation are prohibited. Do not offer goods that remain subject to a safety recall or conceal a material safety risk.",
    "Where a product is otherwise permitted, its sale and claims must be lawful and truthful. Unlawful medical claims, false approval claims and misleading claims about safety or benefits are prohibited. Sellers remain responsible for applicable regulator requirements; a TAKEME listing is not regulatory approval.",
    "LEGAL REVIEW REQUIRED — exact food, cosmetic, supplement and health-product scope, recall treatment and authorisation/claim requirements. This policy does not replace the relevant regulators or certify product safety.",
  ] },
  { id: "exploitation", title: "10. Human Remains, Sexual Content and Exploitation", paragraphs: [
    "Human remains or body parts must not be listed on TAKEME. Human trafficking, exploitation and offers that facilitate these harms are prohibited.",
    "Pornography, explicit sexual content or sexual services remain prohibited under the reviewed TAKEME platform rules. This is a platform restriction and not a statement that all adult content is unlawful in every context. Illegal or obscene sexual content and exploitative material are prohibited.",
    "Child sexual abuse material and the sexual exploitation of minors are expressly prohibited. Do not upload, advertise, request or distribute such material, including through messages. Keep reports non-graphic and do not redistribute harmful material.",
  ] },
  { id: "extremism", title: "11. Unlawful Extremist or Terrorist Material", paragraphs: [
    "Unlawful extremist or terrorist propaganda, merchandise, fundraising or related offers are prohibited where applicable. Do not use listings or messages to promote or facilitate unlawful violence, exploitation or terrorist activity.",
    "Do not disguise unlawful propaganda, merchandise or fundraising as an ordinary item or use marketplace content to evade applicable restrictions. A listing is not legal clearance for the material or activity it promotes.",
    "LEGAL REVIEW REQUIRED — exact applicable classifications and intermediary reporting obligations. This policy does not invent a list of organisations or promise automatic reporting in every case.",
  ] },
  { id: "wildlife", title: "12. Wildlife and Environmental Contraband", paragraphs: [
    "Unlawful trade in protected wildlife, endangered species, ivory or protected animal products where unlawful, and environmental contraband is prohibited. Wildlife or protected-species products remain prohibited where required by the reviewed rules or applicable restrictions.",
    "Do not conceal the species, origin or restricted nature of an item or imply that a claimed permit automatically makes a listing eligible.",
    "LEGAL REVIEW REQUIRED — exact wildlife and environmental categories, protected-product scope, permits and seller/platform obligations. This policy does not approve trade in a regulated species or replace applicable legal requirements.",
  ] },
  { id: "digital", title: "13. Unlawful Digital Goods, Accounts and Access", paragraphs: [
    "If content or an offer involves a digital item, the same legal and anti-fraud rules apply. Malware, spyware, stolen account or financial credentials, hacked accounts, stolen digital goods, pirated content, fraudulent access keys and illegal digital access are prohibited. Surveillance tools intended for unlawful use are also prohibited.",
    "Do not sell or request unauthorised access, misrepresent ownership or use a physical-item listing to disguise an unlawful digital offer. This policy does not introduce or certify a supported digital-goods or account-trading service.",
  ] },
  { id: "gambling-services", title: "14. Gambling, Fraudulent Schemes and Illegal Services", paragraphs: [
    "Gambling products or services where unlawful, financial scams, pyramid or Ponzi schemes and fraudulent investment offers are prohibited. Do not disguise these as goods, vouchers, memberships, training or another ordinary listing.",
    "TAKEME V1 primarily provides goods-listing tools. The prohibition of illegal services does not expand it into a services marketplace. Illegal services, fraud, exploitation and other clearly unlawful offers remain prohibited wherever they appear in content or communication.",
  ] },
  { id: "evasion", title: "15. Listing Manipulation and Enforcement Evasion", paragraphs: [
    "Do not disguise prohibited goods using misleading titles, categories, descriptions or images, code words or incomplete information. Do not redirect users to purchase prohibited items elsewhere or use Chat to evade listing rules.",
    "Reposting removed content under another account or description to intentionally evade enforcement is prohibited. A private arrangement, off-platform link or disclaimer does not override this policy.",
  ] },
  { id: "enforcement", title: "16. Enforcement and Evidence", paragraphs: [
    "Where supported and reasonably necessary, TAKEME may remove or hide listings, restrict listing ability, suspend or restrict accounts, request relevant documentation and investigate reports. Violations may also breach the Terms of Service. These are policy rights, not a promise that every moderation, investigation or appeal action is automated.",
    "Relevant evidence may be preserved with restricted access where required for a lawful purpose or legal obligation. Matters may be reported to authorities where required by law. Reporting does not automatically resolve a transaction, issue a refund or guarantee an enforcement outcome; TAKEME does not promise automatic police reporting in every case.",
    "LEGAL REVIEW REQUIRED — marketplace intermediary reporting obligations, enforcement powers and procedures, evidence-retention duties and their reconciliation with account deletion and bounded retention. This policy does not create indefinite retention or change backend cleanup schedules.",
  ] },
  { id: "reports", title: "17. Reporting Suspected Violations and Errors", paragraphs: [
    "Report suspicious or prohibited listings using the existing in-app Report actions where available, or contact " + marketplaceOperator.supportEmail + ". Existing reporting can cover listings, sellers, conversations or another participant's messages. Provide relevant, truthful details without unnecessary private information.",
    "Do not send passwords, verification codes or stolen credentials, and do not redistribute prohibited or exploitative content as evidence. Identify the relevant listing or concern and provide an appropriate description through the supported channel.",
    "If you believe a listing was removed or restricted incorrectly, contact support with the relevant context. TAKEME can review the concern where appropriate. This contact path does not promise a dedicated automated appeal system, a particular outcome or a fixed response time.",
  ], links: [{ href: `mailto:${marketplaceOperator.supportEmail}`, label: "Contact TAKEME support" }, { href: "/help#safety", label: "Safety and reporting help" }] },
  { id: "terms-contact", title: "18. Terms Linkage and Contact", paragraphs: [
    `The TAKEME Prohibited Items Policy forms part of Terms of Service version ${prohibitedItemsPolicy.version}. Read it alongside the Terms and Privacy Notice.`,
    "This Prohibited Items Policy sets out products, listings and activities that are prohibited or restricted on TAKEME. " + (prohibitedItemsPolicy.effectiveDate && prohibitedItemsPolicy.lastUpdated ? "The effective and last updated dates are " + prohibitedItemsPolicy.effectiveDate + " and " + prohibitedItemsPolicy.lastUpdated + ", respectively." : "The effective date and last updated date remain pending."),
    `Operator: ${marketplaceOperator.name}. SSM registration: ${marketplaceOperator.registrationNumber}. Support and reporting: ${marketplaceOperator.supportEmail}.`,
    "LEGAL REVIEW REQUIRED — final policy wording, regulated-category scope, intermediary obligations and enforcement/evidence duties. The identified unresolved legal inputs are not finalised by this policy.",
  ], addressParagraphs: [
    `Business or correspondence address: ${prohibitedItemsPolicy.businessAddressStatus}. No address is published in this draft and no private/home address is substituted.`,
  ], links: [{ href: "/terms", label: "Read the TAKEME Terms of Service" }, { href: "/privacy", label: "Read the TAKEME Privacy Notice" }, { href: `mailto:${marketplaceOperator.supportEmail}`, label: `Contact ${marketplaceOperator.supportEmail}` }] },
];
