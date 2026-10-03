import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertStoragePolicyRules, assertFirestorePolicyRules } from "../functions/src/release-policy.ts";

export async function checkReleaseRules(repository) {
  assertStoragePolicyRules(await readFile(path.join(repository, "storage.rules"), "utf8"));
  assertFirestorePolicyRules(await readFile(path.join(repository, "firestore.rules"), "utf8"));
}
