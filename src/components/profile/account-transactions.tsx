"use client";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { TransactionHistory } from "@/components/transactions/transaction-history";
export function AccountTransactions({ role }: { role?: "buying" | "selling" }) {
  const { user, loading } = useAuth();
  return <div><div className="profile-page-title"><Link href="/profile" className="icon-button" aria-label="Back to your profile"><ChevronLeft size={21} /></Link><h1>{role === "buying" ? "Purchases" : role === "selling" ? "Sales" : "My Transactions"}</h1></div>{loading ? <p role="status">Loading account…</p> : user ? <TransactionHistory key={user.uid} uid={user.uid} role={role} /> : <Link href="/login?next=/profile/transactions" className="button-primary min-h-11 px-5">Log in</Link>}</div>;
}
