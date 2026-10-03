import { AccountOnboarding } from "@/components/auth/account-onboarding";
import { Suspense } from "react";
export default function Page() { return <Suspense fallback={<main className="grid min-h-screen place-content-center" role="status">Loading…</main>}><AccountOnboarding step="profile" /></Suspense>; }
