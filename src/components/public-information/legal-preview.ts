import { notFound } from "next/navigation";
import { isLegalInformationAvailable } from "@/lib/public-information";

// Production additionally requires the real source approvals and matching proof.
// URL parameters and runtime flags cannot grant publication permission.
export function requireLegalInformation() {
  if (!isLegalInformationAvailable()) notFound();
}
