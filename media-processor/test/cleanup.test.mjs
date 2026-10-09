import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanupMedia } from "../cleanup.mjs";
test("cleanup is bounded and preserves retained images; failed deletion is retriable",async()=>{
  const deleted=[];const adapter={candidates:async(_,limit)=>{assert.equal(limit,100);return [{imageId:"live"},{imageId:"abandoned"}];},claimCleanup:async id=>id!=="live",removeOwned:async op=>deleted.push(op.imageId),finishCleanup:async id=>deleted.push("finished:"+id)};
  assert.equal(await cleanupMedia(adapter),1);assert.deepEqual(deleted,["abandoned","finished:abandoned"]);
  adapter.removeOwned=async()=>{throw Error("storage unavailable");};await assert.rejects(cleanupMedia(adapter));assert.equal(deleted.length,2);
  adapter.candidates=async()=>Array(101).fill({});await assert.rejects(cleanupMedia(adapter));
});
