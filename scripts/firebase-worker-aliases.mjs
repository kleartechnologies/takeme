import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

// Firestore's Node entry eagerly evaluates gRPC/protobuf constructor codegen
// during SSR, before the browser-only initialization guard. Workers disallow
// that eval. Resolve the installed public browser entries for this web build;
// do not change global resolver conditions or Firebase Functions dependencies.
export function firebaseWorkerAliases(repository) {
  const require = createRequire(path.join(repository, "package.json"));
  const firebaseRoot = path.dirname(require.resolve("firebase/package.json"));
  const manifests = {
    "firebase/firestore$": path.join(firebaseRoot, "firestore/package.json"),
    "@firebase/firestore$": require.resolve("@firebase/firestore/package.json"),
  };
  return Object.fromEntries(Object.entries(manifests).map(([name, manifest]) => {
    const metadata = JSON.parse(readFileSync(manifest, "utf8"));
    if (typeof metadata.browser !== "string") throw new Error("The installed Firestore SDK has no reviewed browser entry for the Workers build.");
    const entry = path.resolve(path.dirname(manifest), metadata.browser);
    if (!statSync(entry).isFile()) throw new Error("The Firestore browser entry is unavailable locally.");
    return [name, entry];
  }));
}
