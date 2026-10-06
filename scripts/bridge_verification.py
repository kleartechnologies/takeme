"""Pure, fail-closed deployment evidence checks. No cloud client, credentials or mutation."""
import hashlib,io,json,stat,zipfile

def digest(value):
 return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def normalize_trigger(value):
 if value is None:return {}
 if not isinstance(value,dict):raise ValueError('Invalid trigger metadata')
 out=dict(value)
 if 'eventFilters'in out:
  if not isinstance(out['eventFilters'],list):raise ValueError('Invalid event filters')
  out['eventFilters']=sorted(out['eventFilters'],key=lambda x:json.dumps(x,sort_keys=True))
 return out

def normalize_iam(value):
 if not isinstance(value,dict):raise ValueError('Invalid IAM metadata')
 out={k:v for k,v in value.items()if k!='etag'}
 if 'bindings'in out:
  out['bindings']=sorted([{**b,'members':sorted(b['members'])}for b in out['bindings']],key=lambda x:json.dumps(x,sort_keys=True))
 return out

def durable_source(name,function,number='367115645204',region='asia-southeast1'):
 config=function.get('buildConfig',{})
 source=config.get('sourceProvenance',{}).get('resolvedStorageSource')or config.get('source',{}).get('storageSource')
 if not isinstance(source,dict)or source.get('bucket')!='gcf-v2-sources-'+number+'-'+region or source.get('object')!=name+'/function-source.zip' or not str(source.get('generation','')).isdigit():
  raise ValueError('Missing or mismatched durable managed deployment source')
 return {k:source[k]for k in ['bucket','object','generation']}

def verify_source_tree(raw,expected):
 if not isinstance(raw,bytes)or len(raw)>4*1024*1024:raise ValueError('Invalid source archive')
 actual={};total=0
 with zipfile.ZipFile(io.BytesIO(raw))as z:
  for entry in z.infolist():
   if entry.is_dir():continue
   name=entry.filename;parts=name.split('/')
   if name.startswith('/')or '\\'in name or any(p in ['', '.', '..','.git','node_modules']or p.startswith('.env')for p in parts)or name in actual or stat.S_ISLNK(entry.external_attr>>16):raise ValueError('Unsafe or duplicate source member')
   total+=entry.file_size
   if total>16*1024*1024:raise ValueError('Source expansion limit')
   actual[name]=hashlib.sha256(z.read(entry)).hexdigest()
 if actual!=expected:raise ValueError('Reviewed source/package bytes differ')
 compiled={k:v for k,v in actual.items()if k.startswith('lib/')and k.endswith('.js')}
 if not compiled or 'lib/index.js'not in compiled:raise ValueError('Compiled entry point missing')
 return {'sourceTreeSha256':digest(actual),'compiledTreeSha256':digest(compiled),'files':len(actual),'compiledFiles':len(compiled),'reviewedBytesMatch':True}

def verify_deployed_source(name,function,expected,read_managed_source):
 """Verify reviewed bytes through an injected, generation-pinned source reader.

 No authentication, HTTP client, temporary upload-object read or cloud mutation
 is provided here. Reject the source identity before invoking the reader.
 """
 source=durable_source(name,function)
 proof=verify_source_tree(read_managed_source(source),expected)
 return {**proof,'durableManagedSource':source,
         'buildResource':function.get('buildConfig',{}).get('build'),
         'servingRevision':function.get('serviceConfig',{}).get('revision')}

def qualify_deployment(upload_status,operation,function,expected_settings,current_settings,expected_iam,current_iam,source_proof,previous_revision):
 if upload_status!=200 or operation.get('done')is not True or operation.get('error')or function.get('state')!='ACTIVE':raise ValueError('Upload/deployment not successful and ACTIVE')
 if expected_settings!=current_settings or normalize_iam(expected_iam)!=normalize_iam(current_iam):raise ValueError('Configuration or IAM changed')
 if function.get('serviceConfig',{}).get('revision')in [None,previous_revision]:raise ValueError('New serving revision not established')
 if source_proof.get('reviewedBytesMatch')is not True:raise ValueError('Reviewed package provenance missing')
 return True
