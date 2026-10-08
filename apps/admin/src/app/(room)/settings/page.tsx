"use client";
import { useAdminSession } from "@admin/components/session";
export default function Settings() {
  const { user } = useAdminSession();
  return (
    <>
      <p className="eyebrow">Settings</p>
      <h1>Admin access & configuration</h1>
      <section className="panel">
        <h2>Access</h2>
        <p>Administrator claim verified by the server. Account: {user?.uid}</p>
        <p>
          No email allowlist is used. Claim assignment stays in the
          owner-controlled Firebase administration process.
        </p>
      </section>
      <section className="panel">
        <h2>Marketplace content</h2>
        <p>
          Homepage, category order, banners and campaign schedules are managed
          under Content. Preview and explicit Publish are required for homepage
          changes.
        </p>
        <p>
          All times are displayed in Asia/Kuala_Lumpur. Uploaded assets are
          create-only.
        </p>
      </section>
      <section className="panel">
        <h2>Infrastructure</h2>
        <p>
          This dashboard does not manage payments, account-deletion execution,
          TTL, DNS, schedules or production activation controls.
        </p>
      </section>
    </>
  );
}
