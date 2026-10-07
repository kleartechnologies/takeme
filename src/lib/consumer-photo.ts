/** Input limits apply before decoding; Storage continues to receive only reviewed WebP. */
export const MAX_CONSUMER_PHOTO_BYTES = 30 * 1024 * 1024;
export const MAX_CONSUMER_PHOTO_PIXELS = 50_000_000;
export const MAX_CONSUMER_PHOTO_EDGE = 16_384;
export const PHOTO_PROCESSING_TIMEOUT_MS = 25_000;
export const NATIVE_HEIC_UNAVAILABLE_MESSAGE = "We can’t process this photo on this device yet. Please choose another photo or convert it to JPG or PNG.";
export function photoPreparationIssue(photos: readonly { failed?: boolean; preparing?: boolean }[], missingPhotos = 0) {
  if (missingPhotos) return "Reselect the photos the browser could not retain.";
  if (!photos.length) return "Add at least one photo.";
  if (photos.some(photo => photo.failed)) return "Replace or remove the photos that couldn’t be processed.";
  if (photos.some(photo => photo.preparing)) return "Your photos are still preparing. You can keep editing.";
  return "";
}
export const CONSUMER_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.jpg,.jpeg,.heic,.heif,.avif";
export type ConsumerPhotoFormat = "jpeg" | "png" | "webp" | "heic" | "avif";
export interface PhotoHeader { format: ConsumerPhotoFormat; width: number; height: number }
export function requirePhotoDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_CONSUMER_PHOTO_EDGE || height > MAX_CONSUMER_PHOTO_EDGE || width * height > MAX_CONSUMER_PHOTO_PIXELS) {
    throw new Error("This photo is too large to process. Choose a smaller photo.");
  }
}
/** Content sniffing is a bounded preflight, never a substitute for successful pixel decoding. */
export function inspectConsumerPhoto(bytes: Uint8Array): PhotoHeader {
  if (!bytes.length || bytes.length > MAX_CONSUMER_PHOTO_BYTES) throw new Error("Choose a photo smaller than 30 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size));
  const result = (format: ConsumerPhotoFormat, width: number, height: number) => { requirePhotoDimensions(width, height); return { format, width, height }; };
  if (bytes.length >= 33 && text(0, 8) === "\x89PNG\r\n\x1a\n" && text(12, 4) === "IHDR") return result("png", view.getUint32(16), view.getUint32(20));
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length && offset < 512 * 1024) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) break;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && size >= 8) return result("jpeg", view.getUint16(offset + 5), view.getUint16(offset + 3));
      offset += size;
    }
  }
  if (bytes.length >= 25 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP" && view.getUint32(4, true) === bytes.length - 8) {
    const kind = text(12, 4);
    const le24 = (i: number) => bytes[i] | bytes[i+1] << 8 | bytes[i+2] << 16;
    if (kind === "VP8X" && bytes.length >= 30) {
      if (bytes[20] & 0x02) throw new Error("Choose a still photo rather than an animation.");
      return result("webp", le24(24) + 1, le24(27) + 1);
    }
    if (kind === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return result("webp", view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
    if (kind === "VP8L" && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); return result("webp", (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); }
  }
  if (bytes.length >= 24 && text(4, 4) === "ftyp") {
    const brandSize = view.getUint32(0);
    if (brandSize < 16 || brandSize > 256 || brandSize > bytes.length || brandSize % 4) throw new Error("This photo format could not be read.");
    const brands = [text(8, 4)];
    for (let i = 16; i < brandSize; i += 4) brands.push(text(i, 4));
    if (brands.some(brand => ["msf1","hevc","hevx","avis"].includes(brand))) throw new Error("Choose a still photo rather than a photo sequence.");
    const format = brands.includes("avif") ? "avif" : brands.some(brand => ["heic","heix","mif1"].includes(brand)) ? "heic" : null;
    if (!format) throw new Error("This photo format could not be read.");
    const dimensions: { width: number; height: number }[] = [];
    let boxes = 0;
    const walk = (start: number, end: number, depth: number) => {
      if (depth > 6) throw new Error("This photo format could not be read.");
      for (let i = start; i < end;) {
        if (i + 8 > end || ++boxes > 2048) throw new Error("This photo format could not be read.");
        let size = view.getUint32(i); const kind = text(i + 4, 4); let header = 8;
        if (size === 1) { if (i + 16 > end) throw new Error("Invalid photo box."); const big = view.getBigUint64(i + 8); if (big > BigInt(bytes.length)) throw new Error("Invalid photo box."); size = Number(big); header = 16; }
        if (size === 0) size = end - i;
        if (size < header || i + size > end) throw new Error("Invalid photo box.");
        if (kind === "ispe" && size >= header + 12) dimensions.push({ width: view.getUint32(i + header + 4), height: view.getUint32(i + header + 8) });
        if (["meta","iprp","ipco"].includes(kind)) walk(i + header + (kind === "meta" ? 4 : 0), i + size, depth + 1);
        i += size;
      }
    };
    walk(0, bytes.length, 0);
    if (!dimensions.length) throw new Error("This photo format could not be read.");
    dimensions.forEach(d => requirePhotoDimensions(d.width, d.height));
    const largest = dimensions.reduce((a,b) => a.width * a.height >= b.width * b.height ? a : b);
    return result(format, largest.width, largest.height);
  }
  throw new Error("We couldn’t process this photo. Tap to replace it.");
}
