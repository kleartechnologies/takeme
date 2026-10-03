import { AuthForm } from "@/components/auth/auth-form";
import { Suspense } from "react";
export default function Page() { return <Suspense fallback={<main className="grid min-h-screen place-content-center" role="status">Loading…</main>}><AuthForm mode="login" /></Suspense>; }
