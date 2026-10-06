// Actual historical packages must be composed by the private, review-only
// emulator harness. No production resources or captured source are checked in.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} from 'firebase/auth';
import {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
import {assertHistoricalEmulatorPackages} from './helpers/historical-emulator-packages.mjs';
await assertHistoricalEmulatorPackages(process.env, ['TAKEME_LEGACY_PACKAGE_ROOT']);
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const adminApp=require('firebase-admin/app'),adminStore=require('firebase-admin/firestore'),adminAuth=require('firebase-admin/auth');
const names=`cancelAuction cancelPromotionRequest confirmTransactionCompletion createAuctionListing createFixedListingDraft createPromotionRequest declineTransactionCancellation deleteSavedSearch disputeTransaction markAllNotificationsRead markConversationSeen markNotificationRead openListingConversation openNotification openTransactionConversation placeBid publishAuctionListing publishFixedListing removeFixedListing reportPublicReview requestTransactionCancellation respondToOffer saveSearch sendConversationMessage setSellerFollow setNotificationPreference submitMarketplaceReport submitOffer submitTransactionReview trackMarketplaceEvent trackPromotionEngagement updateAdminReport updateAuctionListing updateFixedListing requestUploadPermits`.split(' ');
for(const[k,v]of Object.entries({GCLOUD_PROJECT:'demo-takeme',GOOGLE_CLOUD_PROJECT:'demo-takeme',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}))assert.equal(process.env[k],v);
const projectId='demo-takeme',admin=adminApp.initializeApp({projectId},randomUUID()),db=adminStore.getFirestore(admin),control=db.doc('releaseControls/current'),policy=db.doc('releasePolicies/current');
// Direct imports of historical handlers use the SDK's default app; keep it
// explicitly demo-scoped even though the harness itself uses a named app.
if(!adminApp.getApps().some(app=>app.name==='[DEFAULT]'))adminApp.initializeApp({projectId});
const initialControl=await control.get(),initialPolicy=await policy.get(),normal={releaseTarget:'demo',projectId,protectedWritesPaused:false},prefix='legacy-'+randomUUID(),paths=new Set(),people=[];
let groups=0;const check=async(label,run)=>{await run();console.log('PASS '+(++groups)+': '+label);};
const paused=e=>e.details?.reason==='protected-writes-paused';
async function put(path,value){paths.add(path);await db.doc(path).set(value);}
async function client(label){const app=initializeApp({projectId,apiKey:'demo-api-key',authDomain:'demo-takeme.firebaseapp.com'},randomUUID()),auth=getAuth(app),functions=getFunctions(app,'asia-southeast1');connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFunctionsEmulator(functions,'127.0.0.1',5001);const uid=(await createUserWithEmailAndPassword(auth,`${label}-${prefix}@example.test`,randomUUID()+'!Aa1')).user.uid;const person={app,uid,call:async(name,data={})=>(await httpsCallable(functions,name)(data)).data};people.push(person);await put('users/'+uid,{uid,displayName:'Synthetic legacy owner',photoURL:null,location:'Jitra, Kedah',createdAt:adminStore.Timestamp.now(),updatedAt:adminStore.Timestamp.now()});return person;}
const location={districtOrCity:'Jitra',state:'Kedah',country:'Malaysia'},listingId=prefix+'-item';
const draft={title:'Synthetic legacy rehearsal listing',description:'Synthetic emulator item only. No actual goods or exchange.',categoryId:'electronics',condition:'Good',price:100,listingType:'buy_now',publicLocation:location,meetupLocationId:null};
try{
 const seller=await client('seller'),buyer=await client('buyer');let conversationId;
 await policy.delete();await control.delete();
 await put('listings/'+listingId,{...draft,sellerId:seller.uid,status:'active',imageUrls:[],privacyVersion:2,location:'Jitra, Kedah',createdAt:adminStore.Timestamp.now(),updatedAt:adminStore.Timestamp.now()});
 await check('OFF + absent policy preserves actual legacy draft/Chat/keyless message/Offer/Follow contracts',async()=>{
  const created=await seller.call('createFixedListingDraft',draft);paths.add('listings/'+created.listingId);assert.equal((await db.doc('listings/'+created.listingId).get()).data().status,'draft');
  ({conversationId}=await buyer.call('openListingConversation',{listingId}));paths.add('conversations/'+conversationId);
  const message=await buyer.call('sendConversationMessage',{conversationId,body:'Synthetic original keyless message.'});assert.ok(message.messageId);
  const offer=await buyer.call('submitOffer',{listingId,type:'offer',amountSen:9000,paymentMethod:'cod'});paths.add('offers/'+offer.offerId);paths.add(`offerLocks/${listingId}_${buyer.uid}`);assert.ok(offer.offerId);
  assert.equal((await buyer.call('setSellerFollow',{sellerId:seller.uid,following:true})).following,true);
 });
 await check('maintenance ON + absent policy rejects all 35 actual regional historical callables before validation',async()=>{await control.set({...normal,protectedWritesPaused:true});for(const name of names)await assert.rejects(buyer.call(name),paused,name);});
 await check('ON + active policy still rejects all 35 and preserves private existing history/public seller projection',async()=>{await policy.set({releaseTarget:'demo',projectId,publicationApproved:true,termsVersion:'1.0-draft',privacyVersion:'1.0-draft',minimumAge:18});for(const name of names)await assert.rejects(buyer.call(name),paused,name);assert.equal((await buyer.call('getConversationMessages',{conversationId})).items.length,1);assert.equal((await buyer.call('getPublicSellerSummaries',{sellerIds:[seller.uid]})).sellers.length,1);assert.equal((await buyer.call('getPublicListingDetail',{listingId})).listing.title,draft.title);assert.equal((await buyer.call('getFollowState',{sellerId:seller.uid})).following,true);});
 await check('malformed control fails closed without corrupting original records',async()=>{for(const patch of [{protectedWritesPaused:'false'},{extra:true},{projectId:'other'},{releaseTarget:'staging'}]){await control.set({...normal,...patch});await assert.rejects(buyer.call('sendConversationMessage',{conversationId,body:'Not committed.'}),paused);}assert.equal((await db.collection(`conversations/${conversationId}/messages`).get()).size,1);});
 await check('OFF does not replay; only another explicit legacy call adds one message',async()=>{await control.set(normal);await new Promise(resolve=>setImmediate(resolve));assert.equal((await db.collection(`conversations/${conversationId}/messages`).get()).size,1);await buyer.call('sendConversationMessage',{conversationId,body:'Synthetic manual retry.'});assert.equal((await db.collection(`conversations/${conversationId}/messages`).get()).size,2);});
 await check('actual historical auction scheduler keeps original clocks/highest bidder during ON',async()=>{
  assert.ok(process.env.TAKEME_LEGACY_PACKAGE_ROOT?.startsWith('/private/tmp/'),'Private reviewed historical package required.');
  const { _test }=require(process.env.TAKEME_LEGACY_PACKAGE_ROOT+'/lib/index.js');
  const now=adminStore.Timestamp.now(),expired=adminStore.Timestamp.fromMillis(now.toMillis()-1000),start=adminStore.Timestamp.fromMillis(now.toMillis()-60000),end=adminStore.Timestamp.fromMillis(now.toMillis()+3600000);
  const ending=prefix+'-ending',starting=prefix+'-starting';
  await control.set({...normal,protectedWritesPaused:true});
  await put('listings/'+ending,{...draft,sellerId:seller.uid,listingType:'auction',status:'active',auctionStatus:'active',auctionStartAt:start,auctionEndAt:expired,startingBid:10000,currentBid:10500,currentBidderId:buyer.uid,bidCount:1,minimumBidIncrement:100});
  await put('listings/'+starting,{...draft,sellerId:seller.uid,listingType:'auction',status:'active',auctionStatus:'scheduled',auctionStartAt:start,auctionEndAt:end,startingBid:10000,currentBid:0,bidCount:0,minimumBidIncrement:100});
  await _test.advanceDueAuctions(now);
  const ended=(await db.doc('listings/'+ending).get()).data(),started=(await db.doc('listings/'+starting).get()).data();
  assert.equal(ended.winnerId,buyer.uid);assert.equal(ended.finalBid,10500);assert.equal(ended.auctionEndAt.toMillis(),expired.toMillis());assert.equal(started.auctionStatus,'active');assert.equal(started.auctionEndAt.toMillis(),end.toMillis());
  await assert.rejects(buyer.call('placeBid',{listingId:starting,amount:10100}),paused);
  await control.set(normal);
 });
 await check('real in-flight bridge request rereads ON before committing its transaction',async()=>{
  const bridge=require(process.env.TAKEME_LEGACY_PACKAGE_ROOT+'/lib/legacy-maintenance-bridge.js');
  let enter,release;const entered=new Promise(resolve=>{enter=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const target=db.doc('syntheticRehearsal/'+prefix);paths.add(target.path);
  await control.set(normal);
  const pending=bridge.invokeHistoricalProtectedWrite({auth:{uid:buyer.uid}},async()=>{enter();await gate;return bridge.runHistoricalMaintenanceTransaction(db,async tx=>{tx.create(target,{synthetic:true});});});
  await entered;await control.set({...normal,protectedWritesPaused:true});release();await assert.rejects(pending,paused);
  assert.equal((await target.get()).exists,false);
  await control.set(normal);assert.equal((await target.get()).exists,false);
  await bridge.invokeHistoricalProtectedWrite({auth:{uid:buyer.uid}},()=>bridge.runHistoricalMaintenanceTransaction(db,async tx=>{tx.create(target,{synthetic:true});}));assert.equal((await target.get()).exists,true);
 });
 await check('existing policy-aware upload preparation retains policy checks when OFF',async()=>{await policy.delete();await assert.rejects(buyer.call('requestUploadPermits'),e=>['policy-release-unavailable','account-policy-required'].includes(e.details?.reason));});
}finally{
 if(initialControl.exists)await control.set(initialControl.data());else await control.delete();if(initialPolicy.exists)await policy.set(initialPolicy.data());else await policy.delete();
 for(const path of paths)await db.recursiveDelete(db.doc(path));for(const person of people){for(const name of ['sellerFollowers','sellerFollowSummaries','notificationSummaries','notificationPreferences','accountLifecycles','userInterests'])await db.recursiveDelete(db.doc(name+'/'+person.uid));await adminAuth.getAuth(admin).deleteUser(person.uid);await deleteApp(person.app);}for(const app of adminApp.getApps())await adminApp.deleteApp(app);
}
console.log('Historical callable bridge: '+groups+' demo groups passed; owned synthetic data removed.');
