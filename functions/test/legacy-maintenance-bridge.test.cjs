"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const app = require('firebase-admin/app'), store = require('firebase-admin/firestore');
const net = require('node:net'), http=require('node:http'),https=require('node:https');
const savedNet = [global.fetch,net.Socket.prototype.connect,http.request,http.get,https.request,https.get];
let attempts=0;const deny=()=>{attempts++;throw new Error('Network forbidden');};
global.fetch=net.Socket.prototype.connect=http.request=http.get=https.request=https.get=deny;
const descriptors=[ [app,'getApp'],[store,'getFirestore'] ].map(([m,k])=>[m,k,Object.getOwnPropertyDescriptor(m,k)]);
const envNames=new Set(['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','GCP_PROJECT','FIREBASE_CONFIG','TAKEME_RELEASE_TARGET','TAKEME_FIREBASE_PROJECT_ID','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST',...Object.keys(process.env).filter(k=>/EMULATOR/.test(k))]);
const savedEnv=Object.fromEntries([...envNames].map(k=>[k,process.env[k]]));
let project,record,exists,fail,reads,writes,firstRead;
const ref=path=>({path,firestore:db,get:async()=>snapshot(path),create:async data=>writes.push({kind:'create',path,data}),set:async(data,options)=>writes.push({kind:'set',path,data,options})});
const snapshot=path=>{reads.push(path);if(firstRead)firstRead(path);if(fail)throw new Error('read failure');return {exists,data:()=>record};};
const db={doc:ref,runTransaction:async(handler)=>{const pending=[];const tx={get:async r=>snapshot(r.path),create:(r,data)=>pending.push({kind:'create',path:r.path,data}),set:(r,data,options)=>pending.push({kind:'set',path:r.path,data,options})};const value=await handler(tx);writes.push(...pending);return value;}};
Object.defineProperty(app,'getApp',{configurable:true,value:()=>({options:{projectId:project}})});
Object.defineProperty(store,'getFirestore',{configurable:true,value:()=>db});
const bridge=require('../lib/legacy-maintenance-bridge');
const paused=()=>({releaseTarget:'demo',projectId:'demo-takeme',protectedWritesPaused:true});
const auth={auth:{uid:'synthetic-bridge-owner'}};
const rejection=e=>e.code==='failed-precondition'&&e.details?.reason==='protected-writes-paused';
function reset(){for(const k of envNames)delete process.env[k];Object.assign(process.env,{GCLOUD_PROJECT:'demo-takeme',FIRESTORE_EMULATOR_HOST:'127.0.0.1:1',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:2'});project='demo-takeme';record=undefined;exists=false;fail=false;reads=[];writes=[];firstRead=null;}

test('historical OFF/absent control needs no new flags, policy or lifecycle and preserves original result/errors',async()=>{
 for(const present of [false,true]){reset();exists=present;record={...paused(),protectedWritesPaused:false};
  assert.deepEqual(await bridge.invokeHistoricalProtectedWrite(auth,async()=>({original:true})),{original:true});
  const error=new Error('original error');await assert.rejects(bridge.invokeHistoricalProtectedWrite(auth,async()=>{throw error;}),e=>e===error);
  assert.deepEqual(reads,['releaseControls/current','releaseControls/current']);assert.equal(writes.length,0);
 }
});
test('ON wins before original handler with policy absent or active and never queues/replays',async()=>{
 for(const ignoredPolicy of ['absent','active']){reset();exists=true;record=paused();let called=0;
  await assert.rejects(bridge.invokeHistoricalProtectedWrite(auth,async()=>{called++;}),rejection);
  assert.equal(called,0,ignoredPolicy);record={...paused(),protectedWritesPaused:false};await new Promise(r=>setImmediate(r));assert.equal(called,0);
  await bridge.invokeHistoricalProtectedWrite(auth,async()=>{called++;});assert.equal(called,1);
 }
});
test('signed-out original authentication contract is unchanged and reads no control',async()=>{reset();await assert.rejects(bridge.invokeHistoricalProtectedWrite({},async()=>{throw new Error('original auth');}),/original auth/);assert.deepEqual(reads,[]);});
test('malformed present state, mismatched runtime, missing identity, and read errors fail closed',async()=>{
 for(const invalid of [null,{},undefined,{...paused(),protectedWritesPaused:'false'},{...paused(),extra:true}]){reset();exists=true;record=invalid;assert.deepEqual(await bridge.historicalProtectedWriteStatus(),{protectedWritesPaused:true});}
 reset();fail=true;await assert.rejects(bridge.invokeHistoricalProtectedWrite(auth,async()=>{}),rejection);
 reset();process.env.TAKEME_FIREBASE_PROJECT_ID='other';assert.deepEqual(await bridge.historicalProtectedWriteStatus(),{protectedWritesPaused:true});assert.deepEqual(reads,[]);
 reset();delete process.env.GCLOUD_PROJECT;project=undefined;assert.deepEqual(await bridge.historicalProtectedWriteStatus(),{protectedWritesPaused:true});
 reset();process.env.FIREBASE_CONFIG='invalid';assert.deepEqual(await bridge.historicalProtectedWriteStatus(),{protectedWritesPaused:true});
});
test('first transaction read blocks an enable race and create/merge awaits become atomic without changing arguments',async()=>{
 for(const kind of ['create','set']){reset();let count=0;firstRead=()=>{if(++count===2){exists=true;record=paused();}};
  await assert.rejects(bridge.invokeHistoricalProtectedWrite(auth,async()=>bridge.writeHistoricalMaintenanceDocument(ref('syntheticWrites/one'),kind,{value:1},{merge:true})),rejection);
  assert.equal(writes.length,0);assert.deepEqual(reads,['releaseControls/current','releaseControls/current']);
  reset();await bridge.invokeHistoricalProtectedWrite(auth,async()=>bridge.writeHistoricalMaintenanceDocument(ref('syntheticWrites/one'),kind,{value:1},{merge:true}));
  assert.equal(writes.length,1);assert.equal(writes[0].kind,kind);assert.deepEqual(writes[0].data,{value:1});if(kind==='set')assert.deepEqual(writes[0].options,{merge:true});
 }
});
test('derived/read transactions are unscoped while protected transactions read control first',async()=>{
 reset();exists=true;record=paused();await bridge.runHistoricalMaintenanceTransaction(db,async tx=>{tx.set(ref('syntheticDerived/one'),{value:1});});assert.deepEqual(reads,[]);assert.equal(writes.length,1);
 reset();await bridge.invokeHistoricalProtectedWrite(auth,()=>bridge.runHistoricalMaintenanceTransaction(db,async tx=>{await tx.get(ref('synthetic/one'));return 12;}));assert.equal(reads[0],'releaseControls/current');assert.equal(reads[1],'releaseControls/current');assert.equal(reads[2],'synthetic/one');
});
test.after(()=>{for(const[m,k,d]of descriptors)Object.defineProperty(m,k,d);for(const[k,v]of Object.entries(savedEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}[global.fetch,net.Socket.prototype.connect,http.request,http.get,https.request,https.get]=savedNet;assert.equal(attempts,0);});
