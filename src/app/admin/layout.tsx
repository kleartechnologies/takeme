import { AdminShell } from "@/components/admin/admin-shell";

export default function Layout({ children }: LayoutProps<"/admin">) { return <AdminShell>{children}</AdminShell>; }
