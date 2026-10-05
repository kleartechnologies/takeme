import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { privacyDocument, privacySections } from "../src/content/privacy.ts";
import { bmPrivacyDocument, bmPrivacySections } from "../src/content/privacy-bm.ts";
import { privacyNotices } from "../src/content/privacy-notices.ts";
import { marketplaceOperator } from "../src/content/operator.ts";
import { legalPublicationReadiness } from "../functions/src/legal-publication.ts";
import { productionReleasePolicy } from "../functions/src/release-policy.ts";
import { canPreviewLegalDraft, canPublishProductionLegal, resolveLegalDocumentState } from "../src/lib/public-information.ts";
import { canRenderBmPrivacyNotice, hasApprovedBmPrivacyNotice } from "../src/lib/privacy-notice.ts";
import { buildBmPrivacyMetadata } from "../src/lib/privacy-bm-metadata.ts";
import { buildPrivacyMetadata } from "../src/lib/privacy-metadata.ts";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const sectionCopy = (section: typeof privacySections[number]) => [
  ...section.paragraphs ?? [], ...section.bullets ?? [], ...section.links?.map(link => link.label) ?? [],
].join(" ");
const copy = (id: string) => {
  const section = bmPrivacySections.find(value => value.id === id);
  assert.ok(section, `Missing BM Privacy topic: ${id}`);
  return sectionCopy(section);
};
const allCopy = () => bmPrivacySections.map(sectionCopy).join(" ");
function matches(text: string, pattern: RegExp, message?: string) {
  assert.match(text, new RegExp(pattern.source, pattern.flags.includes("i") ? pattern.flags : pattern.flags + "i"), message);
}
const marker = /SEMAKAN UNDANG-UNDANG DIPERLUKAN/;
const requiredTopics = ["about", "scope", "categories", "provided", "authentication", "profile", "listings", "communications", "preferences", "technical", "support", "acceptance", "uses", "compliance", "operations", "discovery", "fraud", "providers", "sharing", "transfers", "retention", "deletion", "holds", "security", "rights", "age", "storage", "changes", "contact"];

// Coverage and exact policy clocks catch omissions or operational drift; they
// complement bilingual review rather than certify legal translation equivalence.

