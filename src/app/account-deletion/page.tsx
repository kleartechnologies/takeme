import type { Metadata } from "next";
import { AccountDeletionDisclosure, AccountDeletionFlow } from "@/components/account/account-deletion";
import { PublicInformationPage } from "@/components/public-information/public-information";
export const metadata: Metadata = { title: "Account deletion", description: "Request deletion of your TAKEME account securely in your browser and understand pending deletion and limited retention.", alternates: { canonical: "/account-deletion" } };
export default function AccountDeletionPage() {
  return <PublicInformationPage title="Delete your TAKEME account"><div className="profile-system"><AccountDeletionDisclosure /><AccountDeletionFlow /></div></PublicInformationPage>;
}
