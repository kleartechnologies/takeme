import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center" aria-label="TAKEME home">
      <Image
        src="/brand/takeme-app-icon.png"
        alt="TAKEME"
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className={`${compact ? "size-9" : "size-11"} rounded-xl object-cover`}
        loading={compact ? "lazy" : "eager"}
      />
    </Link>
  );
}
