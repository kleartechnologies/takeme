import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center" aria-label="TAKEME home">
      <Image
        src="/brand/takeme-wordmark.png"
        alt="TAKEME"
        width={compact ? 144 : 180}
        height={compact ? 48 : 60}
        className={`${compact ? "w-36" : "w-44"} h-auto object-contain mix-blend-multiply`}
        loading={compact ? "lazy" : "eager"}
      />
    </Link>
  );
}
