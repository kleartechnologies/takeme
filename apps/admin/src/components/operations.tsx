"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { call } from "@admin/lib/firebase";
import { CATEGORY_IDS } from "@contracts/editorial-domain";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Request failed. Try again.";
type Row = Record<string, unknown> & { id: string };
export function Overview() {
  const [data, setData] = useState<{
      cards: { label: string; value: number | null }[];
      liveVersion: number;
      liveValid: boolean;
      audits: Row[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    call<typeof data>("getAdminControlOverview")
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <p className="eyebrow">TAKEME marketplace</p>
      <h1>Control room</h1>
      <p className="muted">
        Manage Homepage banners, curate discovery and review marketplace reports.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <p role="status">Loading bounded operational counts…</p>
      )}
      {data && (
        <>
          <div className="metrics">
            {data.cards.map((card) => (
              <div className="metric" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value ?? "Unavailable"}</strong>
              </div>
            ))}
          </div>
          <div className="panel toolbar">
            <div>
              <h2>Homepage</h2>
              <p className="muted">
                {data.liveValid
                  ? "Published Homepage is available"
                  : "Existing marketplace fallback is active"}
              </p>
            </div>
            <Link href="/homepage">Manage Homepage →</Link>
            <Link href="/content/campaigns">Advanced campaigns →</Link>
          </div>
          <details className="panel">
            <summary>Recent admin activity · technical audit</summary>
            <div className="table-wrap">
              <table className="audit">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Operator</th>
                    <th>Malaysia time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audits.map((row) => (
                    <tr key={row.id}>
                      <td>{String(row.action)}</td>
                      <td>
                        {String(row.resourceType)} / {String(row.resourceId)}
                      </td>
                      <td>{String(row.adminUid)}</td>
                      <td>
                        {new Date(String(row.timestamp)).toLocaleString(
                          "en-MY",
                          { timeZone: "Asia/Kuala_Lumpur" },
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.audits.length && <p>No admin changes recorded yet.</p>}
          </details>
        </>
      )}
    </>
  );
}
export function MarketplaceTable({ section }: { section: string }) {
  const backend =
    section === "sellers"
      ? "users"
      : section === "auctions"
        ? "listings"
        : section;
  const [rows, setRows] = useState<Row[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [recordId, setRecordId] = useState(""),
    [sellerId, setSellerId] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [status, setStatus] = useState(""),
    [auctionStatus, setAuctionStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(next?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await call<{ rows: Row[]; nextCursor: string | null }>(
        "getAdminPage",
        {
          section: backend,
          ...(search ? { search } : {}),
          ...(recordId ? { recordId } : {}),
          ...(sellerId ? { sellerId } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(status ? { status } : {}),
          ...(section === "auctions" ? { auction: true } : {}),
          ...(section === "sellers" ? { sellerSummary: true } : {}),
          ...(status === "reported"
            ? { reported: true, status: undefined }
            : {}),
          ...(auctionStatus ? { auctionStatus } : {}),
          ...(next ? { cursor: next } : {}),
        },
      );
      setRows(result.rows);
      setCursor(result.nextCursor);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    call<{ rows: Row[]; nextCursor: string | null }>("getAdminPage", {
      section: backend,
      ...(section === "auctions" ? { auction: true } : {}),
      ...(section === "sellers" ? { sellerSummary: true } : {}),
    })
      .then((result) => {
        if (active) {
          setRows(result.rows);
          setCursor(result.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [section, backend]);
  const title = section.charAt(0).toUpperCase() + section.slice(1);
  return (
    <>
      <p className="eyebrow">
        {section === "reports" ? "Moderation" : "Marketplace"}
      </p>
      <h1>{title}</h1>
      <p className="muted">
        Bounded operational pages. No private contact details, addresses or
        message browsing. Auctions are read-only.
      </p>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <div className="grid">
          {section !== "reports" && (
            <label>
              {backend === "users" ? "Public name prefix" : "Title search"}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}
          <label>
            Exact record ID
            <input
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
            />
          </label>
          {backend === "listings" && (
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
                  <option value="">All</option>
                  {CATEGORY_IDS.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {["listings", "reports"].includes(backend) && (
            <label>
              State
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                {(backend === "reports"
                  ? ["submitted", "reviewing", "resolved", "dismissed"]
                  : ["active", "sold", "draft", "removed", "ended", "reported"]
                ).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          {section === "auctions" && (
            <label>
              Auction state
              <select
                value={auctionStatus}
                onChange={(e) => setAuctionStatus(e.target.value)}
              >
                <option value="">All</option>
                {["scheduled", "active", "ended", "cancelled"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button className="primary" disabled={busy}>
          Search / filter
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>Owner / target</th>
              <th>State</th>
              <th>Created / schedule</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {typeof row.imageUrl === "string" && row.imageUrl && (
                    <img className="thumb" alt="" src={row.imageUrl} />
                  )}
                  <Link href={`/marketplace/${section}/${row.id}`}>
                    {String(
                      row.title ?? row.displayName ?? row.reason ?? row.id,
                    )}
                  </Link>
                  <small>{row.id}</small>
                </td>
                <td>
                  {String(row.sellerId ?? row.targetId ?? "—")}
                  {Boolean(row.reporterId) && (
                    <small>Reporter: {String(row.reporterId)}</small>
                  )}
                </td>
                <td>
                  {String(
                    row.auctionStatus ?? row.status ?? row.accountState ?? "—",
                  )}
                  {section === "sellers" && (
                    <small>
                      {Number(row.activeListings ?? 0)} active listings ·{" "}
                      {row.sellerRating == null
                        ? "No rating yet"
                        : String(row.sellerRating)}{" "}
                      · {Number(row.reports ?? 0)} reports
                    </small>
                  )}
                  {row.price != null && <small> RM {Number(row.price)}</small>}
                  {row.currentBid != null && (
                    <small> Public bid: {Number(row.currentBid) / 100}</small>
                  )}
                </td>
                <td>
                  {row.createdAt
                    ? new Date(String(row.createdAt)).toLocaleDateString(
                        "en-MY",
                      )
                    : "—"}
                  {Boolean(row.auctionStartAt) && (
                    <small>
                      Starts{" "}
                      {new Date(String(row.auctionStartAt)).toLocaleString(
                        "en-MY",
                        { timeZone: "Asia/Kuala_Lumpur" },
                      )}
                    </small>
                  )}
                  {Boolean(row.auctionEndAt) && (
                    <small>
                      {" "}
                      Ends{" "}
                      {new Date(String(row.auctionEndAt)).toLocaleString(
                        "en-MY",
                        { timeZone: "Asia/Kuala_Lumpur" },
                      )}
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {busy && <p role="status">Loading…</p>}
        {!busy && !rows.length && (
          <p>
            No matches in this page. Continue to the next page if available.
          </p>
        )}
      </div>
      {cursor && (
        <button disabled={busy} onClick={() => void load(cursor)}>
          Next page
        </button>
      )}
    </>
  );
}
export function MarketplaceRecord({
  section,
  id,
}: {
  section: string;
  id: string;
}) {
  const backend =
    section === "sellers"
      ? "users"
      : section === "auctions"
        ? "listings"
        : section;
  const [data, setData] = useState<{
      row: Row;
      detail: Record<string, unknown>;
    } | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("submitted"),
    [resolution, setResolution] = useState(""),
    [notes, setNotes] = useState(""),
    [purpose, setPurpose] = useState(""),
    [messages, setMessages] = useState<Row[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const value = await call<{ row: Row; detail: Record<string, unknown> }>(
        "getAdminRecord",
        { section: backend, id },
      );
      setData(value);
      setStatus(String(value.row.status ?? "submitted"));
      setResolution(String(value.detail.resolution ?? ""));
      setNotes(String(value.detail.internalNotes ?? ""));
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    let active = true;
    call<{ row: Row; detail: Record<string, unknown> }>("getAdminRecord", {
      section: backend,
      id,
    })
      .then((value) => {
        if (active) {
          setData(value);
          setStatus(String(value.row.status ?? "submitted"));
          setResolution(String(value.detail.resolution ?? ""));
          setNotes(String(value.detail.internalNotes ?? ""));
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [backend, id]);
  async function triage() {
    setBusy(true);
    setError("");
    try {
      await call("updateAdminReport", {
        reportId: id,
        status,
        resolution,
        internalNotes: notes,
      });
      await load();
      setNotice("Triage saved and audited.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function context() {
    setBusy(true);
    setError("");
    try {
      const result = await call<{ messages: Row[] }>("loadAdminReportContext", {
        reportId: id,
        purpose,
      });
      setMessages(result.messages);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href={`/marketplace/${section}`}>← Back to {section}</Link>
      <h1>Operational record</h1>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading…</p>}
      {data && (
        <>
          <section className="panel">
            <h2>
              {String(
                data.row.title ?? data.row.displayName ?? data.row.reason ?? id,
              )}
            </h2>
            <dl className="record-dl">
              {Object.entries({ ...data.row, ...data.detail })
                .filter(
                  ([key]) =>
                    ![
                      "moderationActionAvailable",
                      "explicitContextAvailable",
                    ].includes(key),
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="muted">{key.replace(/([A-Z])/g, " $1")}</dt>
                    <dd>
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "Unavailable")}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
          {section === "reports" && (
            <section className="panel">
              <h2>Report review</h2>
              <p>
                No content is removed automatically. This uses the existing
                authoritative report triage action.
              </p>
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {["submitted", "reviewing", "resolved", "dismissed"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Resolution
                <textarea
                  maxLength={2000}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </label>
              <label>
                Internal notes
                <textarea
                  maxLength={4000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button
                disabled={busy}
                className="primary"
                onClick={() => void triage()}
              >
                Save triage
              </button>
              {data.detail.explicitContextAvailable === true && (
                <>
                  <h3>Reported conversation context</h3>
                  <p className="muted">
                    Explicit access is audited. At most two messages before and
                    after the reported message are returned.
                  </p>
                  <label>
                    Reason for access
                    <input
                      minLength={10}
                      maxLength={200}
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || purpose.trim().length < 10}
                    onClick={() => void context()}
                  >
                    Load reported conversation context
                  </button>
                  {messages.map((row) => (
                    <div className="panel" key={row.id}>
                      <span className="badge">
                        {row.reported ? "Reported message" : "Adjacent context"}
                      </span>
                      <p>{String(row.body)}</p>
                      <small>
                        {String(row.senderId)} · {String(row.createdAt)}
                      </small>
                    </div>
                  ))}
                </>
              )}
              {notice && <p role="status">{notice}</p>}
            </section>
          )}
        </>
      )}
    </>
  );
}
