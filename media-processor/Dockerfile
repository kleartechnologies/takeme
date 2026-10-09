FROM node:22.23.0-trixie@sha256:81345306bb6a7cd60d113d44194dd85cb0f5183a22eb76245a7fc11bc33d4f7f AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake ninja-build python3-pip pkg-config curl ca-certificates libglib2.0-dev libexpat1-dev libjpeg62-turbo-dev libpng-dev libwebp-dev liblcms2-dev libdav1d-dev libyuv-dev && rm -rf /var/lib/apt/lists/*
RUN pip3 install --break-system-packages meson==1.10.0
ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:/usr/local/lib/x86_64-linux-gnu/pkgconfig
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib/x86_64-linux-gnu
WORKDIR /build
COPY media-processor/native-sources.json ./
RUN node --input-type=module -e 'import fs from "node:fs";import crypto from "node:crypto";for(const r of JSON.parse(fs.readFileSync("native-sources.json"))){const res=await fetch(r.url);if(!res.ok)throw Error("source fetch failed");const b=Buffer.from(await res.arrayBuffer());if(crypto.createHash("sha256").update(b).digest("hex")!==r.sha256)throw Error("source hash mismatch");fs.writeFileSync(r.name+".tgz",b);}'
RUN tar xf libavif.tgz && cmake -S libavif-1.4.2 -B avif -DCMAKE_BUILD_TYPE=Release -DAVIF_BUILD_APPS=ON -DAVIF_BUILD_TESTS=OFF -DAVIF_CODEC_DAV1D=SYSTEM -DAVIF_CODEC_AOM=OFF -DAVIF_CODEC_LIBGAV1=OFF -DAVIF_CODEC_RAV1E=OFF -DAVIF_CODEC_SVT=OFF -DAVIF_LIBYUV=SYSTEM && cmake --build avif --target avifdec -j4 && cp avif/avifdec /usr/local/bin/avifdec && cp -a avif/libavif.so* /usr/local/lib/
RUN tar xf libvips.tgz && meson setup vips libvips-8.18.7 --buildtype=release --prefix=/usr/local -Dheif=disabled -Dmagick=disabled -Dpdfium=disabled -Dpoppler=disabled -Drsvg=disabled -Dtiff=disabled -Dopenslide=disabled -Dopenexr=disabled -Dfftw=disabled -Dorc=disabled -Dintrospection=disabled -Dpangocairo=disabled -Dfontconfig=disabled -Darchive=disabled -Dcfitsio=disabled -Dnsgif=false -Dppm=false -Dradiance=false && meson compile -C vips -j4 && meson install -C vips && ldconfig
WORKDIR /app
COPY media-processor/package*.json ./
ENV SHARP_FORCE_GLOBAL_LIBVIPS=1
RUN npm ci --include=dev && npm explore sharp -- npm run build
RUN rm -rf node_modules/@img/sharp-* && ! pkg-config --exists libheif
RUN node --input-type=module -e 'import sharp from "sharp";if(sharp.versions.vips!=="8.18.7")throw Error("Wrong V1 image processor binary");'
COPY media-processor/*.mjs ./
COPY media-processor/test ./test
COPY functions/package*.json ./functions/
COPY functions/tsconfig.json ./functions/
COPY functions/src ./functions/src
RUN cd functions && npm ci && npm run build && rm -rf node_modules
RUN npm prune --omit=dev && rm -rf node_modules/@img/sharp-*
# Retain dynamic LGPL libraries and source hashes/licenses for audit/relinking.
RUN mkdir -p /licenses && cp /build/libavif-1.4.2/LICENSE /licenses/libavif && cp /build/libvips-8.18.7/LICENSE /licenses/libvips
FROM node:22.23.0-trixie-slim@sha256:cfd8f2a5bc50526aee08e88970979f92722828e7dcc6d8983607fb8bff4bdb82
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends libglib2.0-0t64 libexpat1 libjpeg62-turbo libpng16-16 libwebp7 libwebpmux3 libwebpdemux2 liblcms2-2 libdav1d7 libyuv0 libgomp1 libexif12 libopenjp2-7 && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/lib /usr/local/lib
COPY --from=build /usr/local/bin/avifdec /usr/local/bin/avifdec
RUN ldconfig && rm -rf /usr/local/lib/node_modules/npm /opt/yarn* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build /app /app
COPY --from=build /licenses /licenses
COPY media-processor/native-sources.json /licenses/native-sources.json
COPY media-processor/THIRD_PARTY_NOTICES.md /licenses/THIRD_PARTY_NOTICES.md
COPY media-processor/licenses/ /licenses/upstream/
RUN find /usr/share/doc -name copyright -exec cp --parents {} /licenses/ \;
WORKDIR /app
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib/x86_64-linux-gnu
ENV NODE_ENV=production MALLOC_ARENA_MAX=2 VIPS_CONCURRENCY=1
# COPY must not depend on the host checkout's umask. Application files remain
# root-owned/read-only to the runtime user; no privileged helper is needed.
RUN chmod -R a+rX /app /usr/local/lib /licenses && find / -xdev -type f -perm /6000 -exec chmod a-s {} +
RUN test -z "$(find /usr/local/lib /usr/lib -iname '*heif*' -o -iname '*de265*' -o -iname '*x265*')"
RUN node -e 'require("./node_modules/sharp/src/build/Release/sharp-linux-x64-0.35.5.node")'
USER node
CMD ["node", "server.mjs"]
