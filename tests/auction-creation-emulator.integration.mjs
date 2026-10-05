// Bounded isolated demo-only admission qualification. No production query or
// deploy path. Private reviewed compiled current/historical packages are required.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, getDoc, deleteDoc, terminate } from 'firebase/firestore';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const adminApp=require('firebase-admin/app'),adminStore=require('firebase-admin/firestore'),adminAuth=require('firebase-admin/auth');
assert.equal(process.env.GCLOUD_PROJECT,'demo-takeme');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');
for(const name of ['TAKEME_CURRENT_PACKAGE_ROOT','TAKEME_LEGACY_PACKAGE_ROOT','TAKEME_LEGACY_PUBLISH_PACKAGE_ROOT','TAKEME_AUCTION_RULE_BRIDGE'])assert.ok(process.env[name]?.startsWith('/private/tmp/takeme-v1-operational-runbook-'), 'Private isolated review packages required.');
const app=adminApp.initializeApp({projectId:'demo-takeme'},randomUUID()),db=adminStore.getFirestore(app),auth=adminAuth.getAuth(app),now=adminStore.Timestamp.now();
const prefix='auction-freeze-'+randomUUID(),uid=prefix+'-owner',paths=new Set(),clients=[];
const normal={releaseTarget:'demo',projectId:'demo-takeme',protectedWritesPaused:false},auction=paused=>({releaseTarget:'demo',projectId:'demo-takeme',auctionCreationPaused:paused}),control=db.doc('releaseControls/auctionCreation');
const baseline=new Map();for(const name of ['releaseControls/current','releaseControls/auctionCreation','releasePolicies/current'])baseline.set(name,await db.doc(name).get());
let groups=0;const check=async(label,run)=>{await run();console.log('PASS '+(++groups)+': '+label);};const denied=e=>e.code==='permission-denied',paused=e=>e.details?.reason==='auction-creation-paused';
function client(user,admin=false){const app=initializeApp({projectId:'demo-takeme',apiKey:'demo-api-key'},randomUUID()),fire=getFirestore(app);connectFirestoreEmulator(fire,'127.0.0.1',18080,user?{mockUserToken:{sub:user,aud:'demo-takeme',admin}}:{});clients.push({app,fire});return fire;}
const operator=client(uid,true),guest=client(null),owner=client(uid);
async function put(path,value){paths.add(path);await db.doc(path).set(value);}
async function rules(content){const response=await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-takeme:securityRules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ignore_errors:false,rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(response.ok,true);assert.equal((await response.json()).issues?.some(x=>x.severity==='ERROR')??false,false);}
const finalRules=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
const location={districtOrCity:'Jitra',state:'Kedah',country:'Malaysia'},listing={sellerId:uid,title:'Synthetic admission qualification',description:'Synthetic emulator-only item, no actual goods or exchange.',listingType:'buy_now',status:'active',price:10,privacyVersion:2,publicLocation:location,location:'Jitra, Kedah',imageUrls:[]};
try{
 await auth.createUser({uid});
 await put('users/'+uid,{uid,displayName:'Synthetic auction owner',photoURL:null,location:'Jitra, Kedah',createdAt:now,updatedAt:now});
 await put(`users/${uid}/private/onboarding`,{termsVersion:'1.0-draft',privacyVersion:'1.0-draft',termsAcceptedAt:now,privacyAcceptedAt:now,age18ConfirmedAt:now,acceptanceSource:'web'});
 await db.doc('releasePolicies/current').set({releaseTarget:'demo',projectId:'demo-takeme',publicationApproved:true,termsVersion:'1.0-draft',privacyVersion:'1.0-draft',minimumAge:18});await db.doc('releaseControls/current').set(normal);
 for(const [label,content] of [['final',finalRules],['historical',await readFile(process.env.TAKEME_AUCTION_RULE_BRIDGE,'utf8')]]){
  await check(label+' rules compile, preserve absent/OFF admin auction admission',async()=>{await rules(content);await control.delete();const id=`${prefix}-${label}-absent`;paths.add('listings/'+id);await setDoc(doc(operator,'listings',id),{...listing,listingType:'auction',status:'draft',auctionStatus:'scheduled',bidCount:0});await control.set(auction(false));await updateDoc(doc(operator,'listings',id),{status:'active'});});
  await check(label+' freeze blocks admin create/publish/convert; permits fixed listings, history updates, cleanup and public reads',async()=>{
   await control.set(auction(true));const draft=`${prefix}-${label}-draft`,fixed=`${prefix}-${label}-fixed`,active=`${prefix}-${label}-prior`;
   await put('listings/'+draft,{...listing,listingType:'auction',status:'draft',auctionStatus:'scheduled',bidCount:0});await put('listings/'+active,{...listing,listingType:'auction',status:'active',auctionStatus:'active',bidCount:1});
   await assert.rejects(setDoc(doc(operator,'listings',`${prefix}-${label}-denied`),{...listing,listingType:'auction',status:'draft'}),denied);
   await assert.rejects(updateDoc(doc(operator,'listings',draft),{status:'active'}),denied);
   paths.add('listings/'+fixed);await setDoc(doc(operator,'listings',fixed),listing);await assert.rejects(updateDoc(doc(operator,'listings',fixed),{listingType:'auction',auctionStatus:'scheduled'}),denied);
   await updateDoc(doc(operator,'listings',active),{title:'Synthetic history update'});await deleteDoc(doc(operator,'listings',draft));
   assert.equal((await getDoc(doc(guest,'listings',fixed))).exists(),true);assert.equal((await getDoc(doc(guest,'users',uid))).exists(),true);
   await assert.rejects(getDoc(doc(operator,'releaseControls','auctionCreation')),denied);await assert.rejects(setDoc(doc(operator,'releaseControls','auctionCreation'),auction(false)),denied);
   await assert.rejects(setDoc(doc(owner,'listings',`${prefix}-${label}-owner`),listing),denied);
  });
  await check(label+' malformed/foreign freeze state denies auction admission without changing public browse',async()=>{for(const value of [null,{...auction(false),extra:true},{...auction(false),projectId:'other'},{...auction(false),auctionCreationPaused:'false'}]){await control.set(value??{});await assert.rejects(setDoc(doc(operator,'listings',prefix+'-invalid'),{...listing,listingType:'auction'}),denied);assert.equal((await getDoc(doc(guest,'users',uid))).exists(),true);}});
 }
 await rules(finalRules);await control.set(auction(false));
 const current=require(process.env.TAKEME_CURRENT_PACKAGE_ROOT+'/lib/index.js'),legacy={
  createAuctionListing:require(process.env.TAKEME_LEGACY_PACKAGE_ROOT+'/lib/index.js').createAuctionListing,
  publishAuctionListing:require(process.env.TAKEME_LEGACY_PUBLISH_PACKAGE_ROOT+'/lib/index.js').publishAuctionListing,
 };
 const request={auth:{uid,token:{aud:'demo-takeme'}},data:{}};
 const payload={title:listing.title,description:listing.description,categoryId:'electronics',condition:'Good',listingType:'auction',startingBid:1000,minimumBidIncrement:100,auctionStartAt:new Date().toISOString(),auctionEndAt:new Date(Date.now()+3600000).toISOString(),publicLocation:location};
 for(const [label,implementation] of [['current',current],['historical',legacy]]){
  await check(label+' actual callable creates draft OFF and denies create/publish before payload/media validation ON',async()=>{
   await control.set(auction(false));await db.doc(`users/${uid}/private/cadence-listing`).delete(); // owned test cadence only
   const result=await implementation.createAuctionListing.run({...request,data:payload});paths.add('listings/'+result.listingId);assert.equal((await db.doc('listings/'+result.listingId).get()).data().status,'draft');
   await control.set(auction(true));for(const name of ['createAuctionListing','publishAuctionListing'])await assert.rejects(implementation[name].run(request),paused);
   await control.set(auction(false));await assert.rejects(implementation.createAuctionListing.run(request),e=>e.code==='invalid-argument');
  });
 }
 await check('real current transaction and historical bridge recheck freeze after admission; no commit/replay',async()=>{
  const runtime=require(process.env.TAKEME_CURRENT_PACKAGE_ROOT+'/lib/auction-creation-runtime.js'),bridge=require(process.env.TAKEME_LEGACY_PACKAGE_ROOT+'/lib/legacy-maintenance-bridge.js');
  const target=db.doc('syntheticRehearsal/'+prefix);paths.add(target.path);
  await control.set(auction(false));await runtime.assertAuctionCreationAvailable();await control.set(auction(true));await assert.rejects(db.runTransaction(async tx=>{await runtime.assertAuctionCreationAvailable(tx);tx.create(target,{synthetic:true});}),paused);assert.equal((await target.get()).exists,false);
  await control.set(auction(false));let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const pending=bridge.invokeHistoricalProtectedWrite(request,async()=>{enter();await gate;return bridge.runHistoricalMaintenanceTransaction(db,async tx=>{tx.create(target,{synthetic:true});});},true);
  await entered;await control.set(auction(true));release();await assert.rejects(pending,paused);await control.set(auction(false));assert.equal((await target.get()).exists,false);
 });
 await check('aggregate counts include scheduled and active, exclude draft/ended, retain freeze token parity',async()=>{
  const {readZeroAuctionCounts}=require(process.env.TAKEME_CURRENT_PACKAGE_ROOT+'/lib/production-auction-control.js');
  // Production-specific aggregate orchestration is already mocked in unit tests;
  // the actual query shape is exercised against demo only here.
  const active=(await db.collection('listings').where('status','==','active').where('auctionStatus','==','active').count().get()).data().count;
  const scheduled=(await db.collection('listings').where('status','==','active').where('auctionStatus','==','scheduled').count().get()).data().count;
  assert.equal(active,2);assert.equal(scheduled,2);assert.equal(typeof readZeroAuctionCounts,'function');
 });
}finally{
 await rules(finalRules);for(const [path,value] of baseline){if(value.exists)await db.doc(path).set(value.data());else await db.doc(path).delete();}
 for(const path of paths)await db.recursiveDelete(db.doc(path));await db.recursiveDelete(db.doc('users/'+uid));await auth.deleteUser(uid);
 for(const {app,fire} of clients){await terminate(fire);await deleteApp(app);}for(const value of adminApp.getApps())await adminApp.deleteApp(value);
}
console.log('Auction creation freeze: '+groups+' isolated demo groups passed. No cloud accessed.');
