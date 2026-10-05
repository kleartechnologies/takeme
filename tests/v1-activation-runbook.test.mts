import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("current operator runbook keeps 36 ordered checkpoints and distinguishes paused negatives from post-reopen auction smoke", async () => {
  const doc = await readFile(new URL("../docs/v1-production-activation-runbook.md", import.meta.url), "utf8");
  const sequence = doc.slice(doc.indexOf('### PRECHECK'), doc.indexOf('## Abort / compatible recovery'));
  assert.deepEqual([...sequence.matchAll(/^(\d+)\. \*\*/gm)].map(match => Number(match[1])), Array.from({ length: 36 }, (_, i) => i + 1));
  for (const marker of ['900 seconds', '60–90 minutes', '21m05s', '22m13s', '57m57s', '31m49s', 'KEEP WRITES PAUSED', 'published scheduled', 'No partial reopen', 'effective pause', 'publicationApproved=false', 'actual production launch date']) assert.ok(doc.includes(marker), marker);
  assert.ok(sequence.indexOf('Production health') < sequence.indexOf('Prevent new auctions'));
  assert.ok(sequence.indexOf('Global maintenance OFF') < sequence.indexOf('Restore auction creation'));
  assert.match(sequence, /PROTECTED MARKETPLACE TESTS HERE ARE NEGATIVE/);
  assert.match(sequence, /Positive bid behavior uses existing emulator evidence/);
  assert.match(doc, /not installed or enabled/);
});
