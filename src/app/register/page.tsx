import { AuthForm } from "@/components/auth/auth-form";
import { Suspense } from "react";
export default function RegisterPage() { return <main className="page-shell grid min-h-[72vh] place-items-center py-10"><Suspense fallback={<div className="min-h-96 w-full max-w-md animate-pulse rounded-3xl bg-stone-100" />}><AuthForm mode="register" /></Suspense></main>; }
