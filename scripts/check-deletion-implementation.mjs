import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

// Source-presence/export qualification complements the full unit/integration
// suite. It never changes the independent runtime resource/publication gates.
export async function checkDeletionImplementation(repository) {
  const files = ["account-deletion.ts", "deletion-config.ts", "deletion-confirmation.ts", "account-deletion-retention.ts"];
  for (const name of files) if (!(await lstat(path.join(repository, "functions/src", name))).isFile()) throw new Error("Deletion implementation source is missing or not an ordinary local file.");
  const source = await readFile(path.join(repository, "functions/src/account-deletion.ts"), "utf8");
  const entry = await readFile(path.join(repository, "functions/src/index.ts"), "utf8");
  const required = ["getAccountDeletionAvailability", "getAccountDeletionStatus", "requestAccountDeletion", "retryAccountDeletion", "processAccountDeletions"];
  if (required.some(name => !source.includes(`export const ${name} =`) || !entry.includes(name)) || !source.includes("qualifyDeletionExecution({")) throw new Error("Deletion implementation exports or execution gate are missing; build qualification refused.");
  return { implementationPresent: true, runtimeActivationGranted: false };
}
