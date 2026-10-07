import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectConsumerPhoto, requirePhotoDimensions } from '../src/lib/consumer-photo.ts';
import { newListingSubmission, runListingSubmission, validListingSubmission } from '../src/lib/listing-submission.ts';
import { installSellHistory } from '../src/lib/sell-history.ts';
import { restoredSellStep, switchedSellValues, incompatibleSellFields, SELL_STEPS, validateSellStep, type SellValues } from '../src/lib/sell-flow.ts';
import { validRecoveryDraft } from '../src/lib/transient-recovery.ts';
const values:SellValues={title:'Synthetic camera',description:'Synthetic product description for tests.',categoryId:'electronics',condition:'Good',price:'80',districtOrCity:'Jitra',state:'Kedah',meetupLocationId:'',saveLocationToProfile:false,listingType:'buy_now',startingBid:'',minimumBidIncrement:'',auctionStartAt:'2026-10-10T10:00',auctionEndAt:'2026-10-11T10:00',startMode:'now'};
function box(kind:string, bytes:Uint8Array){const b=new Uint8Array(bytes.length+8);new DataView(b.buffer).setUint32(0,b.length);b.set(Buffer.from(kind),4);b.set(bytes,8);return b}
function iso(format='heic',width=800,height=600){const size=new Uint8Array(12);new DataView(size.buffer).setUint32(4,width);new DataView(size.buffer).setUint32(8,height);const meta=box('meta',new Uint8Array([...new Uint8Array(4),...box('iprp',box('ipco',box('ispe',size)))]));return new Uint8Array([...box('ftyp',new Uint8Array([...Buffer.from(format),0,0,0,0,...Buffer.from('mif1')])),...meta])}
test('HEIC/AVIF content inspection checks bounded box structure and all declared dimensions',()=>{
 assert.deepEqual(inspectConsumerPhoto(iso()),{format:'heic',width:800,height:600});assert.equal(inspectConsumerPhoto(iso('avif')).format,'avif');
 for(const bytes of [iso('heic',40000,1),iso('heic',10000,10000),iso('avis'),iso().slice(0,-1)])assert.throws(()=>inspectConsumerPhoto(bytes));
});
test('renamed non-images, empty data, impossible dimensions fail pre-decode',()=>{
 for(const bytes of [new Uint8Array(),Buffer.from('not a jpeg'),new Uint8Array([255,216,0,0])])assert.throws(()=>inspectConsumerPhoto(bytes));
 for(const [w,h] of [[0,1],[1,NaN],[1.1,200],[16385,1],[10000,10000]])assert.throws(()=>requirePhotoDimensions(w,h));requirePhotoDimensions(8064,6048);
});
test('four-stage recovery migrates old steps without losing compatible type-switch fields',()=>{
 assert.equal(SELL_STEPS.length,4);assert.deepEqual([0,1,2,3,4,5,6,7].map(s=>restoredSellStep(s)),[0,0,1,2,2,2,2,3]);assert.equal(restoredSellStep(3,2),3);
 assert.equal(incompatibleSellFields(values,'auction'),true);const switched=switchedSellValues(values,'auction');for(const name of ['title','description','categoryId','condition','districtOrCity','state','meetupLocationId'] as const)assert.equal(switched[name],values[name]);assert.equal(switched.price,'');assert.equal(switched.startingBid,'');assert.equal(incompatibleSellFields({...values,price:''},'auction'),false);
});
test('recovery accepts only bounded identifiers/checksums and never tokens or arbitrary upload URLs',()=>{
 const submission=newListingSubmission('buy_now');assert.equal(validRecoveryDraft({kind:'sell',flowVersion:2,values,step:2,photoCount:1,submission}),true);
 assert.equal(validRecoveryDraft({kind:'sell',flowVersion:2,values,step:7,photoCount:1}),false);
 assert.equal(validListingSubmission({...submission,token:'secret'}),false);assert.equal(validListingSubmission({...submission,id:'../other'}),false);
 assert.equal(validListingSubmission({...submission,id:'draft',creationAttempted:true,uploads:[{digest:'a'.repeat(64),path:'https://example.invalid/private?token=secret'}]}),false);
});
function adapter(calls:string[]){let published=false;return {create:async()=>{calls.push('create');return 'draft'},read:async()=>published?'published' as const:'draft' as const,upload:async()=>{calls.push('upload');return ['image']},save:async()=>{calls.push('save')},publish:async()=>{calls.push('publish');published=true},checkpoint:()=>{calls.push('checkpoint')}}}
test('upload failure retries the same known draft and a lost publish response never duplicates publication',async()=>{
 const calls:string[]=[];const state=newListingSubmission('buy_now');const a=adapter(calls);let failed=false;const upload=a.upload;a.upload=async()=>{if(!failed){failed=true;throw Error('offline')}return upload()};await assert.rejects(runListingSubmission(state,a));assert.equal(state.id,'draft');await runListingSubmission(state,a);assert.equal(calls.filter(s=>s==='create').length,1);await runListingSubmission(state,a);assert.equal(calls.filter(s=>s==='publish').length,1);
 const b=adapter([]),next=newListingSubmission('auction'),publish=b.publish;b.publish=async()=>{await publish();throw Error('lost response')};assert.equal(await runListingSubmission(next,b),'draft');
});
test('unknown draft creation outcome blocks blind retries and recovery never executes a write',async()=>{
 const state=newListingSubmission('buy_now'),calls:string[]=[];const a=adapter(calls);a.create=async()=>{calls.push('create');throw Error('lost response')};await assert.rejects(runListingSubmission(state,a));assert.equal(validListingSubmission(state),true);await assert.rejects(runListingSubmission(state,a),/Check My Listings/);assert.deepEqual(calls,['checkpoint','create']);
 const restored=JSON.parse(JSON.stringify(state));assert.equal(validListingSubmission(restored),true);assert.deepEqual(calls,['checkpoint','create']);
});
test('definite eligibility rejection can be retried explicitly, while invalid creation responses stay fail-closed',async()=>{
 const calls:string[]=[],state=newListingSubmission('buy_now'),a=adapter(calls);let first=true;const create=a.create;
 a.create=async()=>{if(first){first=false;throw new Error('policy',{cause:{code:'functions/failed-precondition'}})}return create()};
 await assert.rejects(runListingSubmission(state,a));assert.equal(state.creationAttempted,false);await runListingSubmission(state,a);assert.equal(calls.filter(s=>s==='create').length,1);
 const invalid=newListingSubmission('auction'),b=adapter([]);b.create=async()=> '../foreign';await assert.rejects(runListingSubmission(invalid,b));assert.equal(invalid.id,null);await assert.rejects(runListingSubmission(invalid,b),/Check My Listings/);
});
type TestHistoryState = { __NA?: boolean; takemeSellStage?: { scope: string; step: number } };
class Surface extends EventTarget {
 location = { href: 'http://localhost/sell' };
 entries: TestHistoryState[] = [{ __NA: true }];
 index = 0;
 history = {
  state: this.entries[0],
  pushState: (state: TestHistoryState) => { this.entries = this.entries.slice(0, this.index + 1); this.entries.push(state); this.index++; this.history.state = state; },
  replaceState: (state: TestHistoryState) => { this.entries[this.index] = state; this.history.state = state; },
  go: (delta: number) => { this.index += delta; this.history.state = this.entries[this.index]; this.dispatchEvent(new Event('popstate')); },
 };
}
const surface = (value: Surface) => value as unknown as Parameters<typeof installSellHistory>[0];
test('browser and UI back move Details → Category → Photos and then request explicit exit',()=>{
 const s=new Surface(),seen:number[]=[];let exits=0;const h=installSellHistory(surface(s),'/sell',0,n=>seen.push(n),()=>exits++,()=>false);h.go(1);h.go(2);s.history.go(-1);assert.equal(seen.at(-1),1);s.history.go(-1);assert.equal(seen.at(-1),0);s.history.go(-1);assert.equal(exits,1);assert.equal(seen.at(-1),0);assert.equal(s.history.state.__NA,true);h.cleanup();
});
test('restored details has real back entries and in-flight publication prevents stage change',()=>{
 const s=new Surface(),seen:number[]=[];let blocked=false;const h=installSellHistory(surface(s),'/sell',2,n=>seen.push(n),()=>{},()=>blocked);h.go(3);blocked=true;s.history.go(-1);assert.equal(s.history.state.takemeSellStage?.step,3);blocked=false;h.go(1);assert.equal(seen.at(-1),1);h.cleanup();
});
test('a fresh empty flow does not inherit a stale Review history marker',()=>{
 const s=new Surface();s.history.replaceState({__NA:true,takemeSellStage:{scope:'/sell',step:3}});const seen:number[]=[];
 const h=installSellHistory(surface(s),'/sell',0,n=>seen.push(n),()=>{},()=>false);assert.equal(s.history.state.takemeSellStage?.step,0);h.go(1);assert.equal(seen.at(-1),1);h.cleanup();
});

test('unresolved photos block publication but can remain while category/details are edited', async () => {
 const { photoPreparationIssue } = await import('../src/lib/consumer-photo.ts');
 assert.equal(photoPreparationIssue([{failed:true},{}]),'Replace or remove the photos that couldn’t be processed.');
 assert.equal(photoPreparationIssue([{preparing:true},{}]),'Your photos are still preparing. You can keep editing.');
 assert.equal(photoPreparationIssue([{}],1),'Reselect the photos the browser could not retain.');
 assert.equal(photoPreparationIssue([]),'Add at least one photo.');
 assert.equal(photoPreparationIssue([{},{}]),'');
 // A failed photo never changes the user's category/details or executes a write.
 assert.deepEqual(validateSellStep(values,1),{});
 assert.deepEqual(validateSellStep(values,2),{});
});
