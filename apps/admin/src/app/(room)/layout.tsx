import { redirect } from "next/navigation";
import { readAdminSession } from "@admin/lib/server-session";
import { AdminGate } from "@admin/components/session";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await readAdminSession())) redirect("/login");
  return <AdminGate>{children}</AdminGate>;
}
