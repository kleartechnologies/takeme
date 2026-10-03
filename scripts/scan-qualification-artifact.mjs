import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const patterns = [
  ["demo-project", /demo-takeme/g], ["localhost", /localhost/g], ["loopback-ip", /127\.0\.0\.1|::1|0:0:0:0:0:0:0:1/g],
  ["emulator-ports", /\b(?:9099|8080|9199|5001|4000)\b/g],
  ["emulator-host-label", /(?:FIREBASE_AUTH|FIRESTORE|FIREBASE_STORAGE|FUNCTIONS)_EMULATOR_HOST/g],
  ["fixture-id", /(?:messaging-ui|product-detail-demo|auction-ui|settings-ui|onboarding-ui|stage11-ui|saved-hub-demo)[-_][A-Za-z0-9_-]*/g],
  ["developer-path", /\/Users\/[^\s"'<>]+/g], ["temporary-path", /\/(?:private\/)?(?:tmp|var\/folders)\/[^\s"'<>]+/g],
];
async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
export async function scanQualificationArtifact(directory) {
  const rawHits = [];
  for (const file of await files(directory)) {
    if (!/\.(?:js|json|html|css|map)$/.test(file)) continue;
    const relative = path.relative(directory, file).split(path.sep).join("/");
    // Qualification provenance/diagnostics are not served app code.
    if (relative === "takeme-release.json" || relative.startsWith("cache/") || relative.startsWith("diagnostics/")) continue;
    const content = await readFile(file, "utf8");
    for (const [label, pattern] of patterns) {
      const count = [...content.matchAll(pattern)].length;
      if (!count) continue;
      const classification = /\.nft\.json$|required-server-files\.json$|\.map$/.test(relative) ? "build-provenance-or-dependency-trace"
        : /\.(?:html|css)$/.test(relative) ? "served-content" : "bundled-code-review";
      rawHits.push({ file: relative, label, count, classification });
    }
  }
  const servedContentHits = rawHits.filter(hit => hit.classification === "served-content");
  return { rawHits, servedContentHits, explanation: "Raw bundled-code occurrences require source attribution. Inert SDK/Next helpers, demo-recognition safety branches and build traces are not configured endpoints; values are not silently removed. First-party runtime proof/configuration is validated separately." };
}
