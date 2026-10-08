"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { call } from "@admin/lib/firebase";
import {
  CATEGORY_LABELS,
  DESTINATIONS,
  categoryDestination,
  customDestination,
  destinationType,
  destinationLabel,
  type DestinationType,
} from "@admin/lib/banner-workflow";
import type { EditorialRecord } from "@contracts/editorial-domain";
type Choice = {
  id: string;
  title?: string;
  displayName?: string;
  imageUrl?: string;
  photoURL?: string;
  price?: number;
  sellerName?: string;
  sellerRating?: number;
  sellerReviewCount?: number;
  activeListings?: number;
};
export function DestinationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [type, setType] = useState<DestinationType>(() =>
      destinationType(value),
    ),
    [search, setSearch] = useState(""),
    [rows, setRows] = useState<Choice[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [sellerSearch, setSellerSearch] = useState(""),
    [seller, setSeller] = useState(""),
    [sellers, setSellers] = useState<Choice[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selectedLabel, setSelectedLabel] = useState(destinationLabel(value)),
    [custom, setCustom] = useState(value);
  async function find(next?: string, sellerOnly = false) {
    setBusy(true);
    setError("");
    try {
      if (type === "Collection") {
        const result = await call<{
          records: EditorialRecord[];
          nextCursor: string | null;
        }>("getAdminEditorialPage", {
          kind: "collections",
          ...(next ? { cursor: next } : {}),
        });
        setRows(
          result.records
            .filter(
              (r) =>
                "active" in r.content &&
                r.content.active &&
                r.content.title.toLowerCase().includes(search.toLowerCase()),
            )
            .map((r) => ({ id: r.id, title: r.content.title })),
        );
        setCursor(result.nextCursor);
      } else {
        const product = type === "Product" && !sellerOnly;
        const result = await call<{
          rows: Choice[];
          nextCursor: string | null;
        }>("getAdminPage", {
          section: product ? "listings" : "users",
          featureEligibleOnly: true,
          sellerSummary: !product,
          ...(sellerOnly ? { search: sellerSearch } : { search }),
          ...(product
            ? { status: "active", ...(seller ? { sellerId: seller } : {}) }
            : {}),
          ...(next ? { cursor: next } : {}),
        });
        if (sellerOnly) setSellers(result.rows);
        else {
          setRows(result.rows);
          setCursor(result.nextCursor);
        }
        if (
          product &&
          !next &&
          !seller &&
          /^[A-Za-z0-9_-]{3,128}$/.test(search)
        ) {
          const exact = await call<{ rows: Choice[] }>("getAdminPage", {
            section: "listings",
            featureEligibleOnly: true,
            recordId: search,
          });
          setRows([
            ...exact.rows,
            ...result.rows.filter(
              (r) => !exact.rows.some((e) => e.id === r.id),
            ),
          ]);
        }
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load choices. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function selectType(t: DestinationType) {
    setType(t);
    setSearch("");
    setRows([]);
    setCursor(null);
    setSeller("");
    setSellers([]);
    setSelectedLabel("");
    setError("");
    onChange(t === "Explore" ? "/explore" : "");
  }
  // Keep the chosen picker while its value is cleared; external loaded values still hydrate via key/remount.
  return (
    <section className="destination-picker" aria-label="Banner destination">
      <label>
        Destination
        <select
          disabled={busy}
          value={type}
          onChange={(e) => selectType(e.target.value as DestinationType)}
        >
          {DESTINATIONS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {type === "Category" ? (
        <>
          <label>
            Search categories
            <input
              placeholder="Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="category-choices">
            {Object.entries(CATEGORY_LABELS)
              .filter(([, name]) =>
                name.toLowerCase().includes(search.toLowerCase()),
              )
              .map(([id, name]) => (
                <button
                  type="button"
                  aria-pressed={value === categoryDestination(id)}
                  key={id}
                  onClick={() => {
                    onChange(categoryDestination(id));
                    setSelectedLabel(name);
                  }}
                >
                  {name}
                </button>
              ))}
          </div>
        </>
      ) : type === "Explore" ? (
        <p>Explore listings</p>
      ) : type === "Custom link" ? (
        <details open className="advanced">
          <summary>Custom TAKEME link</summary>
          <label>
            Marketplace link
            <input
              value={custom}
              placeholder="/explore"
              onChange={(e) => {
                setCustom(e.target.value);
                setError("");
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              try {
                onChange(customDestination(custom));
                setSelectedLabel(custom);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Use link
          </button>
          <p className="muted">
            Internal TAKEME destinations only. Links to other websites are not
            supported.
          </p>
        </details>
      ) : (
        <>
          <div className="picker-search">
            <label>
              {type === "Product"
                ? "Search products by title or listing ID"
                : type === "Seller"
                  ? "Search sellers"
                  : "Search collections"}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button type="button" disabled={busy} onClick={() => void find()}>
              Search
            </button>
          </div>
          {type === "Product" && (
            <details>
              <summary>Find products by seller</summary>
              <label>
                Seller name
                <input
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void find(undefined, true)}
              >
                Browse sellers
              </button>
              <select
                aria-label="Filter products by seller"
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
              >
                <option value="">All sellers</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </details>
          )}
          <div className="choice-list">
            {rows.map((r) => (
              <button
                className="choice"
                type="button"
                key={r.id}
                onClick={() => {
                  onChange(
                    type === "Product"
                      ? `/listings/${r.id}`
                      : type === "Seller"
                        ? `/sellers/${r.id}`
                        : `/#collection_${r.id}`,
                  );
                  setSelectedLabel(r.title ?? r.displayName ?? type);
                }}
              >
                {(r.imageUrl || r.photoURL) && (
                  <img alt="" src={r.imageUrl || r.photoURL} loading="lazy" />
                )}
                <span>
                  <strong>{r.title ?? r.displayName}</strong>
                  <small>
                    {type === "Product"
                      ? `RM ${r.price ?? 0} · ${r.sellerName ?? "TAKEME seller"}`
                      : type === "Seller"
                        ? `${r.activeListings ?? 0} listings · ${r.sellerReviewCount ? `${r.sellerRating} ★ (${r.sellerReviewCount})` : "No reviews yet"}`
                        : "Curated collection"}
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          {cursor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void find(cursor)}
            >
              More results
            </button>
          )}
          {busy && <p role="status">Loading choices…</p>}
        </>
      )}
      {value && (
        <p className="selected-destination" role="status">
          Destination:{" "}
          <strong>{selectedLabel || destinationLabel(value)}</strong>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
