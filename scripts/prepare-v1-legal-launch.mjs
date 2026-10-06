import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legalLaunchDateInput, prepareV1LegalDateSource } from "../functions/src/legal-launch-date-plan.ts";
import { prepareV1PolicyRecord } from "../src/lib/v1-legal-launch-gate.ts";

// A date proposal only, outside Git. No apply mode, credentials, SDK or cloud access.
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output" || !path.isAbsolute(args[1])) {
    throw new Error("Use --output <new-absolute-JSON-file-outside-Git>. No apply or approval option exists.");
  }
  const target = path.join(await realpath(path.dirname(args[1])), path.basename(args[1]));
  for (let parent = path.dirname(target); ; parent = path.dirname(parent)) {
    if (existsSync(path.join(parent, ".git"))) throw new Error("The date proposal must remain outside every Git checkout.");
    if (parent === path.dirname(parent)) break;
  }
  const sourceFile = fileURLToPath(new URL("../functions/src/legal-publication.ts", import.meta.url));
  const source = await readFile(sourceFile, "utf8");
  const plan = prepareV1LegalDateSource(source, { [legalLaunchDateInput]: process.env[legalLaunchDateInput] });
  const { proposedSource, ...proposal } = plan;
  await writeFile(target, JSON.stringify({
    purpose: "v1-legal-launch-date-review", applied: false, publicationApproved: false, cloudAccessed: false,
    sourceSha256: createHash("sha256").update(source).digest("hex"), proposal,
    proposedSourceSha256: createHash("sha256").update(proposedSource).digest("hex"),
    futurePolicyRecord: prepareV1PolicyRecord(), policyRecordWritten: false,
    approvalsRequired: "Final owner/counsel, address/disclosure, date and coordinated production activation approval remain independent.",
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("Local V1 date proposal prepared outside Git. Source dates and approvals unchanged; nothing applied, activated or deployed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "V1 date proposal refused.");
  process.exitCode = 1;
}
