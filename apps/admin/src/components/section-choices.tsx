"use client";
import { useState } from "react";
import { call } from "@admin/lib/firebase";
import type { EditorialRecord } from "@contracts/editorial-domain";
/** Business labels only. Stable IDs stay in the selection value, never operator copy. */
export function SectionChoice({
  kind,
  value,
  onChange,
}: {
  kind: "banners" | "announcements" | "collections";
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [rows, setRows] = useState<EditorialRecord[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(next?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await call<{
        records: EditorialRecord[];
        nextCursor: string | null;
      }>("getAdminEditorialPage", { kind, ...(next ? { cursor: next } : {}) });
      setRows((old) => (next ? [...old, ...r.records] : r.records));
      setCursor(r.nextCursor);
    } catch {
      setError("Could not load choices. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="section-choice">
      <p>
        {kind === "banners"
          ? "Banner"
          : kind === "collections"
            ? "Collection"
            : "Announcement"}
        {value ? " selected" : " not selected"}
      </p>
      <button type="button" disabled={busy} onClick={() => void load()}>
        Choose{" "}
        {kind === "banners"
          ? "banner"
          : kind === "collections"
            ? "collection"
            : "announcement"}
      </button>
      {value && (
        <button type="button" onClick={() => onChange(null)}>
          Remove selection
        </button>
      )}
      <div className="category-choices">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.id === value}
            onClick={() => onChange(r.id)}
          >
            {r.content.title}
          </button>
        ))}
      </div>
      {cursor && (
        <button disabled={busy} onClick={() => void load(cursor)}>
          More choices
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
