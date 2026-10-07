import assert from "node:assert/strict";
import test from "node:test";
import { publicLegalParagraph } from "../src/lib/legal-review-presentation.ts";
import { legalSectionParagraphs } from "../src/content/operator-disclosure.ts";
import { termsSections } from "../src/content/terms.ts";
import { privacySections } from "../src/content/privacy.ts";
import { bmPrivacySections } from "../src/content/privacy-bm.ts";
import { prohibitedItemsSections } from "../src/content/marketplace-rules.ts";
import { v1AddressPublicationDisposition } from "../functions/src/legal-publication.ts";

const markers = /LEGAL REVIEW REQUIRED|COUNSEL REVIEW REQUIRED|SEMAKAN UNDANG-UNDANG DIPERLUKAN/i;
const groups = [termsSections, privacySections, bmPrivacySections, prohibitedItemsSections];

test("all four published paragraph projections omit workflow markers while review copy is unchanged", () => {
  for (const sections of groups) {
    for (const text of sections.flatMap(section => legalSectionParagraphs(section))) {
      assert.equal(publicLegalParagraph(text, false), text);
      assert.doesNotMatch(publicLegalParagraph(text, true), markers);
      if (!markers.test(text)) assert.equal(publicLegalParagraph(text, true), text);
    }
  }
  assert.equal(v1AddressPublicationDisposition.legalCounselStatus, "OUTSTANDING");
});

test("label removal retains every substantive character except the two reviewed inline label forms", () => {
  for (const sections of groups) {
    for (const text of sections.flatMap(section => legalSectionParagraphs(section))) {
      if (/remain LEGAL REVIEW REQUIRED|— SEMAKAN UNDANG-UNDANG DIPERLUKAN;/i.test(text)) continue;
      const withoutLabel = text.replace(/(?:LEGAL REVIEW REQUIRED|COUNSEL REVIEW REQUIRED|SEMAKAN UNDANG-UNDANG DIPERLUKAN)\s*(?:[—–:]\s*)?/gi, "");
      assert.equal(publicLegalParagraph(text, true), withoutLabel);
    }
  }
});

test("English inline retention and deletion cautions stay grammatical and bounded", () => {
  // Find by the approved caution rather than coupling to section identifiers.
  const texts = privacySections.flatMap(section => legalSectionParagraphs(section));
  const retention = texts.find(text => text.includes("remain LEGAL REVIEW REQUIRED"));
  assert.ok(retention);
  assert.equal(publicLegalParagraph(retention, true), retention.replace("LEGAL REVIEW REQUIRED", "subject to applicable law"));
  const deletion = texts.find(text => text.includes("subject to LEGAL REVIEW REQUIRED reconciliation"));
  assert.ok(deletion);
  assert.equal(publicLegalParagraph(deletion, true), deletion.replace("LEGAL REVIEW REQUIRED ", ""));
  assert.match(publicLegalParagraph(deletion, true), /this is not a claim that every such hold is already an automatic blocker/);
});

test("BM inline deletion retains reconciliation and the automatic-blocker caveat", () => {
  const text = bmPrivacySections.flatMap(section => legalSectionParagraphs(section)).find(p => p.includes("penyelarasan — SEMAKAN UNDANG-UNDANG DIPERLUKAN;"));
  assert.ok(text);
  assert.equal(publicLegalParagraph(text, true), text.replace(" — SEMAKAN UNDANG-UNDANG DIPERLUKAN", ""));
  assert.match(publicLegalParagraph(text, true), /tertakluk kepada penyelarasan; ini bukan dakwaan/);
});

test("Terms safeguards and Prohibited Items category/enforcement cautions remain visible", () => {
  const terms = termsSections.flatMap(section => legalSectionParagraphs(section)).map(p => publicLegalParagraph(p, true)).join(" ");
  const prohibited = prohibitedItemsSections.flatMap(section => legalSectionParagraphs(section)).map(p => publicLegalParagraph(p, true)).join(" ");
  assert.match(terms, /No clause excludes liability or consumer rights that cannot lawfully be excluded/);
  assert.match(terms, /No additional indemnity, defence obligation or open-ended reimbursement obligation/);
  assert.match(terms, /exact seller disclosure fields; individual vs business seller requirements/);
  assert.match(terms, /three years under applicable Malaysian electronic-trade rules/);
  assert.match(prohibited, /This policy does not create indefinite retention or change backend cleanup schedules/);
  assert.match(prohibited, /does not replace regulator requirements or provide blanket approval/);
  assert.match(prohibited, /exact alcohol, tobacco and nicotine scope/);
});

test("EN and BM retain the same section topology and number of review cautions", () => {
  assert.deepEqual(bmPrivacySections.map(s => s.id), privacySections.map(s => s.id));
  const counts = [privacySections, bmPrivacySections].map(sections => sections.flatMap(section => legalSectionParagraphs(section)).filter(text => markers.test(text)).length);
  assert.deepEqual(counts, [12, 12]);
  for (const sections of [privacySections, bmPrivacySections]) {
    assert.equal(sections.flatMap(section => legalSectionParagraphs(section)).filter(p => markers.test(publicLegalParagraph(p, true))).length, 0);
  }
});

test("mixed-case workflow labels and colon punctuation do not leak, ordinary cautions stay intact", () => {
  assert.equal(publicLegalParagraph("Legal review required: Existing caution.", true), "Existing caution.");
  assert.equal(publicLegalParagraph("Counsel review required — Existing caution.", true), "Existing caution.");
  assert.equal(publicLegalParagraph("Existing statutory rights and duties remain unchanged.", true), "Existing statutory rights and duties remain unchanged.");
});
