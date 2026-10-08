"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@admin/lib/firebase";
import {
  newContent,
  bannerState,
  malaysiaInput,
  malaysiaTimestamp,
  type Banner,
  type EditorialRecord,
  type Homepage,
  type Section,
} from "@contracts/editorial-domain";
import type { PublicHomepage } from "@contracts/homepage-projection";
import { HomepagePreview } from "./editorial";
import { ArtworkImage, BannerUpload, type Artwork } from "./banner-assets";
import { SectionChoice } from "./section-choices";
import { DestinationPicker } from "./destination-picker";
import {
  destinationLabel,
  readyBanner,
  scheduleLabel,
} from "@admin/lib/banner-workflow";
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Could not save your changes. Try again.";
export function HomepageTabs({
  selected,
}: {
  selected: "banners" | "sections" | "announcements";
}) {
  return (
    <>
      <p className="eyebrow">Homepage</p>
      <nav className="homepage-tabs" aria-label="Homepage workspace">
        <Link
          href="/homepage"
          aria-current={selected === "banners" ? "page" : undefined}
        >
          Banners
        </Link>
        <Link
          href="/content/homepage/current"
          aria-current={selected === "sections" ? "page" : undefined}
        >
          Homepage Sections
        </Link>
        <Link
          href="/content/announcements"
          aria-current={selected === "announcements" ? "page" : undefined}
        >
          Announcements
        </Link>
      </nav>
    </>
  );
}
type Loaded = {
  record: EditorialRecord | null;
  liveVersion: number;
  homepageVersion: number;
  assets?: (Artwork | null)[];
};
export function BannerList() {
  const [rows, setRows] = useState<EditorialRecord[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    router = useRouter();
  async function load(next?: string) {
    setLoading(true);
    setError("");
    try {
      const result = await call<{
        records: EditorialRecord[];
        nextCursor: string | null;
      }>("getAdminEditorialPage", {
        kind: "banners",
        ...(next ? { cursor: next } : {}),
      });
      setRows(result.records);
      setCursor(result.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void call<{ records: EditorialRecord[]; nextCursor: string | null }>(
      "getAdminEditorialPage",
      { kind: "banners" },
    )
      .then((r) => {
        if (active) {
          setRows(r.records);
          setCursor(r.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(row: EditorialRecord, action: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(row.id);
    setError("");
    setNotice("");
    try {
      const latest = await call<Loaded>("getAdminEditorialRecord", {
        kind: "banners",
        id: row.id,
      });
      // Never silently overwrite a stale list. The server checks all three versions again.
      if (latest.record?.version !== row.version)
        throw new Error(
          "This banner changed. Refresh the list before continuing.",
        );
      const result = await call<{ id: string }>("mutateAdminEditorial", {
        kind: "banners",
        id: row.id,
        expectedVersion: row.version,
        expectedHomepageVersion: latest.homepageVersion,
        expectedLiveVersion: latest.liveVersion,
        action,
        content: row.content,
      });
      if (action === "duplicate") router.push(`/content/banners/${result.id}`);
      else {
        setNotice(action === "pause" ? "Banner paused" : "Banner activated");
        await load();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  return (
    <>
      <HomepageTabs selected="banners" />
      <div className="page-heading">
        <div>
          <h1>Banners</h1>
          <p className="muted">Plan what shoppers see next.</p>
        </div>
        <Link className="button-link primary" href="/content/banners/new">
          + New Banner
        </Link>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {loading && <p role="status">Loading banners…</p>}
      {!loading && !rows.length && (
        <div className="empty-editorial">
          <h2>Your next highlight starts here</h2>
          <p>
            Add desktop and mobile artwork, then choose where it takes shoppers.
          </p>
          <Link className="button-link" href="/content/banners/new">
            Create a banner
          </Link>
        </div>
      )}
      <div className="banner-list">
        {rows.map((row) => {
          const b = row.content as Banner,
            state = bannerState(b, Date.now());
          return (
            <article className="banner-row" key={row.id}>
              <div>
                <span className={`state-badge ${state.toLowerCase()}`}>
                  {state}
                </span>
                <h2>{b.title}</h2>
                <p>
                  {scheduleLabel(b.startAt, b.endAt)}{" "}
                  <small>Malaysia time</small>
                </p>
                <p className="muted">
                  Destination: {destinationLabel(b.destination)}
                </p>
              </div>
              <div className="banner-actions">
                <Link
                  className="button-link"
                  href={`/content/banners/${row.id}`}
                >
                  {state === "SCHEDULED" ? "Edit schedule" : "Edit"}
                </Link>
                {state === "LIVE" ? (
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => void action(row, "pause")}
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => void action(row, "activate")}
                  >
                    {state === "SCHEDULED"
                      ? "Activate now"
                      : state === "ENDED"
                        ? "Reactivate"
                        : "Activate"}
                  </button>
                )}
                {state === "SCHEDULED" && (
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => void action(row, "pause")}
                  >
                    Cancel schedule
                  </button>
                )}
                <button
                  disabled={Boolean(busy)}
                  onClick={() => void action(row, "duplicate")}
                >
                  Duplicate
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="toolbar">
        <button disabled={loading || Boolean(busy)} onClick={() => void load()}>
          Refresh
        </button>
        {cursor && (
          <button
            disabled={loading || Boolean(busy)}
            onClick={() => void load(cursor)}
          >
            More banners
          </button>
        )}
      </div>
    </>
  );
}
export function BannerEditor({ recordId }: { recordId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [content, setContent] = useState<Banner>(() => ({
      ...(newContent("banners") as Banner),
      mobileAssetId: null,
      startAt: null,
      endAt: null,
    })),
    [artworks, setArtworks] = useState<(Artwork | null)[]>([null, null]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState([false, false]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [mode, setMode] = useState<"now" | "schedule">("now"),
    [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const lock = useRef(false),
    target = useRef(recordId === "new" ? "" : recordId);
  useEffect(() => {
    let active = true;
    void call<Loaded>("getAdminEditorialRecord", {
      kind: "banners",
      id: recordId,
    })
      .then((r) => {
        if (!active) return;
        setLoaded(r);
        if (r.record) {
          const b = r.record.content as Banner;
          setContent(b);
          setMode(
            b.startAt && Date.parse(b.startAt) > Date.now()
              ? "schedule"
              : "now",
          );
          setArtworks([
            r.assets?.find((a) => a?.id === b.assetId) ?? null,
            r.assets?.find((a) => a?.id === b.mobileAssetId) ?? null,
          ]);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [recordId]);
  const paired = recordId === "new" || "mobileAssetId" in content;
  async function save(action: "save" | "schedule" | "publish") {
    if (lock.current || uploading.some(Boolean) || !loaded) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = readyBanner(content, paired);
      if (!target.current) target.current = crypto.randomUUID();
      const result = await call<{
        id: string;
        version: number;
        liveVersion?: number;
        homepageVersion?: number;
      }>("mutateAdminEditorial", {
        kind: "banners",
        id: target.current,
        content: payload,
        action,
        expectedVersion: loaded.record?.version ?? 0,
        expectedLiveVersion: loaded.liveVersion,
        expectedHomepageVersion: loaded.homepageVersion,
      });
      setLoaded({
        ...loaded,
        record: {
          ...(loaded.record ?? {
            kind: "banners",
            createdAt: "",
            updatedAt: "",
            createdBy: "",
            updatedBy: "",
          }),
          id: result.id,
          version: result.version,
          content:
            action === "publish"
              ? {
                  ...payload,
                  enabled: true,
                  startAt: new Date().toISOString(),
                  endAt:
                    payload.endAt && Date.parse(payload.endAt) > Date.now()
                      ? payload.endAt
                      : null,
                }
              : action === "schedule"
                ? { ...payload, enabled: true }
                : payload,
        },
        liveVersion: result.liveVersion ?? loaded.liveVersion,
        homepageVersion: result.homepageVersion ?? loaded.homepageVersion,
      });
      if (action !== "save")
        setContent((old) => ({
          ...old,
          enabled: true,
          ...(action === "publish"
            ? {
                startAt: new Date().toISOString(),
                endAt:
                  old.endAt && Date.parse(old.endAt) > Date.now()
                    ? old.endAt
                    : null,
              }
            : {}),
        }));
      if(recordId === "new") window.history.replaceState(null,"",`/content/banners/${result.id}`);
      setNotice(
        action === "save"
          ? "Draft saved"
          : action === "schedule"
            ? `Banner scheduled: ${scheduleLabel(payload.startAt, payload.endAt)} · Malaysia time`
            : "Banner published",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading banner…</p>;
  return (
    <>
      <HomepageTabs selected="banners" />
      <Link className="back-link" href="/homepage">
        ← Back to Banners
      </Link>
      <div className="page-heading">
        <h1>
          {recordId === "new" && !loaded?.record ? "New Banner" : content.title || "Edit banner"}
        </h1>
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          {loaded && (
            <button type="button" onClick={() => window.location.reload()}>
              Reload latest
            </button>
          )}
        </p>
      )}
      {notice && (
        <div className="success" role="status">
          <strong>{notice}</strong>
          <div className="toolbar">
            <a
              href={
                process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "takeme-52b80"
                  ? "https://takeme.my"
                  : "https://takeme-web-preview.takeme-technologies.workers.dev"
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              View Homepage ↗
            </a>
            <Link href="/homepage">Back to Banners</Link>
          </div>
        </div>
      )}
      <div className="banner-editor">
        <div className="editor-fields">
          <section className="panel">
            <label>
              Banner name
              <input
                value={content.title}
                maxLength={100}
                placeholder="Electronics Week"
                onChange={(e) =>
                  setContent({ ...content, title: e.target.value })
                }
              />
            </label>
          </section>
          <div className="artwork-grid">
            <BannerUpload
              label={
                content.placement === "mobile_hero"
                  ? "Mobile banner"
                  : "Desktop banner"
              }
              mobile={content.placement === "mobile_hero"}
              artwork={artworks[0]}
              onChange={(a) => {
                setArtworks((old) => [a, old[1]]);
                setContent((old) => ({ ...old, assetId: a?.id ?? "" }));
              }}
              onBusy={(v) => setUploading((old) => [v, old[1]])}
            />
            {paired && (
              <BannerUpload
                label="Mobile banner"
                mobile
                artwork={artworks[1]}
                onChange={(a) => {
                  setArtworks((old) => [old[0], a]);
                  setContent((old) => ({
                    ...old,
                    mobileAssetId: a?.id ?? null,
                  }));
                }}
                onBusy={(v) => setUploading((old) => [old[0], v])}
              />
            )}
          </div>
          <section className="panel">
            <DestinationPicker
              value={content.destination}
              onChange={(destination) =>
                setContent((c) => ({ ...c, destination }))
              }
            />
          </section>
          <section className="panel">
            <h2>Schedule</h2>
            <p className="muted">Malaysia time · Asia/Kuala_Lumpur</p>
            <div className="segmented">
              <button
                type="button"
                aria-pressed={mode === "now"}
                onClick={() => setMode("now")}
              >
                Publish now
              </button>
              <button
                type="button"
                aria-pressed={mode === "schedule"}
                onClick={() => setMode("schedule")}
              >
                Schedule
              </button>
            </div>
            {mode === "schedule" && (
              <div className="grid">
                <label>
                  Starts
                  <input
                    type="datetime-local"
                    value={malaysiaInput(content.startAt ?? null)}
                    onInput={e => {try {const startAt=malaysiaTimestamp(e.currentTarget.value); setContent(old=>({...old,startAt}));}catch {setError("Choose a valid start time.");}}}
                    onChange={(e) => {
                      try {
                        const startAt = malaysiaTimestamp(e.target.value);
                        setContent(old => ({...old,startAt}));
                      } catch {
                        setError("Choose a valid start time.");
                      }
                    }}
                  />
                </label>
                <label>
                  Ends
                  <input
                    type="datetime-local"
                    value={malaysiaInput(content.endAt ?? null)}
                    onInput={e => {try {const endAt=malaysiaTimestamp(e.currentTarget.value); setContent(old=>({...old,endAt}));}catch {setError("Choose a valid end time.");}}}
                    onChange={(e) => {
                      try {
                        const endAt = malaysiaTimestamp(e.target.value);
                        setContent(old => ({...old,endAt}));
                      } catch {
                        setError("Choose a valid end time.");
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </section>
          <div className="toolbar editor-actions">
            <button
              className="primary"
              disabled={busy || uploading.some(Boolean) || !loaded}
              onClick={() =>
                void save(mode === "schedule" ? "schedule" : "publish")
              }
            >
              {busy
                ? "Saving…"
                : mode === "schedule"
                  ? "Schedule Banner"
                  : "Publish"}
            </button>
            <button
              disabled={busy || uploading.some(Boolean) || !loaded}
              onClick={() => void save("save")}
            >
              Save Draft
            </button>
          </div>
          <details className="advanced">
            <summary>Technical details</summary>
            <p>Artwork references and revisions are managed automatically.</p>
            <dl>
              <dt>Record</dt>
              <dd>{recordId}</dd>
              <dt>Placement</dt>
              <dd>{content.placement}</dd>
              <dt>Revision</dt>
              <dd>{loaded?.record?.version ?? 0}</dd>
            </dl>
          </details>
        </div>
        <aside className="banner-preview panel" aria-label="Banner preview">
          <div className="toolbar">
            <h2>Preview</h2>
            <button
              aria-pressed={previewMode === "desktop"}
              onClick={() => setPreviewMode("desktop")}
            >
              Desktop
            </button>
            <button
              aria-pressed={previewMode === "mobile"}
              onClick={() => setPreviewMode("mobile")}
            >
              Mobile
            </button>
          </div>
          <div
            className={`artwork ${previewMode === "mobile" ? "mobile" : ""}`}
          >
            <ArtworkImage
              artwork={artworks[previewMode === "mobile" && paired ? 1 : 0]}
              alt="Banner preview"
            />
          </div>
          <h3>{content.title || "Your banner"}</h3>
          <p>
            {destinationLabel(content.destination) || "Choose a destination"}{" "}
            <span aria-hidden="true">→</span>
          </p>
          <p className="muted">Preview only</p>
        </aside>
      </div>
    </>
  );
}
const SECTION_NAMES: Record<string, string> = {
  hero: "Hero Banner",
  fresh: "Fresh Drops",
  hot: "Popular finds",
  under20: "Under RM20",
  ending: "Ending Soon",
  trending: "Trending Sellers",
  near: "Near You",
  saved: "Saved picks",
  categories: "Categories",
  products: "Featured products",
  sellers: "Featured sellers",
  announcement: "Announcement",
};
export function HomepageSections() {
  const [content, setContent] = useState<Homepage>(
      () => newContent("homepage") as Homepage,
    ),
    [version, setVersion] = useState(0),
    [liveVersion, setLiveVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState<{
      projection: PublicHomepage;
      serverTime: string;
    } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false);
  useEffect(() => {
    let active = true;
    void call<Loaded>("getAdminEditorialRecord", {
      kind: "homepage",
      id: "current",
    })
      .then((r) => {
        if (active) {
          setContent(
            (r.record?.content as Homepage) ??
              (newContent("homepage") as Homepage),
          );
          setVersion(r.record?.version ?? 0);
          setLiveVersion(r.liveVersion);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function updateSection(id: string, patch: Partial<Section>) {
    change({
      ...content,
      sections: content.sections.map((s) =>
        s.sectionId === id ? { ...s, ...patch } : s,
      ),
    });
  }
  function addSection(type: Section["type"]) {
    const base = (newContent("homepage") as Homepage).sections[0];
    change({
      ...content,
      sections: [
        ...content.sections,
        {
          ...base,
          sectionId: crypto.randomUUID(),
          type,
          title: SECTION_NAMES[type],
          source: ["hero", "announcement", "products"].includes(type)
            ? "MANUAL"
            : "AUTOMATIC",
          order: content.sections.length,
        },
      ],
    });
  }
  function change(home: Homepage) {
    setContent(home);
    setDirty(true);
    setPreview(null);
    setNotice("");
  }
  function move(index: number, direction: number) {
    const sections = [...content.sections].sort((a, b) => a.order - b.order);
    [sections[index], sections[index + direction]] = [
      sections[index + direction],
      sections[index],
    ];
    change({
      ...content,
      sections: sections.map((s, order) => ({ ...s, order })),
    });
  }
  async function act(action: "save" | "preview" | "publish") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "save") {
        const r = await call<{ version: number }>("mutateAdminEditorial", {
          kind: "homepage",
          id: "current",
          content,
          expectedVersion: version,
        });
        setVersion(r.version);
        setDirty(false);
        setPreview(null);
        setNotice("Draft saved");
      } else if (action === "preview") {
        setPreview(await call("previewAdminHomepage", { content }));
      } else {
        dialog.current?.close();
        const r = await call<{ liveVersion: number }>("publishAdminHomepage", {
          expectedVersion: version,
          expectedLiveVersion: liveVersion,
        });
        setLiveVersion(r.liveVersion);
        setNotice("Homepage published");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading homepage…</p>;
  return (
    <>
      <HomepageTabs selected="sections" />
      <div className="page-heading">
        <div>
          <h1>Homepage Sections</h1>
          <p className="muted">
            Choose what appears and the order shoppers see it.
          </p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <div className="section-list">
        {[...content.sections]
          .sort((a, b) => a.order - b.order)
          .map((s, index) => (
            <article className="section-row" key={s.sectionId}>
              <div className="section-head">
                <h2>{SECTION_NAMES[s.type] ?? s.title}</h2>
                {s.title !== SECTION_NAMES[s.type] && <p className="muted">{s.title}</p>}
                <label className="check">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`${SECTION_NAMES[s.type] ?? s.title} visible`}
                    checked={s.enabled}
                    onChange={(e) =>
                      change({
                        ...content,
                        sections: content.sections.map((v) =>
                          v.sectionId === s.sectionId
                            ? { ...v, enabled: e.target.checked }
                            : v,
                        ),
                      })
                    }
                  />
                  {s.enabled ? "ON" : "OFF"}
                </label>
                <button
                  aria-label={`Move ${s.title} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  aria-label={`Move ${s.title} down`}
                  disabled={index === content.sections.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </div>
              <details>
                <summary>Edit</summary>
                <label>
                  Section title
                  <input
                    value={s.title}
                    maxLength={100}
                    onChange={(e) =>
                      change({
                        ...content,
                        sections: content.sections.map((v) =>
                          v.sectionId === s.sectionId
                            ? { ...v, title: e.target.value }
                            : v,
                        ),
                      })
                    }
                  />
                </label>
                <p className="muted">
                  {s.source === "AUTOMATIC"
                    ? "Products update automatically."
                    : s.source === "CAMPAIGN"
                      ? "Managed by an advanced campaign."
                      : "Selected marketplace content."}
                </p>
                {s.source !== "CAMPAIGN" && s.type === "hero" && (
                  <SectionChoice
                    kind="banners"
                    value={s.bannerIds[0] ?? null}
                    onChange={(v) =>
                      updateSection(s.sectionId, { bannerIds: v ? [v] : [] })
                    }
                  />
                )}{" "}
                {s.source !== "CAMPAIGN" && s.type === "announcement" && (
                  <SectionChoice
                    kind="announcements"
                    value={s.announcementId}
                    onChange={(v) =>
                      updateSection(s.sectionId, { announcementId: v })
                    }
                  />
                )}{" "}
                {s.source !== "CAMPAIGN" && s.type === "products" && (
                  <SectionChoice
                    kind="collections"
                    value={s.collectionId}
                    onChange={(v) =>
                      updateSection(s.sectionId, { collectionId: v })
                    }
                  />
                )}
                <button
                  type="button"
                  onClick={() =>
                    change({
                      ...content,
                      sections: content.sections.filter(
                        (v) => v.sectionId !== s.sectionId,
                      ),
                    })
                  }
                >
                  Remove section
                </button>
              </details>
            </article>
          ))}
      </div>
      <details className="panel">
        <summary>Add section</summary>
        <div className="category-choices">
          {(
            [
              "hero",
              "fresh",
              "under20",
              "ending",
              "trending",
              "announcement",
              "products",
            ] as const
          ).map((type) => (
            <button
              key={type}
              disabled={content.sections.length >= 16}
              onClick={() => addSection(type)}
            >
              {SECTION_NAMES[type]}
            </button>
          ))}
        </div>
      </details>
      <div className="toolbar editor-actions">
        <button disabled={busy} onClick={() => void act("save")}>
          Save Draft
        </button>
        <button disabled={busy} onClick={() => void act("preview")}>
          Preview
        </button>
        <button
          className="primary"
          disabled={busy || dirty || !version || !preview}
          onClick={() => dialog.current?.showModal()}
        >
          Publish
        </button>
      </div>
      {dirty && <p className="muted">Unsaved changes</p>}
      {preview && <HomepagePreview {...preview} />}
      <dialog ref={dialog} aria-labelledby="homepage-confirm">
        <h2 id="homepage-confirm">Publish this homepage?</h2>
        <p>Shoppers will see these sections.</p>
        <div className="toolbar">
          <button onClick={() => dialog.current?.close()}>Cancel</button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void act("publish")}
          >
            Publish
          </button>
        </div>
      </dialog>
    </>
  );
}
