import type { Metadata } from "next";
import { AccountTransactions } from "@/components/profile/account-transactions";
export const metadata: Metadata = { title: "My Transactions" };
type Props = { searchParams: Promise<{ role?: string }> };
export default async function TransactionsPage({ searchParams }: Props) { const { role } = await searchParams; return <main className="page-shell profile-system"><AccountTransactions role={role === "buying" || role === "selling" ? role : undefined} /></main>; }
