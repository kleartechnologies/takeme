import { LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function FirebaseSetupState() {
  return <div className="grid min-h-72 place-items-center rounded-3xl border border-[var(--takeme-green)]/25 bg-[var(--takeme-light-green)] p-8 text-center"><div><Image src="/brand/mascot-2d-wink.png" alt="" width={118} height={98} className="mx-auto h-24 w-auto object-contain" /><h2 className="mt-3 text-2xl font-bold">Connect Firebase to continue</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--takeme-dark-green)]/75">Add the Firebase web configuration to <code>.env.local</code>. TAKEME will not substitute sample listings for production data.</p></div></div>;
}

export function SignInRequired({ message = "Log in to manage marketplace listings." }: { message?: string }) {
  return <div className="grid min-h-72 place-items-center rounded-3xl border border-gray-200 bg-white p-8 text-center"><div><LogIn className="mx-auto text-[var(--takeme-dark-green)]" size={34} /><h2 className="mt-4 text-2xl font-bold">Sign in to continue</h2><p className="mt-2 text-sm text-[var(--takeme-gray)]">{message}</p><Link href="/login" className="button-primary mt-6 h-11 px-6">Log in</Link></div></div>;
}
