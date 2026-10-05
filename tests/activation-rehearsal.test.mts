import assert from "node:assert/strict";
import test from "node:test";
import { assessActivationDrain, calculateAuctionSafetyWindow, auctionBoundaryIsSafe, missingActivationDependencies, activationDependencies, classifyActivationAbort } from "../functions/src/activation-rehearsal.ts";
const drain={now:600000,lastOldRequestAt:0,lastPermitIssuedAt:0,ruleBridgeDeployedAt:0,oldRevisionsRetired:true,runtimeQuiescenceVerified:true,historicalUploadsSettled:true,newPermitsStopped:true,freezeEnforcementVerified:true,directWriteEnforcementVerified:true};
test("calculated reserve combines old HTTP+transaction and permit/propagation bounds but never substitutes for quiescence",()=>{
 assert.equal(assessActivationDrain({...drain,now:599999}).ready,false);
 assert.equal(assessActivationDrain(drain).ready,true);
 for(const key of ['oldRevisionsRetired','runtimeQuiescenceVerified','historicalUploadsSettled','newPermitsStopped','freezeEnforcementVerified','directWriteEnforcementVerified'])assert.equal(assessActivationDrain({...drain,[key]:false}).ready,false);
 assert.equal(assessActivationDrain({...drain,lastOldRequestAt:590000}).notBefore,920000);
 assert.equal(assessActivationDrain({...drain,lastPermitIssuedAt:590000}).notBefore,710000);
});
test("unknown, future, invalid drain timestamps never mean drained",()=>{
 for(const now of [NaN,Infinity,-1])assert.equal(assessActivationDrain({...drain,now}).ready,false);
 for(const key of ['lastOldRequestAt','lastPermitIssuedAt','ruleBridgeDeployedAt'])for(const value of [null,600001,-1,NaN])assert.equal(assessActivationDrain({...drain,[key]:value}).ready,false);
});
test("auction safety horizon requires measured activation/rollback/verification budgets and an explicit reserve",()=>{
 const timings={activationStepsMs:[1000,2000],rollbackStepsMs:[4000],verificationMs:3000,safetyMarginMs:5000};
 assert.equal(calculateAuctionSafetyWindow(timings),15000);
 assert.equal(auctionBoundaryIsSafe(100000,115000,15000),false);
 assert.equal(auctionBoundaryIsSafe(100000,84999,15000),true);
 assert.equal(auctionBoundaryIsSafe(100000,1000000,null),false);
 for(const value of [null,0,-1,Infinity,NaN])assert.equal(calculateAuctionSafetyWindow({...timings,verificationMs:value}),null);
 assert.equal(calculateAuctionSafetyWindow({...timings,rollbackStepsMs:[]}),null);
 assert.equal(calculateAuctionSafetyWindow({...timings,activationStepsMs:[null]}),null);
});
test("every activation step requires affirmative dependencies; no bootstrap before accessible legal/five endpoints",()=>{
 for(const [step,dependencies]of Object.entries(activationDependencies)){
  assert.deepEqual(missingActivationDependencies(step as keyof typeof activationDependencies,{}),dependencies);
  const all=Object.fromEntries(dependencies.map(name=>[name,true]));assert.deepEqual(missingActivationDependencies(step as keyof typeof activationDependencies,all),[]);
  for(const name of dependencies)assert.ok(missingActivationDependencies(step as keyof typeof activationDependencies,{...all,[name]:false}).includes(name));
 }
 assert.ok(activationDependencies.bootstrap.includes('legalRoutesReachable'));
 assert.ok(activationDependencies.coordinatedFunctions.includes('legacyMessageTransitionReviewed'));
});
test("abort never silently reopens legacy writes, deletes acceptance history or assumes policy rollback erases consent",()=>{
 for(const phase of ['beforePause','pausedBeforePolicy','policyBootstrapped','partiallyCoordinated','verifiedFinal','reopened']as const){
  const value=classifyActivationAbort(phase);assert.equal(value.legacyReopenAllowed,false);assert.equal(value.preservePublicReads,true);assert.equal(value.retainAcceptanceEvidence,true);assert.equal(value.keepOrReestablishPause,phase!=='beforePause');
 }
 assert.equal(classifyActivationAbort('pausedBeforePolicy').finalReopenMayBeReviewed,false);
 assert.equal(classifyActivationAbort('partiallyCoordinated').rollbackRequired,true);
 assert.equal(classifyActivationAbort('verifiedFinal').finalReopenMayBeReviewed,true);
 assert.equal(classifyActivationAbort('policyBootstrapped').partlyIrreversible,true);
});
