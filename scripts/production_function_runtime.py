"""Final V1 runtime contract. Pure checks/plans; no credentials or cloud writes.

The API environment map is runtime configuration, independent of buildConfig.
Historical bridge qualification must not use this final-source contract.
"""
import json
import hashlib
from bridge_verification import normalize_iam, normalize_trigger
from pathlib import Path

MANIFEST = json.loads(Path(__file__).with_name('production-function-runtime-manifest.json').read_text())
TARGETS = {row['name']: row for row in MANIFEST['functions']}
PIN_VALUES = MANIFEST['requiredPolicyPins']
OFF_FLAGS = ('TAKEME_ENABLE_PRODUCTION_DELETION', 'TAKEME_ENABLE_STAGING_DELETION',
             'PROTECTED_PAYMENTS_ENABLED')


def verify_contract_sources():
    root = Path(__file__).resolve().parent.parent
    for name, expected in MANIFEST['runtimeContractSourceHashes'].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise ValueError('Runtime source contract changed; re-review required: ' + name)


def audit_function(function):
    """Report only public identity pins, never unrelated environment values."""
    verify_contract_sources()
    name = function['name'].split('/')[-1]
    if name not in TARGETS:
        raise ValueError('Function is outside reviewed final V1 manifest')
    contract = TARGETS[name]
    project, region, bucket = (MANIFEST[k] for k in ('projectId', 'region', 'storageBucket'))
    if function['name'] != f'projects/{project}/locations/{region}/functions/{name}':
        raise ValueError('Function resource identity mismatch')
    if function.get('state') != 'ACTIVE' or function['buildConfig']['runtime'] != MANIFEST['runtime']:
        raise ValueError('Function is not ACTIVE on the reviewed runtime')
    env = function['serviceConfig'].get('environmentVariables', {})
    for key in OFF_FLAGS:
        if key in env and env[key] != 'false':
            raise ValueError('Forbidden feature activation configuration: ' + key)
    if any('EMULATOR' in key and not (key == 'NEXT_PUBLIC_USE_FIREBASE_EMULATORS' and value == 'false')
           for key, value in env.items()):
        raise ValueError('Emulator configuration is forbidden')
    if any(value in ('demo-takeme', 'takeme-staging-822a5', 'takeme-staging-822a5.firebasestorage.app')
           for value in env.values()):
        raise ValueError('Non-production resource configuration')
    missing, incorrect = [], []
    required = PIN_VALUES if contract['requiresPolicyIdentity'] else {}
    for key, expected in PIN_VALUES.items():
        if key not in env:
            if key in required:
                missing.append(key)
        elif env[key] != expected:
            incorrect.append(key)
    runtime_projects = [env[key] for key in ('GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'GCP_PROJECT') if key in env]
    if contract['requiresPolicyIdentity'] and not runtime_projects:
        missing.append('platform project identity')
    if any(value != project for value in runtime_projects):
        incorrect.append('platform project identity')
    # initializeApp() obtains trusted Admin app project/bucket from FIREBASE_CONFIG.
    try:
        config = json.loads(env.get('FIREBASE_CONFIG', 'null'))
    except (ValueError, TypeError):
        config = None
    if contract['requiresPolicyIdentity'] or 'FIREBASE_CONFIG' in env:
        if not isinstance(config, dict) or config.get('projectId') != project or config.get('storageBucket') != bucket:
            incorrect.append('FIREBASE_CONFIG project/bucket')
    for key, expected in {'TAKEME_STORAGE_BUCKETS': bucket, 'TAKEME_DELETION_ENVIRONMENT': 'production'}.items():
        if key in env and env[key] != expected:
            incorrect.append(key)
    status = ('INCORRECT PIN' if incorrect else 'MISSING REQUIRED PIN' if missing else
              'CORRECT' if required else 'NOT APPLICABLE')
    return {'name': name, 'revision': function['serviceConfig']['revision'], 'source': contract['source'],
            'requiredRuntimePins': required, 'configuredPublicPins': {key: env.get(key) for key in PIN_VALUES},
            'platformProjectMatches': bool(runtime_projects) and all(value == project for value in runtime_projects),
            'adminProjectBucketMatches': isinstance(config, dict) and config.get('projectId') == project and config.get('storageBucket') == bucket,
            'missing': missing, 'incorrect': incorrect, 'classification': status,
            'sourceRequiresPolicyIdentity': contract['requiresPolicyIdentity']}


def plan_environment_patch(function):
    """Repair only two reviewed application pins; refuse all other resource drift."""
    row = audit_function(function)
    repairable = set(PIN_VALUES) if row['sourceRequiresPolicyIdentity'] else set()
    if set(row['missing'] + row['incorrect']) - repairable:
        raise ValueError('Unreviewed runtime/resource drift requires owner review')
    before = function['serviceConfig'].get('environmentVariables', {})
    changes = {key: PIN_VALUES[key] for key in row['missing'] + row['incorrect']}
    after = {**before, **changes}
    candidate = {**function, 'serviceConfig': {**function['serviceConfig'], 'environmentVariables': after}}
    qualify_final_runtime(candidate)
    return {'name': function['name'], 'updateMask': 'serviceConfig.environmentVariables',
            'body': {'name': function['name'], 'serviceConfig': {'environmentVariables': after}},
            'changedKeys': sorted(changes), 'deploymentRequired': bool(changes)}


def qualify_final_runtime(function):
    row = audit_function(function)
    if row['missing'] or row['incorrect']:
        raise ValueError('Required final production runtime pins are absent or incorrect: ' + row['name'])
    return row


def qualify_inventory(functions):
    names = [f['name'].split('/')[-1] for f in functions]
    if len(names) != len(TARGETS) or set(names) != set(TARGETS):
        raise ValueError('Final runtime inventory must contain exactly the reviewed 77 Functions')
    return [qualify_final_runtime(f) for f in functions]


def qualify_runtime_patch(before, after, expected_env, before_iam, after_iam, source_proof):
    """Env-only changes must retain every serving/build/trigger setting and IAM."""
    qualify_final_runtime(after)
    previous = before['serviceConfig']
    current = after['serviceConfig']
    expected = {key: value for key, value in previous.items() if key != 'revision'}
    expected['environmentVariables'] = expected_env
    if {key: value for key, value in current.items() if key != 'revision'} != expected:
        raise ValueError('Unexpected serving configuration change')
    if current.get('revision') in (None, previous.get('revision')):
        raise ValueError('New ACTIVE serving revision is required')
    for key in ('name', 'labels', 'environment'):
        if before.get(key) != after.get(key):
            raise ValueError('Unexpected source/resource change: ' + key)
    # Cloud Functions may rebuild and copy unchanged source even for an env-only
    # update. Compare input settings and verified bytes, not output build IDs or
    # managed object generations. Never waive source provenance.
    build_settings = lambda f: {key: value for key, value in f['buildConfig'].items()
                                if key not in ('build', 'source', 'sourceProvenance')}
    if build_settings(before) != build_settings(after) or source_proof.get('reviewedBytesMatch') is not True:
        raise ValueError('Build settings or reviewed source bytes changed/unverified')
    if normalize_trigger(before.get('eventTrigger')) != normalize_trigger(after.get('eventTrigger')):
        raise ValueError('Unexpected trigger change')
    if normalize_iam(before_iam) != normalize_iam(after_iam):
        raise ValueError('Unexpected IAM change')
    return True


def qualify_unchanged_function(before, after):
    """Require exact untouched resource equality, ignoring only filter ordering."""
    previous = {**before, 'eventTrigger': normalize_trigger(before.get('eventTrigger'))}
    current = {**after, 'eventTrigger': normalize_trigger(after.get('eventTrigger'))}
    if previous != current:
        raise ValueError('Unexpected unaffected Function change')
    return True
