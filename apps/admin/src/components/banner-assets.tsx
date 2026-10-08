"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { call, storage } from "@admin/lib/firebase";
export type Artwork = {
  id: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  filename?: string;
};
export function ArtworkImage({
  artwork,
  alt,
}: {
  artwork?: Artwork | null;
  alt: string;
}) {
  const [source, setSource] = useState<{ url: string; value: string } | null>(
    null,
  );
  const url = artwork?.url;
  useEffect(() => {
    let active = true,
      objectUrl = "";
    if (url && storage)
      void getBytes(ref(storage, url), 2 * 1024 * 1024)
        .then((bytes) => {
          objectUrl = URL.createObjectURL(
            new Blob([bytes], { type: "image/png" }),
          );
          if (active) setSource({ url, value: objectUrl });
          else URL.revokeObjectURL(objectUrl);
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return source && source.url === artwork?.url ? (
    <img src={source.value} alt={alt} />
  ) : (
    <span className="artwork-placeholder">
      {artwork ? "Loading artwork…" : "Add your artwork"}
    </span>
  );
}
async function normalize(file: File, mobile: boolean) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP under 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = bitmap.width / bitmap.height;
    if (mobile ? ratio < 0.65 || ratio > 1.6 : ratio < 1.8 || ratio > 4)
      throw new Error(
        mobile
          ? "Choose mobile artwork close to square, such as 900 × 1000."
          : "Choose wide desktop artwork, such as 1920 × 768.",
      );
    const scale = Math.min(
      1,
      1920 / bitmap.width,
      1920 / bitmap.height,
      Math.sqrt(4000000 / (bitmap.width * bitmap.height)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // The existing server validates complete PNG bytes. Do not silently switch MIME/path.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (
      !blob ||
      blob.size > 2 * 1024 * 1024 ||
      canvas.width < 320 ||
      canvas.height < 120
    )
      throw new Error(
        "This artwork is too large after processing. Export a smaller image; the upload limit is 2 MB.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
export function BannerUpload({
  label,
  mobile,
  artwork,
  onChange,
  onBusy,
}: {
  label: string;
  mobile: boolean;
  artwork?: Artwork | null;
  onChange: (value: Artwork | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (!storage) throw new Error("Uploads are unavailable. Try again.");
      const blob = await normalize(file, mobile),
        permit = await call<{ assetId: string; path: string }>(
          "requestAdminAssetPermit",
          { sizeBytes: blob.size, contentType: "image/png" },
        );
      await uploadBytes(ref(storage, permit.path), blob, {
        contentType: "image/png",
      });
      const result = await call<Artwork & { assetId: string }>(
        "finalizeAdminAsset",
        { assetId: permit.assetId },
      );
      onChange({
        ...result,
        id: result.assetId,
        sizeBytes: blob.size,
        filename: file.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="banner-upload" aria-label={label}>
      <h2>{label}</h2>
      <p className="muted">
        {mobile ? "Recommended 900 × 1000 px" : "Recommended 1920 × 768 px"} ·
        JPEG, PNG or WebP
      </p>
      <div className={mobile ? "artwork mobile" : "artwork"}>
        <ArtworkImage artwork={artwork} alt={label + " preview"} />
      </div>
      <input
        className="visually-hidden"
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`Choose ${label.toLowerCase()}`}
        disabled={busy}
        onChange={(e) => {
          if (e.target.files?.[0]) void upload(e.target.files[0]);
        }}
      />
      {artwork && (
        <p className="artwork-caption">
          <strong>{artwork.filename ?? label}</strong>
          <span>
            {artwork.width} × {artwork.height} ·{" "}
            {(artwork.sizeBytes / 1024).toFixed(0)} KB
          </span>
        </p>
      )}
      <div className="toolbar">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy
            ? "Uploading…"
            : artwork
              ? "Replace"
              : `Upload ${label.toLowerCase()}`}
        </button>
        {artwork && (
          <button type="button" disabled={busy} onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
