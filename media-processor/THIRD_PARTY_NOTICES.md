# TAKEME Media Pipeline V1 notices

V1 normalizes JPEG, PNG, WebP and qualified still AVIF to stripped WebP derivatives. Raw HEIC/HEIF is not admitted or decoded. Research retained under `research/heic-v1.1/` is excluded from the V1 image and rollout.

| Component | Version | Licence | Included text |
| --- | --- | --- | --- |
| Sharp | 0.35.5 | Apache-2.0 | `/licenses/upstream/sharp.txt`; installed package licence |
| libvips | 8.18.7 | LGPL-2.1-or-later | `/licenses/libvips`; `/licenses/upstream/libvips.txt` |
| libavif | 1.4.2 | BSD-2-Clause (with upstream bundled notices) | `/licenses/libavif`; `/licenses/upstream/libavif.txt` |
| dav1d | Debian runtime version in qualified inventory | BSD-2-Clause | `/licenses/usr/share/doc/libdav1d7/copyright` |
| libyuv | Debian runtime version in qualified inventory | BSD-3-Clause | `/licenses/usr/share/doc/libyuv0/copyright` |

The libavif binary is built with only the dav1d AV1 decoder, fixed single-thread decode and resource limits. No libheif, libde265, x265 or HEVC implementation is installed. AVIF is not raw HEIC support. The root `native-sources.json` pins source archives/checksums; `Dockerfile` records unmodified-source build options. Distro runtime copyright texts are copied under `/licenses/usr/share/doc`, and production Node packages retain their upstream licences. Image identity/package versions belong in the qualified deployment receipt, not an unpinned claim about future rebuilds.

These licences permit private commercial service use. Return of image output does not distribute the decoder to a browser or require publication of TAKEME application source. Copyright permission is not a blanket patent clearance statement; HEVC commercial disposition is deferred with HEVC functionality to V1.1.

Apache distribution retains licence, applicable attribution/NOTICE material and modification notices. BSD distribution retains upstream copyright/licence/disclaimer. LGPL distribution must preserve library-use/copyright/licence notices, allow replacement/relinking and reverse engineering for library debugging, and provide corresponding library source through a valid licence-permitted delivery method. Do not treat a link alone as satisfying a source-delivery duty. libvips is dynamically linked and no restrictive consumer EULA is introduced by this package. Keep exact native source archives/build instructions privately alongside the release evidence for any recipient/source request; do not distribute the image publicly without its required corresponding-source arrangements. Static linking or external redistribution requires a new compliance review. No full application source-offer promise is made.

HEIC research notices and codec texts remain in `research/heic-v1.1/`; they are not V1 runtime dependencies. Keep historic qualification reports as evidence of the old image, not claims about this candidate.
