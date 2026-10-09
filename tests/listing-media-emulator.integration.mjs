import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from "firebase/storage";
import { readFile } from "node:fs/promises";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const apps=require("firebase-admin/app"), stores=require("firebase-admin/firestore"), objects=require("firebase-admin/storage");
for(const [key,value] of Object.entries({GCLOUD_PROJECT:"demo-takeme",FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",FIREBASE_STORAGE_EMULATOR_HOST:"127.0.0.1:9199"})) assert.equal(process.env[key],value);
const bucketName="demo-takeme.firebasestorage.app", admin=apps.initializeApp({projectId:"demo-takeme",storageBucket:bucketName},randomUUID()), db=stores.getFirestore(admin), bucket=objects.getStorage(admin).bucket();
const app=initializeApp({projectId:"demo-takeme",apiKey:"demo-api-key",storageBucket:bucketName},randomUUID()), auth=getAuth(app), functions=getFunctions(app,"asia-southeast1"), storage=getStorage(app);
connectAuthEmulator(auth,"http://127.0.0.1:9099",{disableWarnings:true});connectFunctionsEmulator(functions,"127.0.0.1",5001);connectStorageEmulator(storage,"127.0.0.1",9199);
const call=async(name,data={})=>(await httpsCallable(functions,name)(data)).data;
try {
  await db.doc("releasePolicies/current").set({releaseTarget:"demo",projectId:"demo-takeme",publicationApproved:true,termsVersion:"1.0-draft",privacyVersion:"1.0-draft",minimumAge:18});
  await db.doc("releaseControls/current").set({releaseTarget:"demo",projectId:"demo-takeme",protectedWritesPaused:false});
  const uid=(await createUserWithEmailAndPassword(auth,`media-${randomUUID()}@example.test`,randomUUID()+"!Aa1")).user.uid;
  await db.doc(`users/${uid}`).set({uid,displayName:"Synthetic media owner",profileReady:true});
  await call("acceptWebPolicies",{termsVersion:"1.0-draft",privacyVersion:"1.0-draft",acceptTerms:true,acceptPrivacy:true,confirmAge18:true});
  const bytes=await readFile(process.env.TAKEME_SYNTHETIC_MEDIA_FIXTURE),digest=createHash("sha256").update(bytes).digest("hex"),imageId=randomUUID();
  const issued=await call("beginListingMedia",{imageId,digest,contentType:"image/png",sizeBytes:bytes.length});
  assert.equal(issued.path,`users/${uid}/listing-media-staging/${imageId}/source`);
  const upload=async(extra={})=>{
    const token=await auth.currentUser.getIdToken();
    return fetch("http://127.0.0.1:5001/demo-takeme/asia-southeast1/uploadListingMediaSource",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"image/png","X-Takeme-Image":imageId,"X-Takeme-Permit":issued.permitId,...extra},body:bytes});
  };
  assert.equal((await upload()).status,202);
  assert.equal((await upload()).status,202,"Retry verifies identical existing object without overwrite");
  await assert.rejects(uploadBytes(ref(storage,issued.path),bytes,{contentType:"image/png",customMetadata:{takemeUploadPermit:issued.permitId}}),e=>e.code==="storage/unauthorized");
  await assert.rejects(getBytes(ref(storage,issued.path)),e=>e.code==="storage/unauthorized");
  const [metadata]=await bucket.file(issued.path).getMetadata();
  assert.equal(metadata.metadata?.firebaseStorageDownloadTokens,undefined,"Raw broker must not mint a public token");
  assert.equal((await upload({"X-Takeme-Permit":"wrong"})).status,403);
  assert.equal((await upload({Origin:"https://unapproved.example"})).status,403);
  assert.equal((await fetch("http://127.0.0.1:5001/demo-takeme/asia-southeast1/uploadListingMediaSource",{method:"POST",headers:{"Content-Type":"image/png"},body:bytes})).status,403);
  console.log("PASS: private raw upload, exact permit, overwrite denial, no public raw download token.");

  assert.equal((await upload({"Content-Type":"image/jpeg"})).status,403);
  const accountRef=db.doc(`users/${uid}/private/onboarding`), originalAccount=(await accountRef.get()).data();
  const expired={...originalAccount.uploadPermits,[issued.permitId]:{...originalAccount.uploadPermits[issued.permitId],expiresAt:stores.Timestamp.fromMillis(1)}};
  await accountRef.update({uploadPermits:expired});assert.equal((await upload()).status,403);await accountRef.set(originalAccount);
  await accountRef.update({privacyVersion:"unaccepted"});assert.equal((await upload()).status,403);await accountRef.set(originalAccount);
  await db.doc(`accountLifecycles/${uid}`).set({state:"deletion_pending"});assert.equal((await upload()).status,403);await db.doc(`accountLifecycles/${uid}`).delete();
  const otherApp=initializeApp(app.options,randomUUID()),otherAuth=getAuth(otherApp);connectAuthEmulator(otherAuth,"http://127.0.0.1:9099",{disableWarnings:true});
  await createUserWithEmailAndPassword(otherAuth,`other-${randomUUID()}@example.test`,randomUUID()+"!Aa1");
  const wrong=await fetch("http://127.0.0.1:5001/demo-takeme/asia-southeast1/uploadListingMediaSource",{method:"POST",headers:{Authorization:`Bearer ${await otherAuth.currentUser.getIdToken()}`,"Content-Type":"image/png","X-Takeme-Image":imageId,"X-Takeme-Permit":issued.permitId},body:bytes});assert.equal(wrong.status,403);await deleteApp(otherApp);
  for(const bad of [{sizeBytes:0},{sizeBytes:30*1024*1024+1},{contentType:"image/svg+xml"},{imageId:"../wrong"}])await assert.rejects(call("beginListingMedia",{imageId:randomUUID(),digest,contentType:"image/png",sizeBytes:bytes.length,...bad}));
  console.log("PASS: wrong identity/path/MIME/size, expired permit, missing eligibility and deletion_pending deny.");
  if(process.env.TAKEME_MEDIA_TEST_CONTAINER){
    assert.equal(process.env.TAKEME_MEDIA_TEST_CONTAINER,"takeme-media-local");
    const trigger=()=>{const event={bucket:bucketName,name:issued.path,generation:metadata.generation,size:metadata.size,contentType:metadata.contentType,timeCreated:metadata.timeCreated};return Number(execFileSync("docker",["--context","colima-takeme-media","exec","takeme-media-local","node","--input-type=module","-e",`const r=await fetch("http://127.0.0.1:8088/",{method:"POST",headers:{"ce-type":"google.cloud.storage.object.v1.finalized"},body:JSON.stringify(${JSON.stringify(event)})});console.log(r.status);`],{encoding:"utf8"}).trim());};
    await db.doc("releaseControls/current").update({protectedWritesPaused:true});assert.equal(trigger(),503);assert.equal((await db.doc(`mediaOperations/${imageId}`).get()).data().status,"UPLOADING");
    assert.equal((await upload()).status,403,"Paused broker denies even existing exact upload");
    await db.doc("releaseControls/current").update({protectedWritesPaused:false});assert.equal(trigger(),204);
    const ready=(await db.doc(`mediaOperations/${imageId}`).get()).data();assert.equal(ready.status,"READY");assert.equal((await bucket.file(issued.path).exists())[0],false);assert.equal(trigger(),204,"Duplicate finalized event is idempotent");
    for(const path of [ready.thumbnailPath,ready.cardPath,ready.detailPath]){const [m]=await bucket.file(path).getMetadata();assert.equal(m.metadata?.firebaseStorageDownloadTokens,undefined);assert.equal(m.cacheControl,"private,no-store","READY draft derivatives must not enter a shared public cache");await assert.rejects(uploadBytes(ref(storage,path),bytes,{contentType:"image/png"}),e=>e.code==="storage/unauthorized");}
    assert.ok((await getBytes(ref(storage,ready.thumbnailPath))).byteLength>0,"Owner can read a private READY preview using authenticated SDK");
    const draftUrl=`http://127.0.0.1:9199/v0/b/${bucketName}/o/${encodeURIComponent(ready.thumbnailPath)}?alt=media`;
    assert.equal((await fetch(draftUrl)).status,403,"Anonymous draft derivative access stays denied");
    const listingId=(await call("createFixedListingDraft",{title:"Synthetic media qualification",description:"Only an isolated local emulator test, no real sale.",categoryId:"electronics",condition:"Good",price:20,listingType:"buy_now",publicLocation:{districtOrCity:"Jitra",state:"Kedah",country:"Malaysia"}})).listingId;
    const url=`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(ready.detailPath)}?alt=media`;
    await db.doc(`mediaOperations/${imageId}`).update({status:"PROCESSING"});await assert.rejects(call("publishFixedListing",{listingId,imageUrls:[url]}));await db.doc(`mediaOperations/${imageId}`).update({status:"READY"});
    await call("publishFixedListing",{listingId,imageUrls:[url]});const item=(await db.doc(`listings/${listingId}`).get()).data();assert.equal(item.status,"active");assert.equal(item.mediaImages[0].imageId,imageId);assert.equal(item.mediaImages[0].coverOrder,0);
    const publicUrl=`http://127.0.0.1:9199/v0/b/${bucketName}/o/${encodeURIComponent(ready.cardPath)}?alt=media`;
    assert.equal((await fetch(publicUrl)).status,200);await db.doc(`listings/${listingId}`).update({status:"removed"});assert.equal((await fetch(publicUrl)).status,403);
    console.log("PASS: actual Linux processor, maintenance ON/OFF, raw deletion, idempotence, READY publication gate, private draft/public derivatives and removal privacy.");
  }

  await db.doc("releaseControls/current").set({releaseTarget:"demo",projectId:"demo-takeme",protectedWritesPaused:true});
  await assert.rejects(call("beginListingMedia",{imageId:randomUUID(),digest,contentType:"image/png",sizeBytes:bytes.length}),e=>e.details?.reason==="protected-writes-paused");
  console.log("PASS: maintenance stops new media permits.");
} finally { await deleteApp(app); await apps.deleteApp(admin); }
