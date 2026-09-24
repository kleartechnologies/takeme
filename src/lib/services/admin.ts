import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase/client";

export type AdminSection = "overview" | "users" | "listings" | "transactions" | "revenue" | "intelligence" | "engagement" | "promotions" | "reviews" | "reports" | "settings";
export type AdminList = "users" | "listings" | "transactions" | "promotions" | "reviews" | "reports";
export type AdminPreset = "today" | "7d" | "30d" | "90d" | "year" | "all" | "custom";
export interface AdminMetrics {
  section: AdminSection;
  range: { label: string; start: string | null; end: string };
  cards: { label: string; value: number | null; unit?: "money" | "percent" | "count"; scope: "current" | "period" | "lifetime"; note?: string }[];
  breakdowns: { label: string; items: { label: string; count: number; amountSen?: number }[] }[];
  series: { label: string; points: { label: string; count: number; amountSen?: number }[] }[];
  unavailable: string[];
  note?: string;
}
export type AdminRow = Record<string, string | number | boolean | string[] | null> & { id: string };
export interface AdminPage { rows: AdminRow[]; nextCursor: string | null }
export interface AdminRecord { row: AdminRow; detail: Record<string, unknown> }

async function invoke<T>(name: string, data: Record<string, unknown>): Promise<T> {
  if (!auth?.currentUser || !functions) throw new Error("Administrator sign-in is required.");
  return (await httpsCallable<Record<string, unknown>, T>(functions, name)(data)).data;
}
export const getAdminMetrics = (section: AdminSection, preset: AdminPreset, from?: string, to?: string) => invoke<AdminMetrics>("getAdminMetrics", { section, preset, from, to });
export const getAdminPage = (section: AdminList, cursor?: string, status?: string) => invoke<AdminPage>("getAdminPage", { section, ...(cursor ? { cursor } : {}), ...(status ? { status } : {}) });
export const getAdminRecord = (section: AdminList, id: string) => invoke<AdminRecord>("getAdminRecord", { section, id });
export const updateAdminReport = (reportId: string, status: string, resolution: string, internalNotes: string) => invoke<{ updated: boolean }>("updateAdminReport", { reportId, status, resolution, internalNotes });
