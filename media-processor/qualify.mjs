/** Offline V1 Linux qualification. Synthetic fixtures, timings and outputs stay outside Git. */
import fs from "node:fs/promises";
import sharp from "sharp";
import { isolatedNormalize } from "./process.mjs";
const fixture = process.env.TAKEME_AVIF_FIXTURE, out = process.env.TAKEME_MEDIA_QUALIFICATION_OUTPUT;
if (!fixture || !out) throw Error("Private AVIF fixture/output paths required.");
await fs.mkdir(out, { recursive: true });
const base = sharp({ create: { width: 4000, height: 3000, channels: 4, background: { r: 90, g: 130, b: 200, alpha: 0.5 } } });
const fixtures = { jpeg: await base.clone().jpeg().toBuffer(), png: await base.clone().png().toBuffer(), webp: await base.clone().webp().toBuffer(), avif: await fs.readFile(fixture) };
const measurements = [], batches = [];
for (const [name, bytes] of Object.entries(fixtures)) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now(), result = await isolatedNormalize(bytes, undefined, `image/${name}`);
    times.push(Math.round(performance.now() - start));
    if (i === 0) { await fs.writeFile(`${out}/${name}-card.webp`, result.variants.card.bytes); measurements.push({ name, inputBytes: bytes.length, variants: Object.fromEntries(Object.entries(result.variants).map(([k, v]) => [k, { width: v.width, height: v.height, bytes: v.size }])) }); }
  }
  measurements.find(m => m.name === name).times = times;
}
// Compare strictly bounded local decoder work, not cloud/Eventarc end-to-end latency.
for (const count of [1, 4, 8]) for (const parallelism of [1, 2]) {
  const input = Array.from({ length: count }, (_, i) => Object.values(fixtures)[i % 4]);
  const start = performance.now();
  for (let i = 0; i < input.length; i += parallelism) await Promise.all(input.slice(i, i + parallelism).map(bytes => isolatedNormalize(bytes)));
  batches.push({ count, parallelism, milliseconds: Math.round(performance.now() - start) });
}
const record = { platform: process.platform, arch: process.arch, node: process.version, sharp: sharp.versions, measurements, batches, scope: "Offline decoder only; no admission/upload/Eventarc/queue/READY-propagation measurement." };
await fs.writeFile(`${out}/measurements.json`, JSON.stringify(record, null, 2));
console.log(JSON.stringify(record));
