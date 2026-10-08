"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { call, storage } from "@admin/lib/firebase";
import {
  CATEGORY_IDS,
  SECTION_TYPES,
  newContent,
  malaysiaInput,
  malaysiaTimestamp,
  type Content,
  type EditorialKind,
  type EditorialRecord,
  type Homepage,
  type Section,
  type Campaign,
  type CategoryConfig,
} from "@contracts/editorial-domain";
import {
  currentHomepage,
  type PublicHomepage,
} from "@contracts/homepage-projection";
const labels: Record<EditorialKind, string> = {
  campaigns: "Campaigns",
  banners: "Banners",
  homepage: "Homepage",
  collections: "Collections",
  announcements: "Announcements",
  categories: "Categories",
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Could not complete this action. Try again.";
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })
    : "Not set";
export function ContentList({ kind }: { kind: EditorialKind }) {
  const [rows, setRows] = useState<EditorialRecord[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  async function load(next?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await call<{
        records: EditorialRecord[];
        nextCursor: string | null;
      }>("getAdminEditorialPage", { kind, ...(next ? { cursor: next } : {}) });
      setRows(result.records);
      setCursor(result.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    call<{ records: EditorialRecord[]; nextCursor: string | null }>(
      "getAdminEditorialPage",
      { kind },
    )
      .then((result) => {
        if (active) {
          setRows(result.records);
          setCursor(result.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [kind]);
  return (
    <>
      <p className="eyebrow">Content</p>
      <h1>{labels[kind]}</h1>
      <p className="muted">
        Editorial content is separate from paid seller promotions. Saves do not
        publish homepage changes.
      </p>
      <div className="toolbar">
        <Link href={`/content/${kind}/new`}>
          + Create {kind === "banners" ? "banner" : kind.slice(0, -1)}
        </Link>
        <button onClick={() => void load()}>Refresh</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>State</th>
              <th>Version</th>
              <th>Updated · Malaysia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/content/${kind}/${row.id}`}>
                    {row.content.title}
                  </Link>
                  <small>{row.id}</small>
                </td>
                <td>
                  <span className="badge">
                    {row.effectiveState ??
                      ("enabled" in row.content
                        ? row.content.enabled
                          ? "Enabled"
                          : "Disabled"
                        : "active" in row.content
                          ? row.content.active
                            ? "Active"
                            : "Inactive"
                          : "Draft")}
                  </span>
                </td>
                <td>{row.version}</td>
                <td>{date(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {busy && <p role="status">Loading…</p>}
        {!busy && !rows.length && (
          <p>No {labels[kind].toLowerCase()} yet. Create the first draft.</p>
        )}
      </div>
      {cursor && <button onClick={() => void load(cursor)}>Next page</button>}
    </>
  );
}
type PickerRow = Record<string, unknown> & { id: string };
export function ReferencePicker({
  type,
  values,
  onChange,
}: {
  type: "productIds" | "sellerIds";
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [recordId, setRecordId] = useState(""),
    [sellerId, setSellerId] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [rows, setRows] = useState<PickerRow[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function find(next?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await call<{
        rows: PickerRow[];
        nextCursor: string | null;
      }>("getAdminPage", {
        section: type === "productIds" ? "listings" : "users",
        featureEligibleOnly: true,
        search,
        ...(recordId ? { recordId } : {}),
        ...(sellerId ? { sellerId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(type === "productIds" ? { status: "active" } : {}),
        ...(next ? { cursor: next } : {}),
      });
      setRows(result.rows);
      setCursor(result.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label>
        {type === "productIds" ? "Featured products" : "Featured sellers"}{" "}
        <small>(up to 12; server checks eligibility)</small>
      </label>
      <div className="reference-list">
        {values.map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((v) => v !== value))}
          >
            {value} ×
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setOpen((v) => !v)}>
        {open
          ? "Close picker"
          : "Select " + (type === "productIds" ? "products" : "sellers")}
      </button>
      {open && (
        <div className="picker">
          <div className="grid">
            <label>
              {type === "productIds" ? "Title search" : "Public name prefix"}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Exact ID
              <input
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
              />
            </label>
            {type === "productIds" && (
              <>
                <label>
                  Seller ID
                  <input
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {CATEGORY_IDS.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <button type="button" disabled={busy} onClick={() => void find()}>
            Search
          </button>
          <p className="muted">
            Bounded results; use Next to continue. Selection is revalidated
            before saving and publishing.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="picker-results">
            {rows.map((row) => (
              <div className="picker-row" key={row.id}>
                {typeof row.imageUrl === "string" && row.imageUrl && (
                  <img alt="" src={row.imageUrl} />
                )}
                <span>
                  <strong>{String(row.title ?? row.displayName)}</strong>
                  <small>
                    {" "}
                    · {row.id} · {String(row.status ?? row.accountState)}
                    {row.price ? ` · RM ${row.price}` : ""}
                    {row.sellerId ? ` · Seller ${row.sellerId}` : ""}
                  </small>
                </span>
                <button
                  type="button"
                  disabled={
                    values.includes(row.id) ||
                    values.length >= 12 ||
                    row.status === "draft" ||
                    row.status === "removed" ||
                    row.accountState === "removed" ||
                    row.accountState === "disabled"
                  }
                  onClick={() => onChange([...values, row.id])}
                >
                  Select
                </button>
              </div>
            ))}
          </div>
          {cursor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void find(cursor)}
            >
              Next results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function CategoryPicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend>Featured categories</legend>
      {CATEGORY_IDS.map((v) => (
        <label className="check" key={v}>
          <input
            type="checkbox"
            checked={values.includes(v)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...values, v]
                  : values.filter((id) => id !== v),
              )
            }
          />
          {v}
        </label>
      ))}
    </fieldset>
  );
}
function References({
  content,
  change,
}: {
  content: Record<string, unknown>;
  change: (key: string, value: unknown) => void;
}) {
  return (
    <>
      {["productIds", "sellerIds"].map((key) =>
        key in content ? (
          <ReferencePicker
            key={key}
            type={key as "productIds" | "sellerIds"}
            values={content[key] as string[]}
            onChange={(value) => change(key, value)}
          />
        ) : null,
      )}
      {"categoryIds" in content && (
        <CategoryPicker
          values={content.categoryIds as string[]}
          onChange={(v) => change("categoryIds", v)}
        />
      )}
      {"bannerIds" in content && (
        <label>
          Banner references <small>(comma separated IDs)</small>
          <input
            value={(content.bannerIds as string[]).join(", ")}
            onChange={(e) =>
              change(
                "bannerIds",
                e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
      )}
    </>
  );
}
async function normalizeAsset(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error(
      "Choose a JPEG, PNG or WebP up to 8 MB. It will be normalized to PNG.",
    );
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(
      1,
      2560 / bitmap.width,
      2560 / bitmap.height,
      Math.sqrt(4000000 / (bitmap.width * bitmap.height)),
    );
    if (!Number.isFinite(scale)) scale = 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
        "Use an image at least 320 × 120, whose normalized PNG fits within 2 MB.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
function AssetUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [url, setUrl] = useState("");
  const preview = useRef("");
  useEffect(
    () => () => {
      if (preview.current) URL.revokeObjectURL(preview.current);
    },
    [],
  );
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (!storage) throw new Error("Storage unavailable.");
      const blob = await normalizeAsset(file),
        permit = await call<{ assetId: string; path: string }>(
          "requestAdminAssetPermit",
          { sizeBytes: blob.size, contentType: blob.type },
        );
      await uploadBytes(ref(storage, permit.path), blob, {
        contentType: "image/png",
      });
      await call("finalizeAdminAsset", { assetId: permit.assetId });
      const bytes = await getBytes(ref(storage, permit.path), 2 * 1024 * 1024);
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = URL.createObjectURL(
        new Blob([bytes], { type: "image/png" }),
      );
      setUrl(preview.current);
      onChange(permit.assetId);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label>
        Asset ID
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <label>
        Upload asset{" "}
        <small>
          PNG / JPEG / WebP; 2 MB after normalization. Create-only; no
          overwrites.
        </small>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      {busy && <p role="status">Uploading and validating…</p>}
      {error && <p role="alert">{error}</p>}
      {url && (
        <img className="asset-preview" src={url} alt="Uploaded asset preview" />
      )}
      <small>
        Aspect ratios: desktop 1.8–4, mobile 0.65–1.6, strip 3–12, secondary
        card 0.8–2.
      </small>
    </div>
  );
}
function Fields({
  content,
  change,
}: {
  content: Record<string, unknown>;
  change: (key: string, value: unknown) => void;
}) {
  const fields = Object.entries(content).filter(
    ([key]) =>
      ![
        "sections",
        "categories",
        "productIds",
        "sellerIds",
        "categoryIds",
        "bannerIds",
        "placements",
        "lifecycleStatus",
        "assetId",
        "sectionId",
      ].includes(key),
  );
  const names: Record<string, string> = {
    internalDescription: "Internal description",
    ctaLabel: "CTA label",
    destination: "CTA destination",
    campaignId: "Campaign reference",
    collectionId: "Collection reference",
    announcementId: "Announcement reference",
    startAt: "Start · Malaysia (UTC+08:00)",
    endAt: "End · Malaysia (UTC+08:00)",
  };
  return (
    <>
      <div className="grid">
        {fields.map(([key, value]) => {
          const label =
            names[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
          if (typeof value === "boolean")
            return (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => change(key, e.target.checked)}
                />
                {label}
              </label>
            );
          if (key === "startAt" || key === "endAt")
            return (
              <label key={key}>
                {label}
                <input
                  type="datetime-local"
                  value={malaysiaInput(value as string | null)}
                  onChange={(e) => {
                    try {
                      change(key, malaysiaTimestamp(e.target.value));
                    } catch {
                      /* HTML input may emit an incomplete value. */
                    }
                  }}
                />
              </label>
            );
          if (typeof value === "number")
            return (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={value}
                  onChange={(e) => change(key, Number(e.target.value))}
                />
              </label>
            );
          const options =
            key === "placement"
              ? ["desktop_hero", "mobile_hero", "promo_strip", "secondary_card"]
              : key === "source"
                ? ["AUTOMATIC", "MANUAL", "CAMPAIGN"]
                : key === "type"
                  ? SECTION_TYPES
                  : null;
          if (options)
            return (
              <label key={key}>
                {label}
                <select
                  value={String(value)}
                  onChange={(e) => change(key, e.target.value)}
                >
                  {options.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            );
          if (key === "internalDescription" || key === "description")
            return (
              <label key={key}>
                {label}
                <textarea
                  rows={3}
                  maxLength={key === "internalDescription" ? 1000 : 500}
                  value={String(value ?? "")}
                  onChange={(e) => change(key, e.target.value)}
                />
              </label>
            );
          return (
            <label key={key}>
              {label}
              <input
                value={String(value ?? "")}
                maxLength={key === "destination" ? 512 : 180}
                onChange={(e) =>
                  change(
                    key,
                    e.target.value ||
                      ([
                        "campaignId",
                        "collectionId",
                        "announcementId",
                      ].includes(key)
                        ? null
                        : ""),
                  )
                }
              />
            </label>
          );
        })}
      </div>
      {"assetId" in content && (
        <AssetUpload
          value={String(content.assetId ?? "")}
          onChange={(v) => change("assetId", v)}
        />
      )}
      {"placements" in content && (
        <fieldset>
          <legend>Campaign placements</legend>
          {SECTION_TYPES.map((v) => (
            <label className="check" key={v}>
              <input
                type="checkbox"
                checked={(content.placements as string[]).includes(v)}
                onChange={(e) =>
                  change(
                    "placements",
                    e.target.checked
                      ? [...(content.placements as string[]), v]
                      : (content.placements as string[]).filter((x) => x !== v),
                  )
                }
              />
              {v}
            </label>
          ))}
        </fieldset>
      )}
      <References content={content} change={change} />
    </>
  );
}
function AdminAssetImage({ url, alt }: { url: string; alt: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true,
      objectUrl = "";
    if (storage)
      void getBytes(ref(storage, url), 2 * 1024 * 1024)
        .then((bytes) => {
          objectUrl = URL.createObjectURL(
            new Blob([bytes], { type: "image/png" }),
          );
          if (active) setSource(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return source ? (
    <img src={source} alt={alt} />
  ) : (
    <p className="muted">Asset preview loading…</p>
  );
}
export function HomepagePreview({
  projection,
  serverTime,
  disabledTitles = [],
}: {
  projection: PublicHomepage;
  serverTime: string;
  disabledTitles?: string[];
}) {
  const [mode, setMode] = useState("desktop");
  const current = currentHomepage(projection, Date.parse(serverTime));
  return (
    <section aria-label="Homepage preview">
      <div className="toolbar">
        <h2>Preview</h2>
        <button
          type="button"
          aria-pressed={mode === "desktop"}
          onClick={() => setMode("desktop")}
        >
          Desktop
        </button>
        <button
          type="button"
          aria-pressed={mode === "mobile"}
          onClick={() => setMode("mobile")}
        >
          Mobile
        </button>
      </div>
      <p className="muted">
        Server time: {date(serverTime)}. Preview does not publish.
      </p>
      {disabledTitles.length > 0 && (
        <p className="muted">
          Disabled (not published): {disabledTitles.join(" · ")}
        </p>
      )}
      <div className={`preview ${mode}`}>
        {projection.sections.map((s) => (
          <div className="preview-section" key={s.sectionId}>
            <span className="badge">
              {current?.sections.some((v) => v.sectionId === s.sectionId)
                ? "Active now"
                : "Scheduled / ended"}{" "}
              · {s.source}
            </span>
            <h3>{s.title}</h3>
            {s.banners
              .filter((b) =>
                mode === "mobile"
                  ? b.placement !== "desktop_hero" ||
                    !s.banners.some((v) => v.placement === "mobile_hero")
                  : b.placement !== "mobile_hero" ||
                    !s.banners.some((v) => v.placement === "desktop_hero"),
              )
              .map((b, i) => (
                <div key={i}>
                  <AdminAssetImage url={b.url} alt={b.alt} />
                  <p>
                    {b.ctaLabel} → {b.destination}
                  </p>
                </div>
              ))}
            {s.products.map((v) => (
              <p key={v.id}>
                {v.title} · RM {v.price} · {v.id}
              </p>
            ))}
            {s.sellers.map((v) => (
              <p key={v.id}>{v.displayName}</p>
            ))}
            {s.categories.length > 0 && <p>{s.categories.join(" · ")}</p>}
            {s.cta && (
              <p>
                {s.cta.label} → {s.cta.destination}
              </p>
            )}
            {s.announcement && <p>{s.announcement.title}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
export function ContentEditor({
  kind,
  recordId,
}: {
  kind: EditorialKind;
  recordId: string;
}) {
  const router = useRouter(),
    [content, setContent] = useState<Content>(() => newContent(kind)),
    [revision, setRevision] = useState(0),
    [liveVersion, setLiveVersion] = useState(0),
    [loading, setLoading] = useState(recordId !== "new"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState<{
      projection: PublicHomepage;
      serverTime: string;
    } | null>(null),
    [dirty, setDirty] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    confirmation = useRef<HTMLButtonElement>(null);
  async function reload() {
    setLoading(true);
    setError("");
    try {
      const result = await call<{
        record: EditorialRecord | null;
        liveVersion: number;
      }>("getAdminEditorialRecord", { kind, id: recordId });
      setContent(result.record?.content ?? newContent(kind));
      setRevision(result.record?.version ?? 0);
      setLiveVersion(result.liveVersion);
      setDirty(false);
      setPreview(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (recordId === "new") return;
    let active = true;
    call<{ record: EditorialRecord | null; liveVersion: number }>(
      "getAdminEditorialRecord",
      { kind, id: recordId },
    )
      .then((result) => {
        if (active) {
          setContent(result.record?.content ?? newContent(kind));
          setRevision(result.record?.version ?? 0);
          setLiveVersion(result.liveVersion);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, recordId]);
  function change(key: string, value: unknown) {
    setContent((c) => ({ ...c, [key]: value }));
    setDirty(true);
    setPreview(null);
  }
  async function save(action = "save") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const target = recordId === "new" ? crypto.randomUUID() : recordId;
      const payload =
        kind === "campaigns"
          ? {
              ...content,
              lifecycleStatus:
                action === "save"
                  ? "DRAFT"
                  : (content as Campaign).lifecycleStatus,
            }
          : content;
      const result = await call<{ id: string; version: number }>(
        "mutateAdminEditorial",
        {
          kind,
          id: target,
          action,
          content: payload,
          expectedVersion: revision,
        },
      );
      setRevision(result.version);
      setDirty(false);
      setPreview(null);
      setNotice(
        action === "save"
          ? "Draft saved. Public homepage is unchanged."
          : "Campaign action saved. Publish the homepage to apply its updated placements.",
      );
      if (result.id !== recordId)
        router.replace(`/content/${kind}/${result.id}`);
      else await reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function previewDraft() {
    setBusy(true);
    setError("");
    try {
      setPreview(await call("previewAdminHomepage", { content }));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (busy || dirty || !preview) return;
    dialog.current?.close();
    setBusy(true);
    setError("");
    try {
      const result = await call<{ liveVersion: number }>(
        "publishAdminHomepage",
        { expectedVersion: revision, expectedLiveVersion: liveVersion },
      );
      setLiveVersion(result.liveVersion);
      setNotice(`Homepage published as live version ${result.liveVersion}.`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading record…</p>;
  return (
    <>
      <p className="eyebrow">Content · {labels[kind]}</p>
      <h1>
        {recordId === "new" ? "New draft" : content.title || labels[kind]}
      </h1>
      <p className="muted">
        Version {revision}{" "}
        {kind === "homepage" && `· Live version ${liveVersion}`} · Times are
        Asia/Kuala_Lumpur. Public changes require explicit homepage publication.
      </p>
      <div className="toolbar">
        {!["homepage", "categories"].includes(kind) && (
          <Link href={`/content/${kind}`}>
            ← All {labels[kind].toLowerCase()}
          </Link>
        )}
        <button disabled={busy} onClick={() => void save()}>
          Save draft
        </button>
        <button
          disabled={busy || recordId === "new"}
          onClick={() => void reload()}
        >
          Reload latest
        </button>
        {kind === "campaigns" && (
          <>
            <button
              disabled={busy || !revision}
              onClick={() => void save("schedule")}
            >
              Schedule
            </button>
            <button
              className="primary"
              disabled={busy || !revision}
              onClick={() => void save("publish")}
            >
              Publish immediately
            </button>
            <button
              disabled={busy || !revision}
              onClick={() => void save("end")}
            >
              End campaign
            </button>
            <button
              disabled={busy || !revision}
              onClick={() => void save("duplicate")}
            >
              Duplicate
            </button>
          </>
        )}
        {kind === "homepage" && (
          <>
            <button disabled={busy} onClick={() => void previewDraft()}>
              Preview
            </button>
            <button
              className="primary"
              disabled={busy || dirty || !revision || !preview}
              onClick={() => {
                dialog.current?.showModal();
                confirmation.current?.focus();
              }}
            >
              Publish homepage
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert">
          {error} Use “Reload latest” if another admin changed this record.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {dirty && (
        <p className="muted">Unsaved changes · save before publishing.</p>
      )}
      <div className="panel">
        <Fields
          content={content as unknown as Record<string, unknown>}
          change={change}
        />
        {kind === "homepage" && (
          <>
            {(content as Homepage).sections.map((section, index) => (
              <div className="section-editor" key={section.sectionId}>
                <div className="section-head">
                  <strong>
                    {index + 1}. {section.title}
                  </strong>
                  <span className="badge">
                    {section.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <button
                    aria-label={`Move ${section.title} up`}
                    disabled={index === 0}
                    onClick={() => {
                      const sections = [...(content as Homepage).sections];
                      [sections[index - 1], sections[index]] = [
                        sections[index],
                        sections[index - 1],
                      ];
                      change(
                        "sections",
                        sections.map((s, order) => ({ ...s, order })),
                      );
                    }}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${section.title} down`}
                    disabled={
                      index === (content as Homepage).sections.length - 1
                    }
                    onClick={() => {
                      const sections = [...(content as Homepage).sections];
                      [sections[index + 1], sections[index]] = [
                        sections[index],
                        sections[index + 1],
                      ];
                      change(
                        "sections",
                        sections.map((s, order) => ({ ...s, order })),
                      );
                    }}
                  >
                    ↓
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      change(
                        "sections",
                        (content as Homepage).sections.filter(
                          (s) => s.sectionId !== section.sectionId,
                        ),
                      )
                    }
                  >
                    Remove section
                  </button>
                </div>
                <Fields
                  content={section as unknown as Record<string, unknown>}
                  change={(key, value) =>
                    change(
                      "sections",
                      (content as Homepage).sections.map((s) =>
                        s.sectionId === section.sectionId
                          ? { ...s, [key]: value }
                          : s,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <button
              disabled={(content as Homepage).sections.length >= 16}
              onClick={() => {
                const section: Section = {
                  sectionId: crypto.randomUUID(),
                  type: "products",
                  title: "Featured products",
                  enabled: true,
                  order: (content as Homepage).sections.length,
                  source: "MANUAL",
                  productIds: [],
                  sellerIds: [],
                  categoryIds: [],
                  bannerIds: [],
                  campaignId: null,
                  collectionId: null,
                  announcementId: null,
                  startAt: null,
                  endAt: null,
                };
                change("sections", [
                  ...(content as Homepage).sections,
                  section,
                ]);
              }}
            >
              + Add section
            </button>
          </>
        )}
        {kind === "categories" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Visible on Home</th>
                  <th>Order</th>
                  <th>Featured</th>
                </tr>
              </thead>
              <tbody>
                {(content as CategoryConfig).categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.id}</td>
                    {["visible", "order", "featured"].map((key) => (
                      <td key={key}>
                        <input
                          aria-label={`${category.id} ${key}`}
                          type={key === "order" ? "number" : "checkbox"}
                          min="0"
                          max="999"
                          checked={
                            key === "order"
                              ? undefined
                              : category[key as "visible" | "featured"]
                          }
                          value={key === "order" ? category.order : undefined}
                          onChange={(e) =>
                            change(
                              "categories",
                              (content as CategoryConfig).categories.map((c) =>
                                c.id === category.id
                                  ? {
                                      ...c,
                                      [key]:
                                        key === "order"
                                          ? Number(e.target.value)
                                          : e.target.checked,
                                    }
                                  : c,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              Visibility affects the published Home category module, not the
              marketplace taxonomy. No categories are deleted.
            </p>
          </div>
        )}
      </div>
      {preview && (
        <HomepagePreview
          {...preview}
          disabledTitles={
            kind === "homepage"
              ? (content as Homepage).sections
                  .filter((v) => !v.enabled)
                  .map((v) => v.title)
              : []
          }
        />
      )}
      <dialog ref={dialog} aria-labelledby="publish-title">
        <h2 id="publish-title">Publish this homepage?</h2>
        <p>
          The saved draft and scheduled placements become the public
          configuration. Confirm you reviewed the preview.
        </p>
        <div className="toolbar">
          <button ref={confirmation} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void publish()}
          >
            Confirm publish
          </button>
        </div>
      </dialog>
    </>
  );
}
