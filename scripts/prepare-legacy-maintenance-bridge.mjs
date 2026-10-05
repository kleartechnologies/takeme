import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productionEnvironment } from "../functions/src/production-environment.ts";

// Review output only: no Firebase SDK/auth, source download, deploy command or
// production config write. Versioned source readbacks are separately reviewed.
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const ts = require("typescript");
const repository = fileURLToPath(new URL("../", import.meta.url));
// Owner-confirmed project number pins the metadata/deployment-source bucket;
// it is not a client SDK value or a guessed resource identity.
const productionProjectNumber = "367115645204";
const sha = value => createHash("sha256").update(value).digest("hex");
export const historicalProtectedNames = Object.freeze(`cancelAuction cancelPromotionRequest confirmTransactionCompletion createAuctionListing createFixedListingDraft createPromotionRequest declineTransactionCancellation deleteSavedSearch disputeTransaction markAllNotificationsRead markConversationSeen markNotificationRead openListingConversation openNotification openTransactionConversation placeBid publishAuctionListing publishFixedListing removeFixedListing reportPublicReview requestTransactionCancellation respondToOffer saveSearch sendConversationMessage setSellerFollow setNotificationPreference submitMarketplaceReport submitOffer submitTransactionReview trackMarketplaceEvent trackPromotionEngagement updateAdminReport updateAuctionListing updateFixedListing requestUploadPermits`.split(" "));
const directSites = new Set(["createFixedListingDraft:create", "createAuctionListing:create", "setNotificationPreference:set"]);

/** Span edits retain every original statement/option outside the narrow guard. */
export function transformHistoricalModule(raw, fileName, selectedNames) {
  if (raw.includes("legacy-maintenance-bridge")) throw new Error("Source already contains a bridge; refuse double wrapping.");
  const source = ts.createSourceFile(fileName, raw, ts.ScriptTarget.Latest, true);
  const edits = [], found = [], directWrites = [], transactionSites = [];
  let factory = false;
  const use = new Set();
  const add = (start, end, text) => edits.push({ start, end, text });
  const protectedBodies = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(value => value.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !selectedNames.includes(declaration.name.text)) continue;
      const expression = declaration.initializer;
      if (!expression || !ts.isCallExpression(expression) || !["onCall", "marketplaceMutationCall", "resolutionMutationCall"].includes(expression.expression.getText(source))) throw new Error("Unexpected historical callable constructor.");
      const callback = expression.arguments.at(-1);
      if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) || !ts.isBlock(callback.body)
        || !callback.modifiers?.some(value => value.kind === ts.SyntaxKind.AsyncKeyword)
        || callback.parameters.length !== 1 || !ts.isIdentifier(callback.parameters[0].name)) throw new Error("Unexpected historical callback shape.");
      add(callback.body.getStart(source) + 1, callback.body.getStart(source) + 1,
        `\n  return invokeHistoricalProtectedWrite(${callback.parameters[0].name.text}, async () => {`);
      const auctionAdmission = ["createAuctionListing", "publishAuctionListing"].includes(declaration.name.text);
      add(callback.body.end - 1, callback.body.end - 1, auctionAdmission ? "\n  }, true);\n" : "\n  });\n");
      use.add("invokeHistoricalProtectedWrite");found.push(declaration.name.text);
      protectedBodies.push({ name: declaration.name.text, body: callback.body });
    }
  }
  const withinTransaction = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isCallExpression(parent) && (parent.expression.getText(source).endsWith(".runTransaction") || parent.expression.getText(source) === "runGuardedTransaction")) return true;
    }
    return false;
  };
  function walk(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === "runTransaction") {
        add(node.expression.getStart(source), node.expression.end, "runHistoricalMaintenanceTransaction");
        add(node.arguments.pos, node.arguments.pos, `${node.expression.expression.getText(source)}, `);
        use.add("runHistoricalMaintenanceTransaction");transactionSites.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
      }
      const owner = protectedBodies.find(value => node.getStart(source) > value.body.getStart(source) && node.end < value.body.end);
      if (owner && ["create", "set", "update", "delete", "add", "commit"].includes(method) && !withinTransaction(node)) {
        if (!directSites.has(`${owner.name}:${method}`) || !ts.isAwaitExpression(node.parent) || !ts.isExpressionStatement(node.parent.parent)) throw new Error("Unreviewed standalone protected write or consumed WriteResult.");
        add(node.expression.getStart(source), node.expression.end, "writeHistoricalMaintenanceDocument");
        add(node.arguments.pos, node.arguments.pos, `${node.expression.expression.getText(source)}, "${method}", `);
        use.add("writeHistoricalMaintenanceDocument");directWrites.push({ name: owner.name, kind: method });
      }
    }
    // The five-endpoint package has an existing policy-aware factory. Its
    // maintenance check must precede that existing policy/lifecycle check.
    if (fileName === "account-lifecycle.ts" && ts.isFunctionDeclaration(node) && node.name?.text === "call") {
      const visit = value => {
        if (ts.isReturnStatement(value) && value.expression && ts.isCallExpression(value.expression) && value.expression.expression.getText(source) === "onCall") {
          const callback = value.expression.arguments.at(-1);
          if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) throw new Error("Unexpected policy factory.");
          const marker = callback.body.statements.find(statement => ts.isIfStatement(statement) && statement.expression.getText(source) === "!request.auth");
          if (!marker || !raw.includes("if (mutation")) throw new Error("Existing policy factory no longer matches.");
          add(marker.end, marker.end, "\n    if (mutation) await assertHistoricalProtectedWritesAvailable();");
          use.add("assertHistoricalProtectedWritesAvailable");factory = true;
        }
        ts.forEachChild(value, visit);
      };
      visit(node);
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
  if (!edits.length) return { source: raw, found, transactionSites, directWrites, factory, changed: false };
  // A standalone SDK write remains an atomic create/merge under the control read.
  const importPath = `${path.dirname(fileName) === "." ? "./" : "../"}legacy-maintenance-bridge`;
  let output = raw;
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let boundary = raw.length;
  for (const edit of edits) {
    if (edit.end > boundary) throw new Error("Overlapping source edits refused.");
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);boundary = edit.start;
  }
  output = `import { ${[...use].sort().join(", ")} } from "${importPath}";\n` + output;
  return { source: output, found, transactionSites, directWrites, factory, changed: true };
}