test("BM preserves all 29 English topics, order, paragraphs, lists and destination links", () => {
  assert.equal(bmPrivacySections.length, 29);
  assert.deepEqual(bmPrivacySections.map(section => section.id), requiredTopics);
  assert.deepEqual(bmPrivacySections.map(section => section.id), privacySections.map(section => section.id));
  for (const [index, section] of bmPrivacySections.entries()) {
    const english = privacySections[index];
    assert.equal(Number(section.title.match(/^(\d+)\./)?.[1]), index + 1, section.id);
    assert.notEqual(section.title, english.title, `Untranslated heading: ${section.id}`);
    matches(section.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(section.paragraphs?.length ?? 0, english.paragraphs?.length ?? 0, `${section.id}: paragraph parity`);
    assert.equal(section.bullets?.length ?? 0, english.bullets?.length ?? 0, `${section.id}: list parity`);
    assert.deepEqual(section.links?.map(link => link.href) ?? [], english.links?.map(link => link.href) ?? [], `${section.id}: destination parity`);
    assert.ok(sectionCopy(section).trim().length > 0, section.id);
  }
});

test("BM identity uses the approved central V1 source without final dates or publication approval", () => {
  assert.equal(bmPrivacyDocument.title, "Notis Privasi TAKEME");
  assert.equal(bmPrivacyDocument.language, "Bahasa Melayu");
  assert.equal(bmPrivacyDocument.version, "1.0");
  assert.equal(bmPrivacyDocument.version, productionReleasePolicy.privacyVersion);
  assert.equal(bmPrivacyDocument.version, privacyDocument.version);
  assert.equal(bmPrivacyDocument.minimumAge, 18);
  assert.equal(bmPrivacyDocument.minimumAge, privacyDocument.minimumAge);
  assert.equal(bmPrivacyDocument.effectiveDate, null);
  assert.equal(bmPrivacyDocument.lastUpdated, null);
  assert.equal(bmPrivacyDocument.effectiveDate, legalPublicationReadiness.effectiveDate);
  assert.equal(bmPrivacyDocument.lastUpdated, legalPublicationReadiness.lastUpdated);
  assert.equal(productionReleasePolicy.publicationApproved, false);
  assert.equal(legalPublicationReadiness.publicationApproved, false);
  assert.equal(legalPublicationReadiness.finalContentApproved, false);
  assert.equal(legalPublicationReadiness.bmPrivacyNoticeApproved, false);
  assert.equal(resolveLegalDocumentState("privacy", { nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" }).publicationApproved, false);
});

test("BM preserves the verified operator, registration and contacts without adding an address", () => {
  assert.equal(bmPrivacyDocument.operator, marketplaceOperator);
  assert.equal(bmPrivacyDocument.operator.name, "TAKEME TECHNOLOGIES");
  assert.equal(bmPrivacyDocument.operator.registrationNumber, "KT0622373-U");
  assert.equal(bmPrivacyDocument.operator.supportEmail, "support.takeme@gmail.com");
  assert.equal(bmPrivacyDocument.operator.privacyLegalEmail, "support.takeme@gmail.com");
  assert.equal(bmPrivacyDocument.businessAddress, null);
  assert.equal(bmPrivacyDocument.businessAddressStatus, privacyDocument.businessAddressStatus);
  matches(bmPrivacyDocument.localizedBusinessAddressStatus, /SEMAKAN UNDANG-UNDANG|INPUT PEMILIK/);
  assert.equal(legalPublicationReadiness.address, "pending");
  for (const identity of [/TAKEME TECHNOLOGIES/, /KT0622373-U/, /support\.takeme@gmail\.com/]) matches(copy("contact"), identity);
  matches(copy("contact"), /alamat/i);
  matches(copy("contact"), /tiada alamat|alamat[^.]*tidak[^.]*diterbitkan/i);
});

test("BM account and data categories remain the current Firebase account and marketplace model", () => {
  const account = copy("authentication");
  for (const category of [/Firebase Authentication/, /Google/, /e-mel/, /pengecam|pengenal/, /status/, /cap masa/]) matches(account, category);
  const categories = copy("categories");
  for (const category of [/akaun/, /profil/, /penyenaraian/, /mesej/, /tawaran/, /bidaan/, /keutamaan/, /18\+/]) matches(categories, category);
  matches(account, /kata laluan[^.]*tidak|tidak[^.]*kata laluan/);
  matches(account, /tidak[^.]*memadam[^.]*akaun Google|akaun Google[^.]*tidak[^.]*dipadam/);
});

test("BM public profiles and listings remain separate from private addresses, inbox and acceptance history", () => {
  const profile = copy("profile");
  for (const category of [/nama/, /foto|gambar/, /awam/, /penjual/, /ulasan|penilaian/]) matches(profile, category);
  matches(profile, /alamat peribadi/);
  matches(profile, /tidak[^.]*secara automatik|bukan[^.]*secara automatik/);
  matches(profile, /tidak[^.]*GPS|GPS[^.]*tidak/);
  const operations = copy("operations");
  for (const restricted of [/e-mel/, /alamat peribadi/, /peti masuk/, /bukti penerimaan/, /keutamaan/]) matches(operations, restricted);
  matches(operations, /bukan[^.]*awam|tidak[^.]*awam|di luar[^.]*awam/);
  matches(copy("provided"), /poskod/);
  matches(copy("provided"), /peribadi/);
});

test("BM communications are private, limited to supported functionality and bounded authorised case review", () => {
  const text = copy("communications");
  for (const category of [/mesej/, /peserta/, /tawaran/, /lelongan/, /cap masa/, /bidaan/]) matches(text, category);
  matches(text, /bukan kandungan awam|tidak[^.]*kandungan awam/);
  matches(text, /tidak[^.]*lampiran/);
  matches(text, /kakitangan[^.]*tidak|tidak[^.]*kakitangan/);
  matches(text, /terhad|dibatasi/);
  matches(text, /berkuasa|diberi kuasa/);
  const support = copy("support");
  for (const category of [/laporan/, /pertikaian/, /bukti/, /terhad/, /pemadaman|keselamatan/]) matches(support, category);
  matches(support, /tidak[^.]*menjamin/);
});

test("BM Saved, following, searches, settings and in-app alerts do not expose private relationships", () => {
  const text = copy("preferences");
  for (const feature of [/Saved/, /carian/, /ikut|mengikuti/, /keutamaan/, /peribadi/, /Updates/, /Settings|Tetapan/]) matches(text, feature);
  matches(text, /agregat|jumlah/);
  matches(text, /identiti/);
  matches(text, /tidak[^.]*aktif|belum[^.]*aktif/);
});

test("BM technical data remains bounded and does not add device fingerprinting or live location collection", () => {
  const technical = copy("technical");
  for (const feature of [/pengecam|pengenal/, /cap masa/, /kadar/, /muat naik/, /penyedia/, /log/, /terhad/]) matches(technical, feature);
  matches(technical, /tidak[^.]*cap jari|tidak[^.]*fingerprint/);
  matches(technical, /GPS/);
  matches(technical, /IP/);
  matches(technical, /tidak[^.]*semua[^.]*dipadam|tidak[^.]*setiap[^.]*dipadam/);
});

test("BM purpose sections preserve supported marketplace use without adding external advertising profiles", () => {
  const use = `${copy("uses")} ${copy("operations")}`;
  for (const purpose of [/akaun/, /penyenaraian/, /mesej/, /tawaran/, /lelongan/, /Saved/, /ikut|mengikuti/, /sokongan|menyokong/, /pemadaman/, /keselamatan/]) matches(use, purpose);
  const discovery = copy("discovery");
  for (const detail of [/carian/, /cadangan/, /minat/, /peribadi/, /agregat/]) matches(discovery, detail);
  matches(discovery, /bukan[^.]*laman web lain|tidak[^.]*laman web lain/);
  matches(discovery, /tidak[^.]*pengiklanan/);
  for (const id of ["compliance", "fraud"]) matches(copy(id), marker);
});

test("BM does not sell personal data to advertisers and limits sharing to established recipients", () => {
  const text = copy("sharing");
  matches(text, /TAKEME tidak menjual data peribadi kepada pengiklan/);
  for (const recipient of [/peserta/, /penyedia/, /pihak berkuasa/, /keselamatan|penipuan/, /berkuasa|diberi kuasa/]) matches(text, recipient);
  matches(text, /terhad/);
  matches(text, /e-mel/);
  matches(text, /alamat peribadi/);
  matches(text, /tidak[^.]*awam/);
});

test("BM provider names and processing caveats match English without invented countries", () => {
  const providers = copy("providers");
  for (const provider of [/Firebase\/Google Cloud/, /Authentication/, /Cloud Firestore/, /Cloud Storage/, /Cloud Functions/, /Cloudflare Workers/, /Netlify/, /Gmail/]) matches(providers, provider);
  matches(providers, /sementara/);
  matches(providers, marker);
  const transfers = copy("transfers");
  matches(transfers, /mungkin|boleh/);
  matches(transfers, /di luar Malaysia/);
  matches(transfers, marker);
  matches(transfers, /tidak[^.]*semua[^.]*Malaysia|tiada[^.]*semua[^.]*Malaysia/);
  assert.doesNotMatch(`${providers} ${transfers}`, /Singapura|Amerika Syarikat|Eropah|China|Australia/);
});

test("BM preserves all exact retention periods and start-point distinctions", () => {
  const section = bmPrivacySections.find(value => value.id === "retention");
  assert.ok(section?.bullets);
  const expected = [[30], [90, 90], [12], [180], [], []];
  for (const [index, bullet] of section.bullets.entries()) {
    assert.deepEqual([...bullet.matchAll(/\b\d+\b/g)].map(match => Number(match[0])), expected[index], `Retention rule ${index + 1}`);
  }
  matches(section.bullets[0], /30 hari/);
  matches(section.bullets[0], /selepas[^.]*selesai|selepas[^.]*penyelesaian/);
  matches(section.bullets[1], /90 hari[^.]*ditutup|90 hari[^.]*penutupan/);
  matches(section.bullets[1], /pembersihan/);
  matches(section.bullets[2], /12 bulan kalendar/);
  matches(section.bullets[3], /180 hari[^.]*ditutup|180 hari[^.]*penutupan/);
  matches(section.bullets[3], /terbuka/);
  matches(copy("retention"), marker);
  matches(copy("retention"), /Malaysia/);
  matches(copy("retention"), /pseudonim/);
  matches(copy("retention"), /tidak semestinya[^.]*tanpa nama|tidak semestinya[^.]*anonim/);
  matches(copy("retention"), /tidak[^.]*jadual/);
});

test("BM deletion keeps request, obligations, pseudonymisation and real completion caveats", () => {
  const text = copy("deletion");
  for (const detail of [/permintaan/, /lelongan/, /urusan|urus niaga/, /pertikaian/, /penipuan/, /keselamatan/, /undang-undang/, /statutori|berkanun/, /pseudonim/, /sandaran/, /log/]) matches(text, detail);
  matches(text, /tertangguh|menunggu/);
  matches(text, /Firebase Auth/);
  matches(text, /pengeluaran|produksi/);
  matches(text, /dimatikan|tidak diaktifkan|off/);
  matches(text, /tidak[^.]*serta-merta|tiada[^.]*serta-merta/);
  matches(text, /tidak[^.]*memalsukan|tidak[^.]*mereka-reka/);
  matches(text, marker);
  assert.ok(bmPrivacySections.find(value => value.id === "deletion")?.links?.some(link => link.href === "/account-deletion"));
});

test("BM holds and backups preserve restricted purpose, expiry and deletion-safe recovery requirements", () => {
  const text = copy("holds");
  for (const detail of [/tujuan/, /luput|tamat/, /terhad/, /terbuka/, /penyelesaian/, /sandaran/, /log/, /pemulihan/, /pemadaman/]) matches(text, detail);
  matches(text, /didokumenkan/);
  matches(text, /sebelum[^.]*aktif/);
  matches(text, /bukan[^.]*automatik|tidak[^.]*automatik/);
  matches(text, marker);
});

test("BM rights stay conditional on Malaysian law, with ownership checks and no universal GDPR promises", () => {
  const text = copy("rights");
  for (const right of [/akses/, /pembetulan|membetulkan/, /menarik balik persetujuan/, /pemprosesan/, /aduan/, /pemadaman/]) matches(text, right);
  matches(text, /jika terpakai|apabila terpakai|setakat[^.]*terpakai/);
  matches(text, /Malaysia/);
  matches(text, /pemilikan|identiti/);
  matches(text, /Jangan[^.]*kata laluan|jangan[^.]*kata laluan/);
  matches(text, /tidak[^.]*GDPR|bukan[^.]*GDPR/);
  matches(text, marker);
});

test("BM security avoids absolute promises and keeps breach and DPO decisions unresolved", () => {
  const text = copy("security");
  matches(text, /teknikal/);
  matches(text, /organisasi/);
  matches(text, /Tiada[^.]*mutlak|tiada[^.]*mutlak|tidak[^.]*mutlak/);
  matches(text, /kod pengesahan/);
  matches(text, /pelanggaran/);
  matches(text, /DPO/);
  matches(text, marker);
});

test("BM keeps explicit adults-only confirmation without implying collection of birth dates or IDs", () => {
  const text = copy("age");
  matches(text, /18 tahun|18\+/);
  matches(text, /bawah 18/);
  matches(text, /tidak[^.]*akaun/);
  matches(text, /dilindungi|terlindung/);
  matches(text, /pengesahan 18\+/);
  matches(text, /tidak[^.]*tarikh lahir/);
  matches(text, /dokumen identiti|dokumen pengenalan/);
  matches(text, /biometrik/);
});

test("BM acceptance evidence is server-authored and immutable during consent, with bounded retention", () => {
  const text = copy("acceptance");
  for (const detail of [/pelayan/, /versi/, /Terms|Terma/, /Privacy|Privasi/, /18\+/, /cap masa/, /sumber/, /konteks/, /kelayakan/, /tidak boleh diubah|kekal tidak berubah/]) matches(text, detail);
  matches(text, /pemadaman/);
  matches(text, /bukan[^.]*kekal|tidak[^.]*kekal|bukan[^.]*selama-lamanya/);
  matches(text, /log masuk/);
  matches(text, /muat semula/);
  matches(text, /tidak[^.]*penerimaan/);
  assert.doesNotMatch(allCopy(), /releasePolicies\/current|policyAcceptances\/events|accountSetup\/current|eligibility\/current|users\/\{[^}]*\}/);
});

test("BM retains browsing without consent, protected-action acceptance and return intent without auto-execution", () => {
  const authentication = copy("authentication");
  matches(authentication, /awam/);
  matches(authentication, /tidak[^.]*akaun/);
  for (const action of [/Sell/, /Chat/, /Offer/, /Bid/, /Save/, /Follow/, /muat naik/]) matches(authentication, action);
  matches(authentication, /jelas|nyata/);
  matches(authentication, /18\+/);
  const changes = copy("changes");
  matches(changes, /versi lama|lapuk|ketinggalan/);
  matches(changes, /menerima semula|penerimaan semula/);
  matches(changes, /tidak[^.]*secara automatik/);
  matches(changes, /log masuk|Log masuk/);
  matches(changes, /muat semula/);
});

test("BM cookies and SDK wording does not introduce marketing tracking or offline cache", () => {
  const text = copy("storage");
  for (const feature of [/Firebase Authentication/, /pelayar/, /sesi/, /Firebase Analytics/, /Firestore/, /kuki/]) matches(text, feature);
  matches(text, /tidak[^.]*Firebase Analytics/);
  matches(text, /tidak[^.]*pemasaran/);
  matches(text, marker);
});

test("BM does not turn reserved payment, shipping, seller or media features into current services", () => {
  const scope = copy("scope");
  for (const service of [/Stripe/, /AWB/, /Seller Centre/, /perdagangan melalui siaran langsung|live commerce/, /video pendek|short-video/]) matches(scope, service);
  matches(scope, /tidak[^.]*Stripe/);
  matches(scope, /tidak[^.]*pembayaran|tidak[^.]*memproses/);
  matches(scope, /masa hadapan/);
  const listings = copy("listings");
  matches(listings, /promosi/);
  matches(listings, /tidak[^.]*membeli/);
  matches(listings, /tidak[^.]*bayaran/);
});

test("BM retains every unresolved legal topic and a visibly unpublished draft status", () => {
  for (const id of ["compliance", "fraud", "providers", "transfers", "retention", "deletion", "holds", "security", "rights", "storage", "changes", "contact"]) matches(copy(id), marker, id);
  matches(bmPrivacyDocument.reviewNotice, /draf/i);
  matches(bmPrivacyDocument.reviewNotice, /tidak[^.]*diterbitkan|belum[^.]*diterbitkan/i);
  matches(bmPrivacyDocument.reviewNotice, /tarikh[^.]*pelancaran/i);
  assert.doesNotMatch(allCopy(), /staging|synthetic demo/);
  assert.doesNotMatch(allCopy(), /(?:Tarikh berkuat kuasa|kemas kini terakhir)\s*:?\s*\d{4}-\d{2}-\d{2}/i);
});

test("Populated BM draft never grants production access without independent content and launch approval", () => {
  assert.equal(privacyNotices.en.sections, privacySections);
  assert.equal(privacyNotices.bm.sections, bmPrivacySections);
  assert.equal(privacyNotices.en.href, "/privacy");
  assert.equal(privacyNotices.bm.href, "/privacy/bm");
  assert.equal(hasApprovedBmPrivacyNotice(), false);
  const contentApproval = { ...legalPublicationReadiness, bmPrivacyNoticeApproved: true };
  assert.equal(hasApprovedBmPrivacyNotice(contentApproval, null), false);
  assert.equal(hasApprovedBmPrivacyNotice(contentApproval, []), false);
  assert.equal(hasApprovedBmPrivacyNotice(legalPublicationReadiness, bmPrivacySections), false);
  assert.equal(hasApprovedBmPrivacyNotice(contentApproval, bmPrivacySections), true);
  const production = { nodeEnv: "production", useEmulators: "false", projectId: "takeme-52b80" };
  assert.equal(canPublishProductionLegal(production), false);
  assert.equal(canRenderBmPrivacyNotice(production), false);
  assert.equal(canRenderBmPrivacyNotice(production, contentApproval, productionReleasePolicy, bmPrivacySections), false, "BM text approval alone cannot bypass missing launch approvals and release proof");
  const preview = { nodeEnv: "development", useEmulators: "true", projectId: "demo-takeme" };
  assert.equal(canPreviewLegalDraft(preview), true);
  assert.equal(canRenderBmPrivacyNotice(preview), true);
  for (const runtime of [{ nodeEnv: "development", useEmulators: "false", projectId: "demo-takeme" }, { nodeEnv: "development", useEmulators: "true", projectId: "takeme-52b80" }, { nodeEnv: "production", useEmulators: "false", projectId: "takeme-staging-822a5" }]) assert.equal(canRenderBmPrivacyNotice(runtime), false);
});

test("BM draft metadata stays noindex/nofollow with the right title and canonical route", () => {
  const metadata = buildBmPrivacyMetadata(false);
  assert.deepEqual(metadata.title, { absolute: "Notis Privasi TAKEME" });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.alternates?.canonical, "/privacy/bm");
  assert.equal(metadata.openGraph?.title, "Notis Privasi TAKEME");
  assert.equal(metadata.openGraph?.url, "/privacy/bm");
  assert.deepEqual(buildBmPrivacyMetadata(true).robots, { index: false, follow: false }, "Publication input cannot advertise independently unapproved BM text");
  assert.deepEqual(buildPrivacyMetadata(false).robots, { index: false, follow: false });
  assert.deepEqual(buildPrivacyMetadata(true).alternates?.languages, { en: "/privacy" });
});

test("BM route uses the existing legal gates, section renderer and accessible language declaration", () => {
  const route = source("../src/app/privacy/bm/page.tsx");
  matches(route, /requireLegalInformation\(\)/);
  matches(route, /canRenderBmPrivacyNotice/);
  matches(route, /notFound\(\)/);
  matches(route, /buildBmPrivacyMetadata\(isProductionLegalPublication\(\)\)/);
  matches(route, /policy="privacy"/);
  matches(route, /language="ms"/);
  matches(route, /reviewNotice=\{bmPrivacyDocument\.reviewNotice\}/);
  matches(route, /sections=\{bmPrivacySections\}/);
  matches(route, /PrivacyLanguages current="bm"/);
  const renderer = source("../src/components/public-information/public-information.tsx");
  matches(renderer, /lang=\{language\}/);
  matches(renderer, /aria-labelledby=\{section\.id\}/);
  matches(renderer, /<h2 id=\{section\.id\}/);
  const css = source("../src/components/public-information/public-information.module.css");
  matches(css, /@media\s*\(max-width:\s*900px\)/);
  matches(css, /\.mobileToc\s*\{[^}]*display:\s*block/);
  matches(css, /\.desktopToc\s*\{[^}]*display:\s*none/);
  matches(css, /\.article\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/);
});

test("Language selector distinguishes owner preview from independently approved public availability", () => {
  const selector = source("../src/components/public-information/privacy-languages.tsx");
  matches(selector, /hasApprovedBmPrivacyNotice/);
  matches(selector, /isLocalLegalPreview\(\)/);
  matches(selector, /aria-current/);
  matches(selector, /Object\.entries\(privacyNotices\)/);
  matches(selector, /href=\{notice\.href\}/);
  matches(selector, /lang=\{language === "bm" \? "ms" : "en"\}/);
  assert.equal(privacyNotices.en.language, "English");
  assert.equal(privacyNotices.bm.language, "Bahasa Melayu");
});
