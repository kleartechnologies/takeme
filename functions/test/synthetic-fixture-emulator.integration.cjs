// Explicit local-only Firestore integration; no production/project credentials.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const firestore = require('firebase-admin/firestore');
const app = require('firebase-admin/app'), auth = require('firebase-admin/auth'), storage = require('firebase-admin/storage');
const { SYNTHETIC_FIXTURE:f, SYNTHETIC_AUDIT_ID } = require('../lib/synthetic-fixture-domain');
assert.equal(process.env.TAKEME_LOCAL_CLEANUP_INTEGRATION,'127.0.0.1:8080');
const db = new firestore.Firestore({projectId:'demo-takeme-synthetic-cleanup',host:'127.0.0.1:8080',ssl:false});
Object.defineProperty(firestore,'getFirestore',{value:()=>db});
Object.defineProperty(app,'getApp',{value:()=>({options:{projectId:f.projectId,storageBucket:f.bucket}})});
Object.defineProperty(auth,'getAuth',{value:()=>({async verifyIdToken(token,checkRevoked){assert.equal(token,'offline-placeholder');assert.equal(checkRevoked,true);return {uid:'offline-admin',admin:true,exp:Math.floor(Date.now()/1000)+3600};},async getUser(){return {disabled:false,customClaims:{admin:true}};}})});
let present=true, physicalDeletes=0;
const file={name:f.objectPath,metadata:{name:f.objectPath,generation:f.objectGeneration,size:f.objectSize,contentType:f.contentType},async delete(options){assert.equal(options.ifGenerationMatch,f.objectGeneration);if(present){physicalDeletes++;present=false;}}};
Object.defineProperty(storage,'getStorage',{value:()=>({bucket:()=>({async getFiles(){return [present?[file]:[],null];}})})});
process.env.GCLOUD_PROJECT=f.projectId;process.env.TAKEME_RELEASE_TARGET='production';process.env.TAKEME_FIREBASE_PROJECT_ID=f.projectId;process.env.TAKEME_STORAGE_BUCKETS=f.bucket;
// Only runtime identity collaborators are faked. The Firestore client is explicitly
// pinned to local transport and a separate demo project; production code still denies emulator env.
delete process.env.FIRESTORE_EMULATOR_HOST;
const {cleanupApprovedSyntheticFixture:endpoint}=require('../lib/synthetic-fixture-cleanup');
const request={auth:{uid:'offline-admin',token:{admin:true}},data:{listingId:f.listingId},rawRequest:{headers:{authorization:'Bearer offline-placeholder'}}};
const listing=db.doc('listings/'+f.listingId), audit=db.doc('adminAuditEvents/'+SYNTHETIC_AUDIT_ID), shared=db.doc('offers/offline-shared-offer'), unrelated=db.doc('listings/offline-unrelated');
after(async()=>{await Promise.all([listing.delete(),audit.delete(),shared.delete(),unrelated.delete()]);await db.terminate();});
test('real Firestore concurrent retries create one audit and preserve unknown counterparty history',async()=>{
 assert.equal((await listing.get()).exists,false,'Do not overwrite an existing emulator fixture');assert.equal((await audit.get()).exists,false);
 await listing.set({sellerId:f.ownerUid,title:f.title,description:f.description,listingType:'buy_now',status:'active',createdAt:firestore.Timestamp.fromDate(new Date(f.createdAt)),imageUrls:[`https://firebasestorage.googleapis.com/v0/b/${f.bucket}/o/${encodeURIComponent(f.objectPath)}?alt=media`]});
 await shared.set({listingId:f.listingId,sellerId:f.ownerUid,buyerId:'unknown-counterparty',status:'expired'});await unrelated.set({sellerId:'unrelated-user',status:'active'});
 const baseline=(await shared.get()).data();const results=await Promise.all([endpoint.run(request),endpoint.run(request)]);
 assert(results.every(x=>x.status==='removed'&&x.mediaComplete&&x.historicalReferencesPreserved));assert.equal((await listing.get()).data().status,'removed');assert.equal((await audit.get()).data().summary.mediaComplete,true);assert.equal((await db.collection('adminAuditEvents').where('resourceId','==',f.listingId).get()).size,1);assert.equal(physicalDeletes,1);assert.deepEqual((await shared.get()).data(),baseline);assert.equal((await unrelated.get()).data().status,'active');
 const event=(await audit.get()).data();assert.equal((await endpoint.run(request)).alreadyRemoved,true);assert.deepEqual((await audit.get()).data(),event);
});
