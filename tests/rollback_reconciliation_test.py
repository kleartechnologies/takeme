import unittest,io,zipfile,hashlib,json,copy,sys,tempfile,importlib.util
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from bridge_verification import durable_source,verify_source_tree,normalize_trigger,normalize_iam,qualify_deployment
FILES={'lib/index.js':b'exports.synthetic = true;','lib/support.js':b'exports.offline = true;','package.json':b'{"name":"synthetic-offline-package"}'}
EXPECTED={k:hashlib.sha256(v).hexdigest()for k,v in FILES.items()};SOURCE={'bucket':'gcf-v2-sources-367115645204-asia-southeast1','object':'placeBid/function-source.zip','generation':'123'}
def archive(files=FILES):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w')as z:
  for n,v in files.items():z.writestr(n,v)
 return b.getvalue()
def function(source=SOURCE):return {'buildConfig':{'source':{'storageSource':source}}}
class ExistingNineTests(unittest.TestCase):
 def test_01_managed_copy_exact_bytes(self):self.assertTrue(verify_source_tree(archive(),EXPECTED)['reviewedBytesMatch']);self.assertEqual(durable_source('placeBid',function()),SOURCE)
 def test_02_wrong_project_bucket(self):
  with self.assertRaises(ValueError):durable_source('placeBid',function({**SOURCE,'bucket':'gcf-v2-sources-000-asia-southeast1'}))
 def test_03_wrong_region(self):
  with self.assertRaises(ValueError):durable_source('placeBid',function({**SOURCE,'bucket':'gcf-v2-sources-367115645204-us-central1'}))
 def test_04_wrong_function(self):
  with self.assertRaises(ValueError):durable_source('placeBid',function({**SOURCE,'object':'other/function-source.zip'}))
 def test_05_missing_generation(self):
  with self.assertRaises(ValueError):durable_source('placeBid',function({**SOURCE,'generation':''}))
 def test_06_changed_file(self):
  with self.assertRaises(ValueError):verify_source_tree(archive({**FILES,'lib/index.js':b'changed'}),EXPECTED)
 def test_07_missing_file(self):
  with self.assertRaises(ValueError):verify_source_tree(archive({k:v for k,v in FILES.items()if k!='lib/index.js'}),EXPECTED)
 def test_08_extra_file(self):
  with self.assertRaises(ValueError):verify_source_tree(archive({**FILES,'unreviewed.txt':b'extra'}),EXPECTED)
 def test_09_temporary_upload_not_serving_proof(self):
  with self.assertRaises(ValueError):durable_source('placeBid',function({**SOURCE,'bucket':'gcf-v2-uploads-367115645204.asia-southeast1.cloudfunctions.appspot.com'}))
