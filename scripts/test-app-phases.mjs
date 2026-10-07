import { mkdtemp, mkdir, copyFile, symlink, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Historical preparation contracts remain useful after main becomes published.
// Only these named suites use an explicit, isolated unpublished source fixture.
// All other suites (including production-baseline) run against actual main.
const preparationSuites = [
  "address-publication-disposition.test.mts",
  "auction-creation-control.test.mts",
  "legal-launch-date-plan.test.mts",
  "legal-publication-copy.test.mts",
  "maintenance-rule-bridge.test.mts",
  "policy-activation-plan.test.mts",
  "policy-activation-rules.test.mts",
  "privacy-bm-v1.test.mts",
  "privacy-publication-copy.test.mts",
  "privacy-v1.test.mts",
  "production-build-gates.test.mts",
  "production-maintenance-control.test.mts",
  "production-policy-bootstrap.test.mts",
  "prohibited-items-v1.test.mts",
  "public-information.test.mts",
  "release-validation.test.mts",
  "terms-v1.test.mts",
  "v1-final-release-candidate.test.mts",
  "v1-owner-legal-launch-gate.test.mts"
];
const flags = ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types"];
function run(args, cwd) {
  const result = spawnSync(process.execPath, [...flags, ...args], { cwd, env: process.env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Phase qualification failed (${result.status ?? "signal"}).`);
}
const fixture = await mkdtemp(path.join(tmpdir(), "takeme-prepublication-tests-"));
try {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  // Read current checkout bytes, never retrieve an old commit or install dependencies.
  for (const relative of tracked) {
    const target = path.join(fixture, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, relative), target);
  }
  execFileSync("git", ["init", "--quiet", "--initial-branch=prepublication-fixture"], { cwd: fixture });
  await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "dir");
  for (const [file, keys] of [
    ["functions/src/release-policy.ts", ["publicationApproved"]],
    ["functions/src/legal-publication.ts", ["publicationApproved", "finalContentApproved", "bmPrivacyNoticeApproved", "productionRoutesReviewed"]],
  ]) {
    const target = path.join(fixture, file);
    let text = await readFile(target, "utf8");
    // Replace only the production object's reviewed approval booleans. Other targets,
    // validation logic, versions, dates, eligibility and runtime guards stay intact.
    const productionObject = file.endsWith("release-policy.ts")
      ? /export const productionReleasePolicy[^=]*= Object\.freeze\(\{([\s\S]*?)\}\)/
      : /export const legalPublicationReadiness[^=]*= Object\.freeze\(\{([\s\S]*?)\}\)/;
    const match = productionObject.exec(text);
    if (!match) throw new Error(`Unknown source fixture structure: ${file}`);
    let body = match[0];
    for (const key of keys) {
      const expression = new RegExp(`\\b${key}: true`, "g");
      if ((body.match(expression) ?? []).length !== 1) throw new Error(`Published source contract changed: ${file} ${key}`);
      body = body.replace(expression, `${key}: false`);
    }
    text = text.replace(match[0], body);
    await writeFile(target, text);
  }
  // Keep rule candidates consistent with the explicit unpublished fixture.
  run(["--input-type=module", "-e", String.raw`
    import { readFileSync, writeFileSync } from "node:fs";
    import { renderPolicyRules } from "./functions/src/release-policy.ts";
    for (const file of ["firestore.rules", "storage.rules"]) {
      const source = readFileSync(file, "utf8");
      const pattern = /    \/\/ BEGIN GENERATED RELEASE POLICY[\s\S]*?    \/\/ END GENERATED RELEASE POLICY/;
      if (!pattern.test(source)) throw new Error("Missing rule fixture markers");
      writeFileSync(file, source.replace(pattern, renderPolicyRules()));
    }
  `], fixture);
  console.log("APP TEST PHASE: explicit pre-publication fixture (no cloud access)");
  run(["--test", ...preparationSuites.map(name => `tests/${name}`)], fixture);
  const current = (await readdir(path.join(root, "tests"))).filter(name => name.endsWith(".test.mts") && !preparationSuites.includes(name)).sort();
  console.log("APP TEST PHASE: actual published production baseline");
  run(["--test", ...current.map(name => `tests/${name}`)], root);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
