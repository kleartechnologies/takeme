import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Adapt the existing gated Next build. Firebase owns all marketplace storage,
// jobs and Functions. No R2, Durable Objects, Queues or Cron migration.
const config = {
  ...defineCloudflareConfig(),
  buildCommand: "npm run build -- --webpack",
};

export default config;