class RegressionTests(unittest.TestCase):
 def test_resolved_provenance_works_after_upload_object_disappears(self):
  f=function({'bucket':'expired-temporary-capability','object':'unavailable.zip'});f['buildConfig']['sourceProvenance']={'resolvedStorageSource':SOURCE};self.assertEqual(durable_source('placeBid',f),SOURCE)
 def test_no_temporary_object_needed(self):self.assertEqual(durable_source('placeBid',{'buildConfig':{'sourceProvenance':{'resolvedStorageSource':SOURCE}}}),SOURCE)
 def test_missing_durable_proof_denied(self):
  with self.assertRaises(ValueError):durable_source('placeBid',{'buildConfig':{}})
 def test_duplicate_member_denied(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w')as z:
   z.writestr('lib/index.js',FILES['lib/index.js']);z.writestr('lib/index.js',FILES['lib/index.js'])
  with self.assertRaises(ValueError):verify_source_tree(b.getvalue(),EXPECTED)
 def test_symlink_denied(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w')as z:
   i=zipfile.ZipInfo('lib/index.js');i.create_system=3;i.external_attr=0o120777<<16;z.writestr(i,b'other')
  with self.assertRaises(ValueError):verify_source_tree(b.getvalue(),EXPECTED)
 def test_path_traversal_denied(self):
  with self.assertRaises(ValueError):verify_source_tree(archive({**FILES,'../escape':b'x'}),EXPECTED)
 def test_source_timestamp_not_identity(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w')as z:
   for n,v in FILES.items():z.writestr(zipfile.ZipInfo(n,(2020,1,1,0,0,0)),v)
  self.assertEqual(verify_source_tree(archive(),EXPECTED),verify_source_tree(b.getvalue(),EXPECTED))
 def test_http_null_vs_absent(self):self.assertEqual(normalize_trigger(None),normalize_trigger({}))
 def test_event_filter_order_not_semantic(self):
  a={'eventType':'create','eventFilters':[{'attribute':'database','value':'(default)'},{'attribute':'document','value':'items/{id}'}]};self.assertEqual(normalize_trigger(a),normalize_trigger({**a,'eventFilters':list(reversed(a['eventFilters']))}))
 def test_real_event_trigger_drift_denied(self):self.assertNotEqual(normalize_trigger({'eventType':'create'}),normalize_trigger({'eventType':'delete'}))
 def test_iam_etag_and_order_only(self):
  a={'version':1,'etag':'a','bindings':[{'role':'roles/run.invoker','members':['b','a']}]};self.assertEqual(normalize_iam(a),normalize_iam({**a,'etag':'new','bindings':[{'role':'roles/run.invoker','members':['a','b']}]}));self.assertNotEqual(normalize_iam(a),normalize_iam({**a,'bindings':[{'role':'roles/owner','members':['a','b']}]}))
 def test_full_success_requires_all_durable_evidence(self):
  f={'state':'ACTIVE','serviceConfig':{'revision':'new'}};self.assertTrue(qualify_deployment(200,{'done':True},f,{}, {},{}, {},{'reviewedBytesMatch':True},'old'))
 def test_deployment_error_denied(self):
  with self.assertRaises(ValueError):qualify_deployment(200,{'done':True,'error':{'code':3}},{'state':'ACTIVE'}, {},{}, {},{}, {'reviewedBytesMatch':True},'old')
 def test_upload_failure_denied(self):
  with self.assertRaises(ValueError):qualify_deployment(403,{'done':True},{'state':'ACTIVE'}, {},{}, {},{}, {'reviewedBytesMatch':True},'old')
 def test_nonactive_denied(self):
  with self.assertRaises(ValueError):qualify_deployment(200,{'done':True},{'state':'DEPLOYING'}, {},{}, {},{}, {'reviewedBytesMatch':True},'old')
 def test_config_change_denied(self):
  with self.assertRaises(ValueError):qualify_deployment(200,{'done':True},{'state':'ACTIVE','serviceConfig':{'revision':'new'}},{'timeout':60},{'timeout':120},{},{},{'reviewedBytesMatch':True},'old')
 def test_wrong_iam_denied(self):
  with self.assertRaises(ValueError):qualify_deployment(200,{'done':True},{'state':'ACTIVE','serviceConfig':{'revision':'new'}},{},{},{'bindings':[]},{'bindings':[{'role':'roles/run.invoker','members':['allUsers']}]},{'reviewedBytesMatch':True},'old')
 def test_same_revision_denied(self):
  with self.assertRaises(ValueError):qualify_deployment(200,{'done':True},{'state':'ACTIVE','serviceConfig':{'revision':'old'}},{},{},{},{},{'reviewedBytesMatch':True},'old')
 def test_missing_package_proof_denied(self):
  with self.assertRaises(ValueError):qualify_deployment(200,{'done':True},{'state':'ACTIVE','serviceConfig':{'revision':'new'}},{},{},{},{},{},'old')


class PrivateHelperTests(unittest.TestCase):
 def call(self,files=None,source=None):
  from bridge_verification import verify_deployed_source
  reads=[]
  def read_managed(metadata):
   reads.append(metadata);return archive(FILES if files is None else files)
  f={'buildConfig':{'source':{'storageSource':{'bucket':'expired-upload','object':'gone.zip'}},'sourceProvenance':{'resolvedStorageSource':SOURCE if source is None else source},'build':'reviewed-build'},'serviceConfig':{'revision':'new-reviewed-revision'}}
  result=verify_deployed_source('placeBid',f,EXPECTED,read_managed);self.assertEqual(reads,[SOURCE]);return result
 def test_01_exact_managed_bytes_temp_absent(self):self.assertTrue(self.call()['reviewedBytesMatch'])
 def test_02_wrong_project(self):
  with self.assertRaises(ValueError):self.call(source={**SOURCE,'bucket':'gcf-v2-sources-000-asia-southeast1'})
 def test_03_wrong_region(self):
  with self.assertRaises(ValueError):self.call(source={**SOURCE,'bucket':'gcf-v2-sources-367115645204-us-central1'})
 def test_04_wrong_function(self):
  with self.assertRaises(ValueError):self.call(source={**SOURCE,'object':'other/function-source.zip'})
 def test_05_missing_generation(self):
  with self.assertRaises(ValueError):self.call(source={**SOURCE,'generation':''})
 def test_06_changed_bytes(self):
  with self.assertRaises(ValueError):self.call(files={**FILES,'lib/index.js':b'changed'})
 def test_07_missing_file(self):
  with self.assertRaises(ValueError):self.call(files={k:v for k,v in FILES.items()if k!='lib/index.js'})
 def test_08_extra_file(self):
  with self.assertRaises(ValueError):self.call(files={**FILES,'unexpected.txt':b'x'})
 def test_09_upload_bucket_cannot_prove_deployment(self):
  with self.assertRaises(ValueError):self.call(source={**SOURCE,'bucket':'gcf-v2-uploads-367115645204.asia-southeast1.cloudfunctions.appspot.com'})



from rollback_inventory import verify_inventory,RESTORED
from bridge_verification import digest
TEMP=tempfile.TemporaryDirectory(prefix='takeme-synthetic-rollback-')
PACKAGE_ROOT=Path(TEMP.name);GROUP='a'*40
package=PACKAGE_ROOT/('group-'+GROUP);package.mkdir()
for name,raw in FILES.items():
 p=package/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
COMPILED={k:v for k,v in EXPECTED.items()if k.startswith('lib/')and k.endswith('.js')}
oldrows=[];rows=[]
for name in [*RESTORED,*['syntheticFunction'+str(i)for i in range(88)]]:
 prior,bridge,current=RESTORED.get(name,(name+'-old',None,name+'-old'))
 settings={'serviceAccountEmail':'synthetic-operator@example.invalid','availableMemory':'256Mi','timeoutSeconds':60,'availableCpu':'1','maxInstanceRequestConcurrency':80}
 old={'name':name,'region':'asia-southeast1','runtime':'nodejs22','entryPoint':name,'revision':prior,'sourceHash':GROUP,'runtimeSettings':{**settings,'revision':prior},'environmentSha256':'1'*64,'environmentKeys':['GCLOUD_PROJECT'],'eventTrigger':None};oldrows.append(old)
 row={**old,'state':'ACTIVE','environment':'GEN_2','revision':current,'historicalRevision':prior,'runtimeSettings':settings,'eventTrigger':{},'cloudRunReadyRevision':current,'cloudRunTrafficVerified':True,'originalBaselineEquivalent':True,'sourceProvenance':{'resolvedStorageSource':{'bucket':'gcf-v2-sources-367115645204-asia-southeast1','object':name+'/function-source.zip','generation':'123'}},'labels':{'firebase-functions-hash':GROUP},'reviewedSourceMatches':True,'sourceTreeSha256':digest(EXPECTED),'compiledTreeSha256':digest(COMPILED),'sourceFiles':len(FILES),'compiledFiles':len(COMPILED)}
 if name in RESTORED:row.update(temporaryBridgeRevision=bridge,rollbackRevision=current,iamSha256='b9a6087bad291d0bb96d7e1784d459b1521d258707c63f93933d3148c60391cb')
 rows.append(row)
OLD={'checks':[{'result':oldrows}]}
CURRENT={'projectId':'takeme-52b80','projectNumber':'367115645204','region':'asia-southeast1','readOnly':True,'productionModified':False,'customerDataRead':False,'functions':rows,'touched':[copy.deepcopy(x)for x in rows if x['name']in RESTORED],'functionCount':91,'activeCount':91,'compiledSourceVerified':91,'drift':[],'bridgeCodePresent':False}

class InventoryTests(unittest.TestCase):
 def valid(self,d):return verify_inventory(d,OLD,PACKAGE_ROOT)
 def reject(self,mutate):
  d=copy.deepcopy(CURRENT);mutate(d)
  with self.assertRaises(ValueError):self.valid(d)
 def test_reconciled_91_with_three_new_ids(self):self.assertEqual(self.valid(CURRENT)['functions'],91)
 def test_missing_function(self):self.reject(lambda d:d['functions'].pop())
 def test_duplicate_function(self):self.reject(lambda d:d['functions'].__setitem__(0,d['functions'][1]))
 def test_wrong_project(self):self.reject(lambda d:d.__setitem__('projectId','demo-takeme'))
 def test_stale_revision(self):self.reject(lambda d:d['functions'][0].__setitem__('revision','unreviewed'))
 def test_environment_drift(self):self.reject(lambda d:d['functions'][0].__setitem__('environmentSha256','0'*64))
 def test_source_drift(self):self.reject(lambda d:d['functions'][0].__setitem__('compiledTreeSha256','0'*64))
 def test_service_account_drift(self):self.reject(lambda d:d['functions'][0]['runtimeSettings'].__setitem__('serviceAccountEmail','other'))
 def test_wrong_durable_bucket(self):self.reject(lambda d:d['functions'][0]['sourceProvenance']['resolvedStorageSource'].__setitem__('bucket','temporary-upload'))
 def test_bridge_serving(self):self.reject(lambda d:d.__setitem__('bridgeCodePresent',True))
 def test_traffic_not_verified(self):self.reject(lambda d:d['functions'][0].__setitem__('cloudRunTrafficVerified',False))
 def test_inconsistent_touched_history(self):self.reject(lambda d:d['touched'][0].__setitem__('temporaryBridgeRevision','unreviewed'))


class CliRefusalTests(unittest.TestCase):
 def test_wrong_manifest_fails_closed(self):
  spec=importlib.util.spec_from_file_location('rollback_review',Path(__file__).resolve().parents[1]/'scripts/verify-reconciled-rollback.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  p=PACKAGE_ROOT/'unreviewed.json';p.write_text('{}')
  with self.assertRaises(ValueError):module.verify_review(p)
 def test_relative_manifest_fails_closed(self):
  spec=importlib.util.spec_from_file_location('rollback_review',Path(__file__).resolve().parents[1]/'scripts/verify-reconciled-rollback.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  with self.assertRaises(ValueError):module.verify_review(Path('unreviewed.json'))
if __name__=='__main__':
 try:unittest.main()
 finally:TEMP.cleanup()
