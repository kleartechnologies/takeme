import { inflateSync } from "node:zlib";
export const ADMIN_ASSET_MAX_BYTES = 2 * 1024 * 1024;
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let i = 0; i < 8; i++)
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** PNG only; browser normalizes pixels using canvas, avoiding an unfinished media processor. */
export function adminAssetDimensions(bytes: Buffer) {
  if (
    bytes.length < 33 ||
    bytes.length > ADMIN_ASSET_MAX_BYTES ||
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new Error("Upload a PNG image up to 2 MB.");
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (
    width < 320 ||
    height < 120 ||
    width > 2560 ||
    height > 2560 ||
    width * height > 4000000
  )
    throw new Error(
      "Image dimensions must be 320–2560 × 120–2560, up to 4 megapixels.",
    );
  // Browser canvas emits non-interlaced 8-bit RGB/RGBA. Validate its complete
  // chunk stream and bounded pixels; a forged IHDR is not a usable image.
  if (
    bytes.readUInt32BE(8) !== 13 ||
    bytes[24] !== 8 ||
    ![2, 6].includes(bytes[25]!) ||
    bytes[26] ||
    bytes[27] ||
    bytes[28]
  )
    throw new Error("Normalize this image to PNG before uploading.");
  const compressed: Buffer[] = [];
  let offset = 8,
    ended = false,
    chunks = 0;
  while (offset < bytes.length) {
    if (++chunks > 1024 || offset + 12 > bytes.length)
      throw new Error("Invalid PNG chunks.");
    const length = bytes.readUInt32BE(offset),
      next = offset + 12 + length;
    if (
      next > bytes.length ||
      crc32(bytes.subarray(offset + 4, next - 4)) !==
        bytes.readUInt32BE(next - 4)
    )
      throw new Error("Invalid PNG checksum.");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") compressed.push(bytes.subarray(offset + 8, next - 4));
    else if (type === "IEND") {
      if (length || next !== bytes.length) throw new Error("Invalid PNG end.");
      ended = true;
    } else if (type === "IHDR") {
      if (offset !== 8) throw new Error("Duplicate PNG header.");
    } else if (!["sRGB", "gAMA", "cHRM", "pHYs"].includes(type))
      throw new Error("PNG contains unsupported metadata. Normalize it first.");
    offset = next;
  }
  if (!ended || !compressed.length) throw new Error("Incomplete PNG.");
  const rowBytes = width * (bytes[25] === 6 ? 4 : 3) + 1;
  const pixels = inflateSync(Buffer.concat(compressed), {
    maxOutputLength: rowBytes * height,
  });
  if (pixels.length !== rowBytes * height)
    throw new Error("Invalid PNG pixels.");
  for (let row = 0; row < height; row++)
    if (pixels[row * rowBytes]! > 4) throw new Error("Invalid PNG row filter.");
  return { width, height };
}
export function assetFits(placement: string, width: number, height: number) {
  const ratio = width / height;
  return placement === "desktop_hero"
    ? ratio >= 1.8 && ratio <= 4
    : placement === "mobile_hero"
      ? ratio >= 0.65 && ratio <= 1.6
      : placement === "promo_strip"
        ? ratio >= 3 && ratio <= 12
        : ratio >= 0.8 && ratio <= 2;
}
