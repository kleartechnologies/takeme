import sharp from "sharp";
import { createHash } from "node:crypto";
import { decodeAvif } from "./avif-input.mjs";

sharp.cache(false);
sharp.concurrency(1);
export const LIMITS = Object.freeze({ bytes: 30 * 1024 * 1024, pixels: 50_000_000, edge: 16384, seconds: 20 });
export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
/** Restrict parsers before handing attacker-controlled bytes to native libraries. */
export function sniff(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > LIMITS.bytes) throw new Error("invalid-input");
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) === bytes.length - 8) return "webp";
  if (bytes.toString("ascii", 4, 8) === "ftyp") {
    const length = bytes.readUInt32BE(0);
    if (length < 16 || length > 256 || length > bytes.length || length % 4) throw new Error("invalid-input");
    const brands = [bytes.toString("ascii", 8, 12)];
    for (let n = 16; n < length; n += 4) brands.push(bytes.toString("ascii", n, n + 4));
    if (brands.some(b => ["msf1", "hevc", "hevx", "avis"].includes(b))) throw new Error("sequence-not-supported");
    if (brands.some(b => ["heic", "heix"].includes(b))) throw new Error("unsupported-input");
    if (brands.includes("avif")) return "avif";
  }
  throw new Error("unsupported-input");
}
/** Always decode actual pixels; metadata inspection alone cannot qualify an image. */
export async function normalize(bytes, expectedDigest, expectedMime) {
  const input = sniff(bytes), digest = hash(bytes);
  if (expectedDigest && digest !== expectedDigest) throw new Error("digest-mismatch");
  if (expectedMime !== undefined && expectedMime !== `image/${input}`) throw new Error("mime-mismatch");
  const decoded = input === "avif" ? await decodeAvif(bytes, LIMITS) : bytes;
  const options = { failOn: "warning", limitInputPixels: LIMITS.pixels, sequentialRead: true, animated: false };
  const metadata = await sharp(decoded, options).metadata();
  if (!metadata.width || !metadata.height || metadata.width > LIMITS.edge || metadata.height > LIMITS.edge
    || metadata.width * metadata.height > LIMITS.pixels || (metadata.pages ?? 1) !== 1
    || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("invalid-dimensions-or-format");
  // autoOrient applies EXIF transforms; sRGB converts colour before stripping profiles.
  // No keepMetadata/withMetadata call: outputs never inherit GPS, EXIF, XMP or device metadata.
  const variants = {};
  for (const [name, edge] of Object.entries({ thumbnail: 400, card: 800, detail: 1600 })) {
    const { data, info } = await sharp(decoded, options).autoOrient().toColourspace("srgb")
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 }).timeout({ seconds: LIMITS.seconds }).toBuffer({ resolveWithObject: true });
    const final = await sharp(data).metadata();
    if (final.exif || final.xmp || final.iptc || final.icc || final.orientation || data.length > 8 * 1024 * 1024) throw new Error("unsafe-output");
    variants[name] = { bytes: data, width: info.width, height: info.height, size: data.length, digest: hash(data) };
  }
  return { digest, input, variants, width: variants.detail.width, height: variants.detail.height };
}
