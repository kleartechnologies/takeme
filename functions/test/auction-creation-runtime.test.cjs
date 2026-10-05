'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const app=require('firebase-admin/app'),store=require('firebase-admin/firestore');
const net=require('node:net'),http=require('node:http'),https=require('node:https');
const savedNet=[global.fetch,net.Socket.prototype.connect,http.request,http.get,https.request,https.get];let attempts=0;
const deny=()=>{attempts++;throw new Error('Network forbidden');};global.fetch=net.Socket.prototype.connect=http.request=http.get=https.request=https.get=deny;
const descriptors=[[app,'getApp'],[store,'getFirestore']].map(([m,k])=>[m,k,Object.getOwnPropertyDescriptor(m,k)]);
const envNames=new Set(['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','GCP_PROJECT','FIREBASE_CONFIG','TAKEME_RELEASE_TARGET','TAKEME_FIREBASE_PROJECT_ID','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST',...Object.keys(process.env).filter(k=>/EMULATOR/.test(k))]);
const savedEnv=Object.fromEntries([...envNames].map(k=>[k,process.env[k]]));
let records,project,reads,writes,fail,onRead;
const ref=path=>({path,firestore:db,get:async()=>snapshot(path)});
const snapshot=path=>{reads.push(path);if(onRead)onRead(path);if(fail)throw new Error('read failure');return {exists:records.has(path),data:()=>records.get(path)};};
const db={doc:ref,runTransaction:async handler=>{const pending=[];const tx={get:async r=>snapshot(r.path),create:(r,d)=>pending.push({path:r.path,data:d}),set:(r,d)=>pending.push({path:r.path,data:d})};const result=await handler(tx);writes.push(...pending);return result;}};
Object.defineProperty(app,'getApp',{configurable:true,value:()=>({options:{projectId:project}})});Object.defineProperty(store,'getFirestore',{configurable:true,value:()=>db});
const {assertAuctionCreationAvailable}=require('../lib/auction-creation-runtime'),bridge=require('../lib/legacy-maintenance-bridge');
const auctionPath='releaseControls/auctionCreation',maintenancePath='releaseControls/current',auction=paused=>({releaseTarget:'demo',projectId:'demo-takeme',auctionCreationPaused:paused}),auth={auth:{uid:'synthetic'}};
const paused=e=>e.code==='failed-precondition'&&e.details?.reason==='auction-creation-paused';
function reset(){for(const k of envNames)delete process.env[k];Object.assign(process.env,{GCLOUD_PROJECT:'demo-takeme',FIRESTORE_EMULATOR_HOST:'127.0.0.1:1',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:2'});project='demo-takeme';records=new Map();reads=[];writes=[];fail=false;onRead=null;}
test('uncached current guard preserves absent/OFF, rejects frozen and malformed/read-error state',async()=>{
 reset();await assertAuctionCreationAvailable();records.set(auctionPath,auction(false));await assertAuctionCreationAvailable();records.set(auctionPath,auction(true));await assert.rejects(assertAuctionCreationAvailable(),paused);
 for(const value of [null,undefined,{}, {...auction(false),extra:true},{...auction(false),projectId:'foreign'}]){records.set(auctionPath,value);await assert.rejects(assertAuctionCreationAvailable(),paused);}
 reset();fail=true;await assert.rejects(assertAuctionCreationAvailable(),paused);
 reset();process.env.GCLOUD_PROJECT='foreign';await assert.rejects(assertAuctionCreationAvailable(),paused);assert.equal(reads.length,0);
});
test('historical scoped auction handlers are denied before original validation; unrelated writes and derived/read work remain available',async()=>{
 reset();records.set(auctionPath,auction(true));let called=0;
 await assert.rejects(bridge.invokeHistoricalProtectedWrite(auth,async()=>{called++;},true),paused);assert.equal(called,0);
 await bridge.invokeHistoricalProtectedWrite(auth,async()=>{called++;});assert.equal(called,1);
 await bridge.runHistoricalMaintenanceTransaction(db,async tx=>{tx.create(ref('syntheticDerived/one'),{value:1});});assert.equal(writes.length,1);
 assert.deepEqual(reads,[maintenancePath,auctionPath,maintenancePath]);
});
test('global maintenance refusal remains first; signed-out original auth response reads no control',async()=>{
 reset();records.set(maintenancePath,{releaseTarget:'demo',projectId:'demo-takeme',protectedWritesPaused:true});records.set(auctionPath,auction(true));
 await assert.rejects(bridge.invokeHistoricalProtectedWrite(auth,async()=>{},true),e=>e.details?.reason==='protected-writes-paused');assert.deepEqual(reads,[maintenancePath]);
 reset();await assert.rejects(bridge.invokeHistoricalProtectedWrite({},async()=>{throw new Error('original auth');},true),/original auth/);assert.equal(reads.length,0);
});
test('historical auction transaction catches freeze after preflight without committing or auto-replaying',async()=>{
 reset();let count=0;onRead=path=>{if(path===auctionPath&&++count===2)records.set(auctionPath,auction(true));};
 const handler=()=>bridge.runHistoricalMaintenanceTransaction(db,async tx=>{tx.create(ref('listings/synthetic'),{status:'draft'});});
 await assert.rejects(bridge.invokeHistoricalProtectedWrite(auth,handler,true),paused);assert.equal(writes.length,0);assert.deepEqual(reads,[maintenancePath,auctionPath,maintenancePath,auctionPath]);
 onRead=null;records.set(auctionPath,auction(false));await new Promise(r=>setImmediate(r));assert.equal(writes.length,0);await bridge.invokeHistoricalProtectedWrite(auth,handler,true);assert.equal(writes.length,1);
});
test('current transaction guard rejects freeze after admission and malformed trusted runtime without writes',async()=>{
 reset();await assertAuctionCreationAvailable();records.set(auctionPath,auction(true));await assert.rejects(db.runTransaction(async tx=>{await assertAuctionCreationAvailable(tx);tx.create(ref('listings/synthetic'),{});}),paused);assert.equal(writes.length,0);
 reset();process.env.FIREBASE_CONFIG='{}';await assert.rejects(assertAuctionCreationAvailable(),paused);assert.equal(reads.length,0);
});
test.after(()=>{for(const[m,k,d]of descriptors)Object.defineProperty(m,k,d);for(const[k,v]of Object.entries(savedEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}[global.fetch,net.Socket.prototype.connect,http.request,http.get,https.request,https.get]=savedNet;assert.equal(attempts,0);});
