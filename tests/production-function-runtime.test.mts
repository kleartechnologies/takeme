import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("final runtime deployment rejects missing pins, resource drift and feature activation; preserves environment", () => {
  const cwd = fileURLToPath(new URL("..", import.meta.url));
  const code = `
import sys,copy
sys.path.insert(0,'scripts')
from production_function_runtime import *
f={'name':'projects/takeme-52b80/locations/asia-southeast1/functions/createFixedListingDraft','state':'ACTIVE','buildConfig':{'runtime':'nodejs22'},'serviceConfig':{'revision':'reviewed-00004','environmentVariables':{'GCLOUD_PROJECT':'takeme-52b80','FIREBASE_CONFIG':json.dumps({'projectId':'takeme-52b80','storageBucket':'takeme-52b80.firebasestorage.app'}),'PRESERVED_OPTION':'original'}}}
def rejects(fn):
 try: fn()
 except ValueError: return
 raise AssertionError('Expected refusal')
rejects(lambda:qualify_final_runtime(f))
p=plan_environment_patch(f)
assert p['changedKeys']==sorted(PIN_VALUES) and p['updateMask']=='serviceConfig.environmentVariables'
fixed=copy.deepcopy(f);fixed['serviceConfig'].update(p['body']['serviceConfig'])
assert fixed['serviceConfig']['environmentVariables']['PRESERVED_OPTION']=='original'
assert qualify_final_runtime(fixed)['classification']=='CORRECT'
assert not plan_environment_patch(fixed)['deploymentRequired']
deployed=copy.deepcopy(fixed);deployed['serviceConfig']['revision']='reviewed-00005'
proof={'reviewedBytesMatch':True}
deployed['buildConfig'].update({'build':'new-generated-build','source':{'storageSource':{'generation':'new-generated-generation'}}})
assert qualify_runtime_patch(f,deployed,deployed['serviceConfig']['environmentVariables'],{'bindings':[]},{'bindings':[]},proof)
for section,key,value in [('serviceConfig','timeoutSeconds',60),('buildConfig','entryPoint','wrong'),('labels','unexpected','value')]:
 bad=copy.deepcopy(deployed);bad.setdefault(section,{})[key]=value
 rejects(lambda:qualify_runtime_patch(f,bad,deployed['serviceConfig']['environmentVariables'],{'bindings':[]},{'bindings':[]},proof))
rejects(lambda:qualify_runtime_patch(f,deployed,deployed['serviceConfig']['environmentVariables'],{'bindings':[]},{'bindings':[{'role':'roles/run.invoker','members':['allUsers']}]},proof))
rejects(lambda:qualify_runtime_patch(f,deployed,deployed['serviceConfig']['environmentVariables'],{'bindings':[]},{'bindings':[]},{'reviewedBytesMatch':False}))
for key,value in [('TAKEME_RELEASE_TARGET','staging'),('TAKEME_FIREBASE_PROJECT_ID','wrong-project')]:
 bad=copy.deepcopy(fixed);bad['serviceConfig']['environmentVariables'][key]=value
 rejects(lambda:qualify_final_runtime(bad))
 assert plan_environment_patch(bad)['changedKeys']==[key]
for key,value in [('FIREBASE_CONFIG','{}'),('GCLOUD_PROJECT','wrong-project'),('TAKEME_STORAGE_BUCKETS','wrong-bucket'),('TAKEME_ENABLE_PRODUCTION_DELETION','true'),('PROTECTED_PAYMENTS_ENABLED','true'),('FIRESTORE_EMULATOR_HOST','127.0.0.1:8080')]:
 bad=copy.deepcopy(fixed);bad['serviceConfig']['environmentVariables'][key]=value
 rejects(lambda:plan_environment_patch(bad))
for key in PIN_VALUES:
 bad=copy.deepcopy(fixed);del bad['serviceConfig']['environmentVariables'][key]
 rejects(lambda:qualify_final_runtime(bad))
read=copy.deepcopy(f);read['name']=read['name'].replace('createFixedListingDraft','getPublicListingPage')
assert qualify_final_runtime(read)['classification']=='NOT APPLICABLE'
assert not plan_environment_patch(read)['deploymentRequired']
trigger=copy.deepcopy(fixed);trigger['eventTrigger']={'eventType':'google.cloud.firestore.document.v1.written','eventFilters':[{'attribute':'database','value':'(default)'},{'attribute':'namespace','value':'(default)'}]}
reordered=copy.deepcopy(trigger);reordered['eventTrigger']['eventFilters'].reverse()
assert qualify_unchanged_function(trigger,reordered)
bad=copy.deepcopy(reordered);bad['eventTrigger']['eventFilters'][0]['value']='other'
rejects(lambda:qualify_unchanged_function(trigger,bad))
bad=copy.deepcopy(reordered);bad['serviceConfig']['revision']='unexpected'
rejects(lambda:qualify_unchanged_function(trigger,bad))
rejects(lambda:qualify_inventory([fixed]))
assert len(TARGETS)==77 and sum(r['requiresPolicyIdentity'] for r in TARGETS.values())==44
`;
  const result = spawnSync("python3", ["-c", code], { cwd, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(result.status, 0, result.stderr);
});

test("reviewed Function manifest matches current source dependencies", () => {
  const result = spawnSync(process.execPath, ["scripts/audit-function-runtime-source.mjs"], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).classificationMatchesReviewedManifest, true);
});
