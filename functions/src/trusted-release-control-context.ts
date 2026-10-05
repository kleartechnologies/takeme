import { getApp } from "firebase-admin/app";
import type { ProtectedWriteContext } from "./protected-write-maintenance.ts";

const targets = { "demo-takeme": "demo", "takeme-staging-822a5": "staging", "takeme-52b80": "production" } as const;
const loopback = (value: string | undefined) => typeof value === "string" && /^(127\.0\.0\.1|localhost):[1-9]\d*$/.test(value);

/** Old runtimes need no new flags: derive only exact managed/Admin project identity. */
export function trustedReleaseControlContext(): ProtectedWriteContext | null {
  try {
    const projects = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.GCP_PROJECT,
      getApp().options.projectId].filter(value => value !== undefined);
    const projectId = projects[0];
    if (!projectId || !Object.hasOwn(targets, projectId) || projects.some(value => value !== projectId)) return null;
    const target = targets[projectId as keyof typeof targets];
    if (process.env.TAKEME_RELEASE_TARGET !== undefined && process.env.TAKEME_RELEASE_TARGET !== target) return null;
    if (process.env.TAKEME_FIREBASE_PROJECT_ID !== undefined && process.env.TAKEME_FIREBASE_PROJECT_ID !== projectId) return null;
    if (process.env.FIREBASE_CONFIG !== undefined) {
      const config = JSON.parse(process.env.FIREBASE_CONFIG);
      if (!config || typeof config !== "object" || Array.isArray(config) || config.projectId !== projectId) return null;
    }
    if (target === "demo") {
      if (!loopback(process.env.FIRESTORE_EMULATOR_HOST) || !loopback(process.env.FIREBASE_AUTH_EMULATOR_HOST)) return null;
    } else if (Object.keys(process.env).some(key => /EMULATOR|EMULATORS/.test(key)
      && !(key === "NEXT_PUBLIC_USE_FIREBASE_EMULATORS" && process.env[key] === "false"))) return null;
    return { target, projectId };
  } catch { return null; }
}
