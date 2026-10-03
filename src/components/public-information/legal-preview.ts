import { notFound } from "next/navigation";
import { isLocalLegalPreview } from "@/lib/public-information";

// Drafts require demo development or a staging build behind the guarded Worker.
// Production publication stays closed; URL parameters cannot select a preview.
export function requireLocalLegalPreview() {
  if (!isLocalLegalPreview()) notFound();
}
