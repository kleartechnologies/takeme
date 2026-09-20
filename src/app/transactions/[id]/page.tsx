import type { Metadata } from "next";
import { TransactionView } from "@/components/transactions/transaction-view";

export const metadata: Metadata = { title: "Transaction status" };
type Props = { params: Promise<{ id: string }> };
export default async function TransactionPage({ params }: Props) {
  const { id } = await params;
  return <main className="page-shell py-8 md:py-12"><TransactionView id={id} /></main>;
}
