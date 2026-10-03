import { notFound } from "next/navigation";
import { isLocalLegalPreview } from "@/lib/public-information";

// Incomplete legal/contact drafts are served only in the authorised demo dev session.
// No query parameter or browser-supplied value can enable them in a production build.
export function requireLocalLegalPreview() {
  if (!isLocalLegalPreview()) notFound();
}
