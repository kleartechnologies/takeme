import type { Metadata } from "next";
import { AccountDeletionDisclosure, AccountDeletionFlow } from "@/components/account/account-deletion";
export const metadata: Metadata = { title: "Account deletion", description: "Request deletion of your TAKEME account securely in your browser and understand pending deletion and limited retention." };
export default function AccountDeletionPage() {
  return <main className="page-shell profile-system"><div className="mx-auto max-w-3xl py-4 sm:py-8"><p className="eyebrow">TAKEME account</p><h1 className="mb-5 mt-2 text-3xl font-bold tracking-tight">Delete your TAKEME account</h1><AccountDeletionDisclosure /><AccountDeletionFlow /></div></main>;
}
