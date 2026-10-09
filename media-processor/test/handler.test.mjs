import { test } from "node:test";
import assert from "node:assert/strict";
import { processFinalized } from "../handler.mjs";
const event = { bucket:"demo",name:"users/owner/listing-media-staging/one/source",generation:"1" };
function fixture(){
  let state="CLAIMED";const files=new Map(),events=[];
  const adapter={bucket:"demo",claim:async()=>({status:state,digest:"a".repeat(64),sizeBytes:3,lease:"lease"}),download:async()=>Buffer.from("raw"),putImmutable:async(p,v)=>{if(files.has(p))assert.deepEqual(files.get(p),v);else files.set(p,v);},commit:async()=>{events.push("commit");state="READY";},fail:async()=>{state="FAILED";events.push("fail");},removeRaw:async()=>events.push("remove")};
  const decode=async()=>({width:20,height:30,variants:Object.fromEntries(["thumbnail","card","detail"].map(n=>[n,{bytes:Buffer.from(n),digest:n}]))});
  return {adapter,decode,files,events};
}
test("generation retries produce exactly three immutable paths; commit precedes original deletion",async()=>{
  const f=fixture();assert.equal(await processFinalized(event,f.adapter,f.decode),"ready");assert.equal(await processFinalized(event,f.adapter,f.decode),"duplicate");assert.equal(f.files.size,3);assert.deepEqual(f.events,["commit","remove","remove"]);
});
test("one corrupt photo fails without disturbing other ready operations",async()=>{
  const f=fixture();assert.equal(await processFinalized(event,f.adapter,async()=>{throw Error("corrupt");}),"failed");assert.equal(f.files.size,0);assert.deepEqual(f.events,["fail","remove"]);
  const g=fixture();assert.equal(await processFinalized({...event,name:event.name.replace("one","two")},g.adapter,g.decode),"ready");
});
test("metadata commit/read outages retain raw input for retry; unrelated objects are ignored",async()=>{
  const f=fixture();f.adapter.commit=async()=>{throw Error("unavailable");};await assert.rejects(processFinalized(event,f.adapter,f.decode));assert.equal(f.events.length,0);
  assert.equal(await processFinalized({...event,name:"privateEvidence/photo"},f.adapter),"ignored");await assert.rejects(processFinalized({...event,bucket:"other"},f.adapter));
});

test("transient derivative failure retries immutable outputs without deleting raw input",async()=>{
  const f=fixture(), save=f.adapter.putImmutable;let failOnce=true;
  f.adapter.putImmutable=async(path,variant)=>{if(path.endsWith("/card.webp") && failOnce){failOnce=false;throw Error("transient storage failure");}await save(path,variant);};
  await assert.rejects(processFinalized(event,f.adapter,f.decode));
  assert.equal(f.files.size,1);assert.deepEqual(f.events,[]);
  assert.equal(await processFinalized(event,f.adapter,f.decode),"ready");
  assert.equal(f.files.size,3);assert.deepEqual(f.events,["commit","remove"]);
});
test("out-of-order completion and one failure preserve independent selected image identities",async()=>{
  const selected=Array.from({length:8},(_,i)=>`photo${i}`), completed=new Map();
  // Model slow cover and independent failure: result ordering remains a consumer
  // responsibility; the processor writes only the operation's stable image ID.
  for(const index of [7,3,1,6,4,2,5,0]) {
    const f=fixture(),id=selected[index],fault=index===4;
    const result=await processFinalized({...event,name:event.name.replace("one",id)},f.adapter,fault?async()=>{throw Error("corrupt");}:f.decode);
    completed.set(id,{result,paths:[...f.files.keys()]});
  }
  assert.deepEqual(selected.filter(id=>completed.get(id).result==="ready"),["photo0","photo1","photo2","photo3","photo5","photo6","photo7"]);
  assert.equal(completed.get("photo4").paths.length,0);
  for(const id of selected.filter(id=>id!=="photo4"))assert.ok(completed.get(id).paths.every(path=>path.includes(`/listing-media/${id}/`)));
  const replacement=fixture();assert.equal(await processFinalized({...event,name:event.name.replace("one","replacement")},replacement.adapter,replacement.decode),"ready");assert.equal(replacement.files.size,3);
});

test("processor passes claimed MIME to pixel validation before any immutable output", async () => {
  const f = fixture(); f.adapter.claim = async () => ({ status: "CLAIMED", digest: "a".repeat(64), sizeBytes: 3, lease: "lease", contentType: "image/png" });
  let mime;
  assert.equal(await processFinalized(event, f.adapter, async (bytes, digest, claimedMime) => { mime = claimedMime; throw Error("mime-mismatch"); }), "failed");
  assert.equal(mime, "image/png"); assert.equal(f.files.size, 0); assert.deepEqual(f.events, ["fail", "remove"]);
});
