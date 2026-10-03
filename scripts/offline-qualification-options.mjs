import { offlineQualificationConfiguration, ownerOfflineQualificationConfiguration } from "../src/lib/release-config.ts";

export function selectOfflineQualification(args, env) {
  if (!args.length) return { profile: "synthetic", configuration: offlineQualificationConfiguration() };
  if (args.length !== 5 || args[0] !== "--owner-config" || args[1] !== "--project" || args[3] !== "--project-number") {
    throw new Error("Offline qualification accepts no arguments, or --owner-config --project <confirmed-project> --project-number <confirmed-number>. No release override is accepted.");
  }
  return { profile: "owner-config", configuration: ownerOfflineQualificationConfiguration(env, { projectId: args[2], projectNumber: args[4] }) };
}

export function redactQualificationLog(text, configuration) {
  let safe = String(text || "");
  for (const value of Object.values(configuration.publicFirebase).filter(Boolean).sort((a, b) => b.length - a.length)) safe = safe.replaceAll(value, "[redacted-public-sdk]");
  return safe.replace(/TAKEME_RELEASE_PROOF_V1:[A-Za-z0-9+/=]+/g, "[redacted-release-proof]");
}
