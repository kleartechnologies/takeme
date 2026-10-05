// Bounded real-clock lease check. Run only in an isolated demo emulator harness;
// credentials are generated in memory and owned fixtures/control are restored.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} from 'firebase/auth';
import {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
import {getStorage,connectStorageEmulator,ref,uploadBytes} from 'firebase/storage';
const require=createRequire(new URL('../functions/package.json',import.meta.url)),apps=require('firebase-admin/app'),store=require('firebase-admin/firestore'),identities=require('firebase-admin/auth'),objects=require('firebase-admin/storage');
for(const[k,v]of Object.entries({GCLOUD_PROJECT:'demo-takeme',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199'}))assert.equal(process.env[k],v);
const projectId='demo-takeme',bucketName='demo-takeme.firebasestorage.app',admin=apps.initializeApp({projectId,storageBucket:bucketName},randomUUID()),db=store.getFirestore(admin),control=db.doc('releaseControls/current'),policy=db.doc('releasePolicies/current'),beforeControl=await control.get(),beforePolicy=await policy.get();
const app=initializeApp({projectId,apiKey:'demo-api-key',storageBucket:bucketName},randomUUID()),auth=getAuth(app),functions=getFunctions(app,'asia-southeast1'),storage=getStorage(app);
connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFunctionsEmulator(functions,'127.0.0.1',5001);connectStorageEmulator(storage,'127.0.0.1',9199);
let uid,path;const call=async(name,data={})=>(await httpsCallable(functions,name)(data)).data;
try{
 uid=(await createUserWithEmailAndPassword(auth,`permit-drain-${randomUUID()}@example.test`,randomUUID()+'!Aa1')).user.uid;
 await db.doc('users/'+uid).set({uid,displayName:'Synthetic permit drain',photoURL:null,location:'',createdAt:store.Timestamp.now(),updatedAt:store.Timestamp.now()});
 await policy.set({releaseTarget:'demo',projectId,publicationApproved:true,termsVersion:'1.0-draft',privacyVersion:'1.0-draft',minimumAge:18});await control.set({releaseTarget:'demo',projectId,protectedWritesPaused:false});
 await call('acceptWebPolicies',{termsVersion:'1.0-draft',privacyVersion:'1.0-draft',acceptTerms:true,acceptPrivacy:true,confirmAge18:true});
 path=`users/${uid}/profile/synthetic-drain.png`;const issuedAt=Date.now();const {permits}=await call('requestUploadPermits',{uploads:[{path,contentType:'image/png',sizeBytes:3}]});
 const permit=(await db.doc(`users/${uid}/private/onboarding`).get()).data().uploadPermits[permits[0].permitId],expiry=permit.expiresAt.toMillis();
 assert.ok(expiry>issuedAt&&expiry-issuedAt<=125000);assert.equal(require('../functions/lib/upload-permit-domain.js').UPLOAD_PERMIT_TTL_MS,120000);assert.ok(expiry>=issuedAt+120000);assert.equal(new Date(expiry).toISOString(),permits[0].expiresAt);
 await control.set({releaseTarget:'demo',projectId,protectedWritesPaused:true});await assert.rejects(call('requestUploadPermits',{uploads:[{path,contentType:'image/png',sizeBytes:3}]}),e=>e.details?.reason==='protected-writes-paused');
 console.log('PASS 1: real 120-second lease issued; new permits blocked.');
 while(Date.now()<=expiry)await new Promise(resolve=>setTimeout(resolve,Math.min(30000,expiry-Date.now()+1)));
 await assert.rejects(uploadBytes(ref(storage,path),new Uint8Array([1,2,3]),{contentType:'image/png',customMetadata:{takemeUploadPermit:permits[0].permitId}}),e=>e.code==='storage/unauthorized');
 const projected=(await db.doc(`users/${uid}/private/onboarding`).get()).data().uploadPermits;assert.equal(Object.values(projected).filter(value=>value.expiresAt.toMillis()>Date.now()).length,0);
 console.log('PASS 2: after real-clock expiry, no active owned lease remains and upload is denied.');
}finally{
 if(beforeControl.exists)await control.set(beforeControl.data());else await control.delete();if(beforePolicy.exists)await policy.set(beforePolicy.data());else await policy.delete();
 if(path)await objects.getStorage(admin).bucket().file(path).delete({ignoreNotFound:true});if(uid){await db.recursiveDelete(db.doc('users/'+uid));await identities.getAuth(admin).deleteUser(uid);}await deleteApp(app);await apps.deleteApp(admin);
}
