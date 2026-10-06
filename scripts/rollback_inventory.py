"""Offline rollback inventory verification. Never loads a cloud SDK or credentials."""
from pathlib import Path
import json,hashlib
from bridge_verification import digest,normalize_trigger,durable_source

REFERENCE_FILE = Path(__file__).resolve().parents[1] / 'docs/function-rollback-baseline-reference.json'
REFERENCE = json.loads(REFERENCE_FILE.read_text())
RESTORED = {row['name']: (row['historicalRevision'], row['temporaryBridgeRevision'], row['restoredRevision']) for row in REFERENCE['restoredFunctions']}

def require(value,message):
 if not value:raise ValueError(message)

def verify_inventory(current,old,package_root):
 require(current.get('projectId')=='takeme-52b80' and current.get('projectNumber')=='367115645204' and current.get('region')=='asia-southeast1','Resource identity mismatch')
 require(current.get('readOnly')is True and current.get('productionModified')is False and current.get('customerDataRead')is False,'Safety evidence mismatch')
 rows=current.get('functions',[]);prior={x['name']:x for x in old['checks'][0]['result']}
 require(len(rows)==len(prior)==91 and len({x['name']for x in rows})==91 and {x['name']for x in rows}==set(prior),'Function inventory mismatch')
 require(current.get('functionCount')==current.get('activeCount')==current.get('compiledSourceVerified')==91 and current.get('drift')==[] and current.get('bridgeCodePresent')is False,'Baseline not fully qualified')
 packages={};checked=0
 for row in rows:
  name=row['name'];previous=prior[name]
  require(row['state']=='ACTIVE' and row['environment']=='GEN_2' and row['runtime']==previous['runtime']=='nodejs22' and row['region']==previous['region']=='asia-southeast1' and row['entryPoint']==previous['entryPoint']==name,'Runtime/entry identity drift')
  require(row['historicalRevision']==previous['revision'] and row['sourceHash']==previous['sourceHash'],'Historical binding drift')
  require(row['runtimeSettings']=={k:v for k,v in previous['runtimeSettings'].items()if k!='revision'},'Service configuration drift')
  require(row['environmentSha256']==previous['environmentSha256'] and row['environmentKeys']==previous['environmentKeys'],'Environment configuration drift')
  require(normalize_trigger(row.get('eventTrigger'))==normalize_trigger(previous.get('eventTrigger')),'Trigger drift')
  require(row['cloudRunReadyRevision']==row['revision'] and row['cloudRunTrafficVerified']is True and row['originalBaselineEquivalent']is True,'Serving equivalence missing')
  expected_revision=RESTORED[name][2]if name in RESTORED else previous['revision']
  require(row['revision']==expected_revision,'Unreviewed serving revision')
  if name in RESTORED:
   require((row['historicalRevision'],row['temporaryBridgeRevision'],row['rollbackRevision'])==RESTORED[name],'Restoration history mismatch')
   require(row['iamSha256']=='b9a6087bad291d0bb96d7e1784d459b1521d258707c63f93933d3148c60391cb','Restored invoker IAM drift')
  require(not any('EMULATOR'in key for key in row['environmentKeys']),'Emulator configuration leak')
  require(row['labels'].get('firebase-functions-hash')==row['sourceHash'],'Source group label drift')
  durable_source(name,{'buildConfig':{'sourceProvenance':row['sourceProvenance']}})
  group=row['sourceHash']
  if group not in packages:
   root=Path(package_root)/('group-'+group);files={}
   for p in root.rglob('*'):
    if p.is_file():
     require(not p.is_symlink(),'Source symlink');relative=str(p.relative_to(root));require(not any(k in ['node_modules','.git']or k.startswith('.env')for k in p.relative_to(root).parts),'Unsafe package member');files[relative]=hashlib.sha256(p.read_bytes()).hexdigest()
   require(bool(files)and 'lib/index.js'in files and 'lib/legacy-maintenance-bridge.js'not in files,'Baseline package missing or contains bridge')
   packages[group]=files
  files=packages[group];compiled={k:v for k,v in files.items()if k.startswith('lib/')and k.endswith('.js')}
  require(row['reviewedSourceMatches']is True and row['sourceTreeSha256']==digest(files) and row['compiledTreeSha256']==digest(compiled) and row['sourceFiles']==len(files)and row['compiledFiles']==len(compiled),'Source/compiled package mismatch')
  checked+=1
 require({x['name']for x in current.get('touched',[])}==set(RESTORED),'Touched inventory mismatch')
 require(all(next(r for r in rows if r['name']==x['name'])==x for x in current['touched']),'Touched projection mismatch')
 return {'inventoryVerified':True,'functions':checked,'restoredRevisionBindings':3,'historicalPackages':len(packages),'sourceConfigEquivalent':True,'drift':0,'productionModified':False}