async function ordinary(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Ordinary local source/readback required.");
  return readFile(file);
}
async function sourceFiles(directory, prefix = "") {
  const rows = [];
  for (const item of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error("Symlinked source refused.");
    const name = path.join(prefix, item.name);
    if (item.isDirectory()) rows.push(...await sourceFiles(directory, name));
    else if (item.isFile() && name.endsWith(".ts")) rows.push(name);
  }
  return rows;
}
async function privateOutput(input) {
  if (!path.isAbsolute(input)) throw new Error("New absolute review directory outside Git required.");
  const output = path.join(await realpath(path.dirname(input)), path.basename(input));
  for (let parent = output; ; parent = path.dirname(parent)) {
    if (existsSync(path.join(parent, ".git"))) throw new Error("Review output cannot be inside Git.");
    if (parent === path.dirname(parent)) break;
  }
  await mkdir(output, { mode: 0o700 });return output;
}
export async function prepareHistoricalBridge(input, output) {
  if (!path.isAbsolute(input)) throw new Error("Absolute reviewed input required.");
  const metadata = JSON.parse(await ordinary(path.join(input, "live-metadata.json")));
  const receipt = JSON.parse(await ordinary(path.join(input, "source-archive-receipt.json")));
  const bindings = JSON.parse(await ordinary(path.join(input, "source-bindings.json")));
  const functions = metadata.checks?.find(value => value.name === "functions" && value.status === "PASS")?.result;
  if (metadata.project !== productionEnvironment.projectId || metadata.number !== productionProjectNumber
    || metadata.readOnly !== true || metadata.customerDataRead !== false || receipt.productionResourceChanges !== false
    || receipt.customerObjectsRead !== false || bindings.stopped || bindings.productionModified !== false
    || bindings.customerDataRead !== false || !Array.isArray(functions) || !Array.isArray(bindings.sourceBindings)
    || bindings.sourceBindings.length !== 35 || new Set(bindings.sourceBindings.map(value => value.name)).size !== 35
    || !historicalProtectedNames.every(name => bindings.sourceBindings.some(value => value.name === name))) throw new Error("Reviewed production source bindings required.");
  for (const binding of bindings.sourceBindings) {
    const fn = functions.find(value => value.name === binding.name);
    const archive = receipt.archives.find(value => value.sourceHash === binding.sourceHash);
    const source = fn?.sourceProvenance?.resolvedStorageSource;
    if (!fn || fn.state !== "ACTIVE" || fn.region !== "asia-southeast1" || fn.runtime !== "nodejs22" || fn.revision !== binding.revision
      || !archive?.members.includes(binding.name) || binding.codeTreeMatchesRepresentative !== true || binding.versionedArchiveBytesMatched !== true
      || source?.bucket !== `gcf-v2-sources-${productionProjectNumber}-asia-southeast1` || source.object !== `${binding.name}/function-source.zip`
      || JSON.stringify(source) !== JSON.stringify(binding.resolvedStorageSource)
      || sha(await ordinary(binding.archiveFile)) !== binding.archiveSha256) throw new Error("Pinned revision/versioned code readback mismatch.");
  }
  const masterFiles = ["legacy-maintenance-bridge.ts", "protected-write-maintenance.ts", "production-environment.ts", "staging-environment.ts",
    "auction-creation-control.ts", "auction-creation-runtime.ts", "trusted-release-control-context.ts"];
  const masters = Object.fromEntries(await Promise.all(masterFiles.map(async file => [file, (await ordinary(path.join(repository, "functions/src", file))).toString().replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1$2")])));
  const groups = [];
  // Validate/transform before creating any review output.
  for (const archive of receipt.archives) {
    const selected = bindings.sourceBindings.filter(value => value.sourceHash === archive.sourceHash).map(value => value.name);
    if (!selected.length) continue;
    const sourceRoot = path.join(input, `baseline-${archive.sourceHash}`);
    const pkg = JSON.parse(await ordinary(path.join(sourceRoot, "package.json")));
    if (pkg.main !== "lib/index.js" || pkg.engines?.node !== "22" || pkg.dependencies?.["firebase-admin"] !== "^14.4.0"
      || pkg.dependencies?.["firebase-functions"] !== "^7.4.0") throw new Error("Historical runtime/dependency contract changed.");
    const rows = [], found = [], direct = [];
    for (const file of await sourceFiles(path.join(sourceRoot, "src"))) {
      const original = (await ordinary(path.join(sourceRoot, "src", file))).toString();
      const result = transformHistoricalModule(original, file, selected);
      found.push(...result.found);direct.push(...result.directWrites);
      rows.push({ file, original, ...result });
    }
    if (new Set(found).size !== selected.length || found.some(name => !selected.includes(name))) throw new Error("Protected callable definition coverage differs.");
    for (const [file, text] of Object.entries(masters)) {
      const existing = rows.find(row => row.file === file);
      if (existing && existing.source !== text) throw new Error("Bridge support conflicts with original source; review required.");
    }
    groups.push({ sourceHash: archive.sourceHash, sourceRoot, selected, rows, direct });
  }
  const destination = await privateOutput(output);
  const manifest = { purpose: "historical-maintenance-bridge-review", deployable: false, deploymentApproved: false, cloudAccessed: false,
    productionModified: false, policyActivated: false, deletionEnabled: false, paymentsEnabled: false,
    projectId: productionEnvironment.projectId, region: "asia-southeast1", protectedNames: historicalProtectedNames,
    sourceBindings: bindings.sourceBindings, masterHashes: Object.fromEntries(Object.entries(masters).map(([file, text]) => [file, sha(text)])), groups: [],
    limitations: ["No deploy configuration or broad Functions selector is generated.", "Live IAM/environment preservation and post-deployment parity require separate authorization and verification.", "Every target must use its own matching historical package group.", "The current final policy enforcement source is not substituted for the historical handlers."] };
  for (const group of groups) {
    const directory = path.join(destination, `group-${group.sourceHash}`);
    await mkdir(path.join(directory, "src"), { recursive: true, mode: 0o700 });
    for (const file of ["package.json", "package-lock.json", "tsconfig.json"]) await writeFile(path.join(directory, file), await ordinary(path.join(group.sourceRoot, file)), { mode: 0o600, flag: "wx" });
    for (const row of group.rows) {
      const file = path.join(directory, "src", row.file);await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, row.source, { mode: 0o600, flag: "wx" });
    }
    for (const [file, text] of Object.entries(masters)) {
      if (!group.rows.some(row => row.file === file)) await writeFile(path.join(directory, "src", file), text, { mode: 0o600, flag: "wx" });
    }
    // Add only a separately classified public status endpoint; original onCall
    // transport/options and all unselected exports retain their original source.
    await writeFile(path.join(directory, "src/index.ts"), group.rows.find(row => row.file === "index.ts").source
      + '\nimport { historicalProtectedWriteStatus } from "./legacy-maintenance-bridge";\nimport { onCall as maintenanceStatusCall } from "firebase-functions/v2/https";\nexport const getProtectedWriteStatus = maintenanceStatusCall({ region: "asia-southeast1", maxInstances: 20 }, async () => historicalProtectedWriteStatus());\n', { mode: 0o600 });
    manifest.groups.push({ sourceHash: group.sourceHash, selected: group.selected, directory,
      originalSourceHashes: Object.fromEntries(group.rows.map(row => [row.file, sha(row.original)])),
      changes: group.rows.filter(row => row.changed).map(({ file, found, transactionSites, directWrites, factory }) => ({ file, found, transactionSites, directWrites, factory })),
      standaloneWritesMadeAtomic: group.direct });
  }
  await writeFile(path.join(destination, "historical-maintenance-bridge.review.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== "--input" || args[2] !== "--output") throw new Error("Use --input <reviewed-private-baselines> --output <new-private-review-directory>. No apply/override selector exists.");
    const manifest = await prepareHistoricalBridge(args[1], args[3]);
    console.log(JSON.stringify({ prepared: true, protectedTargets: manifest.protectedNames.length, packageGroups: manifest.groups.length, deploymentApproved: false, productionModified: false }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Historical bridge review preparation refused.");process.exitCode = 1;
  }
}
