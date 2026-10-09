# Media V1 public image validation correction

The production server catalogue validated only the default Storage bucket. Media V1 images were correctly admitted, processed and authorized by Storage, but Home/Fresh Finds discarded the dedicated-bucket projection. Staging had a separate derivative validator and concealed this production-only mismatch.

## Bounded contract

Production public listing images accept exactly `takeme-52b80.firebasestorage.app` legacy listing objects and `takeme-52b80-media-v1` reviewed derivatives. The existing app default bucket stays unchanged. Staging uses its own two exact project-owned buckets and shares the derivative grammar.

Legacy listing objects use `users/<uid>/listings/<listingId>/<image filename>`. Dedicated derivatives use `users/<uid>/listing-media/<imageId>/v1-<SHA256>/{card,thumbnail,detail}.webp`, canonical Firebase Storage HTTPS URLs and `alt=media` without download tokens. Unknown projects/buckets, raw/staging namespaces, malformed/double-encoded paths, extra query parameters and unrelated Storage objects fail closed. Editorial PNGs and profile avatars remain separate namespaces; extensionless UUID profile uploads remain compatible.

URL validation does not grant public access. Authoritative public listing projections and Storage READY/link/visibility rules still enforce publication authorization. Private drafts, retained derivatives of removed listings, and raw originals remain protected by those rules.

## Validator inventory

- `firebase/public-catalogue-server.ts`: Home/Fresh Finds and initial Product server content; uses the shared bounded helper for listing images and separate editorial/avatar surfaces.
- `firebase/public-listing-server.ts` and `listing-metadata.ts`: public metadata uses the same approved source contract.
- `firebase/staging-isolation.ts`: dedicated staging derivative validation delegates to the same canonical grammar.
- `listing-media.ts`: existing CARD/THUMBNAIL/DETAIL selection serves Explore, seller storefront, Saved, Updates, recommendations and Product gallery; no selector change required.
- `public-catalogue.ts`, homepage/public listing projections, upload permits and Functions: existing authoritative projection/READY ownership checks remain unchanged.

## Qualification

The production-identity regression renders the actual HomeMarketplace/ListingCard with a dedicated CARD derivative through the public Home projection. It also verifies Product DETAIL, smaller THUMBNAIL selection, metadata, legacy Home rendering, private listing-state rejection and malformed/foreign/raw source rejection. UI decorators and Next primitives are isolated in this server render test; live browser qualification remains required.

No Functions, rules, processor, IAM, Eventarc, legal, auth-domain or Admin source changes are part of this correction. Redeploy the corrected consumer with admissions OFF, then enable admissions for the controlled iPhone synthetic smoke. Verify all public surfaces, withdraw the fixture, check lifecycle access denial and monitor before reconciling to main. HEIC V1.1 research and unfinished auth switching are excluded from that reconciliation.
