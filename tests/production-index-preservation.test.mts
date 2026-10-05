import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type Mode = { queryScope: string; order?: string; arrayConfig?: string };
type Override = { collectionGroup: string; fieldPath: string; indexes: Mode[]; ttl?: boolean };
const config = JSON.parse(readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8")) as { fieldOverrides: Override[] };

// Public mode definitions captured from the production default and all nine
// named fields on 2026-10-05. Tests need no credentials or private audit files.
const inheritedModes: Mode[] = [
  { queryScope: "COLLECTION", order: "ASCENDING" },
  { queryScope: "COLLECTION", order: "DESCENDING" },
  { queryScope: "COLLECTION", arrayConfig: "CONTAINS" },
];
const groupAscending: Mode = { queryScope: "COLLECTION_GROUP", order: "ASCENDING" };
const cleanupFields = [
  ["users", "userId"], ["members", "userId"],
  ["bids", "bidderId"], ["bids", "outbidUserId"], ["bids", "retentionExpiresAt"],
  ["changes", "actorId"], ["changes", "retentionExpiresAt"],
  ["notifications", "sellerId"], ["notifications", "href"],
] as const;
const modeKey = (mode: Mode) => `${mode.queryScope}:order=${mode.order ?? "none"}:array=${mode.arrayConfig ?? "none"}`;
const modeKeys = (modes: Mode[]) => modes.map(modeKey).sort();
function override(group: string, field: string) {
  const matches = config.fieldOverrides.filter((row) => row.collectionGroup === group && row.fieldPath === field);
  assert.equal(matches.length, 1, `${group}.${field} must have one explicit configuration`);
  return matches[0];
}

for (const [group, field] of cleanupFields) {
  test(`${group}.${field} retains every inherited mode and adds deletion group ASC`, () => {
    const row = override(group, field);
    for (const mode of inheritedModes) assert.ok(row.indexes.some((entry) => modeKey(entry) === modeKey(mode)), `removes inherited ${modeKey(mode)}`);
    assert.deepEqual(modeKeys(row.indexes), modeKeys([...inheritedModes, groupAscending]));
    assert.equal(row.ttl, undefined, "index preparation must not configure TTL");
  });
}

test("existing notification time overrides stay unchanged and index preparation enables no TTL", () => {
  const existingModes = inheritedModes.filter((mode) => !mode.arrayConfig).concat(groupAscending);
  for (const field of ["createdAt", "readAt", "openedAt"]) {
    assert.deepEqual(modeKeys(override("notifications", field).indexes), modeKeys(existingModes));
  }
  assert.ok(config.fieldOverrides.every((row) => row.ttl === undefined));
});

function sources(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? sources(new URL(`${entry.name}/`, directory))
    : /\.tsx?$/.test(entry.name) ? [new URL(entry.name, directory)] : []);
}

// Inspect actual query expressions, rather than matching unrelated document
// writes, comments or transactionId payload fields. Covers the current Admin
// query alias and account-deletion groupLinked helper, plus direct/modular SDK
// query forms so reintroducing a consumer makes the historical decision fail.
function notificationGroupFields(text: string, filename = "query-audit.ts"): Set<string> {
  const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const nodes: ts.Node[] = [];
  const walk = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, walk); };
  walk(file);
  const aliases = new Set<string>();
  const literal = (expression: ts.Node | undefined) => expression && ts.isStringLiteralLike(expression) ? expression.text : undefined;
  const callName = (call: ts.CallExpression) => ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : ts.isIdentifier(call.expression) ? call.expression.text : undefined;
  const isNotificationGroup = (expression: ts.Expression): boolean => {
    if (ts.isIdentifier(expression)) return aliases.has(expression.text);
    if (!ts.isCallExpression(expression)) return false;
    if (callName(expression) === "collectionGroup") return expression.arguments.some((argument) => literal(argument) === "notifications");
    return ts.isPropertyAccessExpression(expression.expression)
      ? isNotificationGroup(expression.expression.expression)
      : expression.arguments.some(isNotificationGroup);
  };
  let changed: boolean;
  do {
    changed = false;
    for (const node of nodes) if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && !aliases.has(node.name.text) && isNotificationGroup(node.initializer)) {
      aliases.add(node.name.text); changed = true;
    }
  } while (changed);
  const fields = new Set<string>();
  const addField = (argument: ts.Node | undefined) => {
    const field = literal(argument);
    assert.ok(field, `${filename}: dynamic notification group field needs an explicit query audit`);
    fields.add(field);
  };
  for (const node of nodes) if (ts.isCallExpression(node)) {
    const name = callName(node);
    if (name === "groupLinked" && literal(node.arguments[0]) === "notifications") {
      assert.ok(node.arguments[1] && ts.isArrayLiteralExpression(node.arguments[1]), `${filename}: dynamic groupLinked fields need an explicit query audit`);
      node.arguments[1].elements.forEach(addField);
    } else if ((name === "where" || name === "orderBy") && ts.isPropertyAccessExpression(node.expression) && isNotificationGroup(node.expression.expression)) {
      addField(node.arguments[0]);
    } else if (name === "dated" && node.arguments[0] && isNotificationGroup(node.arguments[0])) {
      addField(node.arguments[1]);
    } else if (name === "query" && node.arguments[0] && isNotificationGroup(node.arguments[0])) {
      for (const constraint of node.arguments.slice(1)) if (ts.isCallExpression(constraint) && ["where", "orderBy"].includes(callName(constraint) ?? "")) addField(constraint.arguments[0]);
    }
  }
  return fields;
}

test("historical override removal is checked against current notification group consumers", () => {
  const fields = new Set<string>();
  for (const file of [...sources(new URL("../functions/src/", import.meta.url)), ...sources(new URL("../src/", import.meta.url))]) {
    for (const field of notificationGroupFields(readFileSync(file, "utf8"), file.pathname)) fields.add(field);
  }
  for (const field of ["href", "sellerId", "createdAt", "readAt", "openedAt"]) assert.ok(fields.has(field), `auditor must find the current ${field} consumer`);
  assert.equal(fields.has("transactionId"), false, "a current group query would require retaining/reviewing the historical override");
  assert.equal(config.fieldOverrides.some((row) => row.collectionGroup === "notifications" && row.fieldPath === "transactionId"), false);
});

test("historical query audit detects direct, aliased, helper and modular SDK consumers", () => {
  for (const query of [
    `db.collectionGroup("notifications").where("transactionId", "==", id);`,
    `const notices = db.collectionGroup("notifications"); notices.where("transactionId", "==", id);`,
    `groupLinked("notifications", ["transactionId"], [id]);`,
    `query(collectionGroup(db, "notifications"), where("transactionId", "==", id));`,
  ]) assert.equal(notificationGroupFields(query).has("transactionId"), true, query);
});
