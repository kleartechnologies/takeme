export const publicInformationPaths = ["/privacy", "/privacy-policy", "/terms", "/help", "/help/prohibited-items", "/contact", "/account-deletion"] as const;

export function isPublicInformationPath(pathname: string) {
  return publicInformationPaths.some(path => path === pathname);
}

// Owner supplied date/age/jurisdiction and the operator/contact details in src/content/operator.ts.
// The proposed effective date does not grant publication permission.
export const legalDraft = Object.freeze({ version: "1.0-draft", lastUpdated: "2026-10-03", effectiveDate: "2026-10-05", minimumAge: 18, jurisdiction: "Malaysia", publicationApproved: false });

export function canPreviewLegalDraft(runtime: { nodeEnv?: string; useEmulators?: string; projectId?: string }) {
  return runtime.nodeEnv === "development" && runtime.useEmulators === "true" && runtime.projectId === "demo-takeme";
}

export function isLocalLegalPreview() {
  return canPreviewLegalDraft({ nodeEnv: process.env.NODE_ENV, useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}
