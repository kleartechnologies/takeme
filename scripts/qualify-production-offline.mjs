import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseEnvironment } from "../src/lib/release-config.ts";
import { recordReleaseArtifact, validateOfflineQualificationArtifact, validateReleaseArtifact } from "./release-artifact.mjs";
import { checkReleaseRules } from "./check-release-rules.mjs";
import { scanQualificationArtifact } from "./scan-qualification-artifact.mjs";
import { selectOfflineQualification, redactQualificationLog } from "./offline-qualification-options.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

async function cachedPoppins(workspace) {
  const chunks = path.join(repository, ".next/static/chunks");
  const faces = new Map();
  const fonts = [];
  for (const name of await readdir(chunks)) {
    if (!name.endsWith(".css")) continue;
    const css = await readFile(path.join(chunks, name), "utf8");
    for (const match of css.matchAll(/@font-face\{[^}]*font-family:["']?Poppins["']?;[^}]*\}/g)) {
      const face = match[0], font = /src:url\((?:\.\.\/media\/)([^)]+\.woff2)\)/.exec(face)?.[1];
      if (!font || faces.has(font)) continue;
      const bytes = await readFile(path.join(repository, ".next/static/media", font));
      const target = path.join(workspace, "cached-fonts", font);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
      fonts.push({ file: font, sha256: digest(bytes) });
      const subset = /U\+(?:0000|0)-(?:00)?FF/i.test(face) ? "latin" : "other";
      faces.set(font, `/* ${subset} */\n${face.replace(`src:url(../media/${font})`, `src: url(${target})`)}`);
    }
  }
  for (const weight of [400, 500, 600, 700]) if (![...faces.values()].some(face => face.includes(`font-weight:${weight};`))) throw new Error("Authentic cached Poppins assets are incomplete. No network font download is permitted.");
  const mock = path.join(workspace, "font-cache.cjs");
  await writeFile(mock, `const css = ${JSON.stringify([...faces.values()].join("\n"))};\nmodule.exports = new Proxy({}, {get: (_, url) => typeof url === "string" && url.includes("family=Poppins") ? css : undefined});\n`);
  return { mock, fonts };
}

async function main() {
  const { profile, configuration } = selectOfflineQualification(process.argv.slice(2), process.env);
  await checkReleaseRules(repository);
  const workspace = await mkdtemp(path.join(tmpdir(), "takeme-production-qualification-"));
  await chmod(workspace, 0o700);
  const source = path.join(workspace, "source");
  await mkdir(source);
  const inventory = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: repository, encoding: "utf8" });
  if (inventory.status !== 0) throw new Error("Cannot identify the reviewed local source inventory.");
  const sourceHashes = [];
  for (const relative of [...new Set(inventory.stdout.split("\0").filter(Boolean))].sort()) {
    // Never load/copy dotenv, credentials, local verification output or Git state.
    if (relative.split("/").some(part => part.startsWith(".env")) || !/^(?:src\/|functions\/src\/|scripts\/|public\/|docs\/|[^/]+$)/.test(relative) || /(?:debug\.log|\.tsbuildinfo)$/.test(relative)) continue;
    const original = path.join(repository, relative), target = path.join(source, relative);
    if (!(await lstat(original)).isFile()) throw new Error("Qualification source must contain ordinary local files only.");
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(original, target);
    sourceHashes.push({ file: relative, sha256: digest(await readFile(original)) });
  }
  await symlink(path.join(repository, "node_modules"), path.join(source, "node_modules"), "dir");
  const configFile = path.join(source, "next.config.ts");
  let configSource = await readFile(configFile, "utf8");
  if (!configSource.includes("const configuration = validateReleaseEnvironment(environment);")) throw new Error("Qualification config hook differs from the reviewed source.");
  configSource = configSource.replace("import { validateReleaseEnvironment }", "import type { ReleaseConfiguration }")
    .replace("const configuration = validateReleaseEnvironment(environment);", `const configuration = ${JSON.stringify(configuration)} as ReleaseConfiguration;`)
    .replace("env: { TAKEME_BUILD_RELEASE_PROOF:", 'env: { TAKEME_OFFLINE_QUALIFICATION: "true", TAKEME_BUILD_RELEASE_PROOF:');
  await writeFile(configFile, configSource);
  const { mock, fonts } = await cachedPoppins(workspace);
  const networkLog = path.join(workspace, "denied-network-transports.log");
  const blocker = path.join(source, "scripts/offline-network-block.cjs");
  // Do not inherit dotenv, emulator, token, Admin, provider, HOME or CI credentials.
  const env = {
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, LANG: "en_US.UTF-8", NODE_ENV: "production",
    NODE_OPTIONS: `--require ${JSON.stringify(blocker)}`, NEXT_TELEMETRY_DISABLED: "1",
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES: mock, TAKEME_OFFLINE_NETWORK_LOG: networkLog,
    TAKEME_OFFLINE_QUALIFICATION: "true", TAKEME_RELEASE_TARGET: "production",
    TAKEME_FIREBASE_PROJECT_ID: configuration.projectId, TAKEME_STORAGE_BUCKETS: configuration.storageBuckets.join(","),
    TAKEME_DELETION_ENVIRONMENT: "production", TAKEME_ENABLE_PRODUCTION_DELETION: "false", PROTECTED_PAYMENTS_ENABLED: "false",
    ...configuration.publicFirebase, NEXT_PUBLIC_SITE_URL: configuration.siteUrl, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
  };
  const probe = spawnSync(process.execPath, ["-e", 'try { require("node:net").connect({host:"127.0.0.1",port:9}); process.exit(2); } catch(error) { process.exit(error.code === "TAKEME_OFFLINE_NETWORK_BLOCKED" ? 0 : 1); }'], { cwd: source, env, encoding: "utf8" });
  if (probe.status !== 0) throw new Error("Offline transport-denial verification failed; no build started.");
  await writeFile(networkLog, ""); // Exclude the deliberate transport-denial probe.
  console.log("Building isolated, nondeployable production-mode qualification output; Node transports are blocked.");
  const build = spawnSync(process.execPath, [path.join(source, "node_modules/next/dist/bin/next"), "build", "--webpack"], { cwd: source, env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  process.stdout.write(redactQualificationLog(build.stdout, configuration));
  process.stderr.write(redactQualificationLog(build.stderr, configuration));
  if (build.error || build.status !== 0) throw new Error("Offline qualification build failed. No release artifact was produced.");
  if ((await readFile(networkLog, "utf8")).trim()) throw new Error("The build attempted a blocked network transport. Qualification refused.");
  const directory = path.join(source, ".next");
  await recordReleaseArtifact(directory, configuration);
  const checked = await validateOfflineQualificationArtifact(directory, configuration);
  const rawInspection = await scanQualificationArtifact(directory);
  await writeFile(path.join(workspace, "RAW-ARTIFACT-INSPECTION.json"), JSON.stringify(rawInspection, null, 2) + "\n");
  if (rawInspection.servedContentHits.length) throw new Error("Forbidden local/demo/fixture values occur in served HTML/CSS. Review the isolated raw inspection report.");
  let refused = false;
  try { await validateReleaseArtifact(directory, configuration); } catch { refused = true; }
  if (!refused) throw new Error("The ordinary artifact gate accepted qualification output.");
  try { validateReleaseEnvironment(env); throw new Error("The ordinary release gate accepted synthetic offline configuration."); }
  catch (error) { if (error.message === "The ordinary release gate accepted synthetic offline configuration.") throw error; }
  const report = { purpose: "offline-qualification", profile, deployable: false, externalServicesContacted: false,
    transportProtection: "Node fetch/http/https/net/tls/dns and non-Node subprocess blocking; not an OS-wide native-code sandbox",
    sourceFingerprint: digest(JSON.stringify(sourceHashes)), sourceFiles: sourceHashes.length,
    qualifiedArtifactFiles: checked.files, rawInspection: { rawHitGroups: rawInspection.rawHits.length, servedContentHitGroups: rawInspection.servedContentHits.length }, authenticCachedPoppins: fonts, deletionExecutionEnabled: false,
    ownerProjectAndNumberBound: profile === "owner-config", actualPolicyPublicationChanged: false, actualLegalPublicationChanged: false, ordinaryReleaseRefused: true };
  await writeFile(path.join(workspace, "NONDEPLOYABLE-OFFLINE-QUALIFICATION.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`Offline qualification passed (${checked.files} files). Ordinary release refused. Output: ${workspace}`);
}
await main().catch(error => { console.error(error instanceof Error ? error.message : "Offline qualification failed."); process.exitCode = 1; });
