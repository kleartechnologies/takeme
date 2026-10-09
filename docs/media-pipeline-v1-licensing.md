# Media pipeline V1 licence qualification

Status: **HEIC LICENCE — REVIEW REQUIRED**. No commercial patent clearance or legal approval is asserted. No production deployment is authorized by this review.

| Component | Exact version | Copyright licence | Deployment obligations / boundary |
| --- | --- | --- | --- |
| Sharp | 0.35.5 | Apache-2.0 | Preserve licence/copyright and applicable notices; include modification notices when distributing modified sources. No browser-native decoder is distributed. |
| libvips | 8.18.7 | LGPL (upstream LICENSE is LGPL 2.1; source permits later versions) | Preserve licence/notices and corresponding source access when distributing the library; keep dynamic relinking possible. |
| libheif | 1.23.6 | LGPL-3.0-or-later | Preserve licence/notices and corresponding source/relinking obligations if conveyed. Container/server use does not itself grant HEVC patent rights. |
| libde265 | 1.1.3 | LGPL-3.0-or-later | Dynamic HEVC decoding library; same corresponding-source/relinking/distribution review. |
| HEVC / HEIC codec use | Decoder-only | Separate patent considerations | Commercial marketplace/server processing applicability remains **OWNER / LEGAL REVIEW REQUIRED**. Open-source copyright permission is not patent-pool clearance. |

Primary evidence: [Sharp licence](https://github.com/lovell/sharp/blob/v0.35.5/LICENSE), [libvips licence](https://github.com/libvips/libvips/blob/v8.18.7/LICENSE), [libheif licence](https://github.com/strukturag/libheif/blob/v1.23.6/COPYING), [libde265 licence](https://github.com/strukturag/libde265/blob/v1.1.3/COPYING), [HEVC pool general terms](https://accessadvance.com/hevc-advance-patent-pool-general-pool-terms/).

The container retains LGPL texts under /licenses, exact upstream source archive URLs/checksums in native-sources.json, and dynamically linked libraries. Sharp's installed package retains its licence. These are preparation controls, not a complete distributor compliance package. Before conveying a container, confirm complete corresponding sources, build scripts, all transitively distributed notices, recipient relinking rights and any source offer required by the selected licence. Do not describe source URLs alone as satisfying every distribution obligation.

No x265 encoder, browser HEIC WASM distribution, FFmpeg, external image vendor or new privacy provider is introduced. The local Linux binary qualifies pixels for several HEIC/HEIF fixtures, but one modern auxiliary-image HEIC fixture fails safely; broad phone compatibility is still unqualified. Server-only operation changes the copyright conveyance analysis compared with shipping a decoder to users; it does not automatically resolve commercial HEVC patents.

Required owner/legal input: determine actual jurisdictions and commercial server-decoding use, applicable patent/licence obligations and any required agreement; review container redistribution/source/notice obligations. Until that disposition is recorded, SAFE TO DEPLOY remains NO even if technical staging tests pass. Existing legal notices were not changed.
