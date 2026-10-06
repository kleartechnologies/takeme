"""Offline review of the owner-approved private rollback bundle. No apply mode."""
import argparse
import hashlib
import json
from pathlib import Path
from rollback_inventory import REFERENCE, verify_inventory


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_review(manifest_path):
    if not manifest_path.is_absolute() or manifest_path.is_symlink():
        raise ValueError('Absolute ordinary private manifest required')
    manifest_path = manifest_path.resolve(strict=True)
    if digest(manifest_path) != REFERENCE['reconciledManifestSha256']:
        raise ValueError('Not the approved reconciled manifest')
    manifest = json.loads(manifest_path.read_text())
    root = Path(manifest['root']).resolve(strict=True)
    if root != manifest_path.parent or any((p / '.git').exists() for p in [root, *root.parents]):
        raise ValueError('Rollback evidence must stay outside Git')
    if manifest['purpose'] != 'v1-rollback-review' or manifest['component'] != 'functions':
        raise ValueError('Wrong rollback component')
    for field in ['projectId', 'storageBucket']:
        if manifest[field] != REFERENCE[field]:
            raise ValueError('Wrong production identity')
    if manifest['baselineVerified'] is not True or any(manifest[k] is not False for k in
            ['deletionEnabled', 'paymentsEnabled', 'publicationApproved', 'deploymentApproved', 'productionModified']):
        raise ValueError('Rollback safety contract changed')
    names = set()
    for item in manifest['files']:
        name = item['path']
        parts = name.split('/')
        if not name or '\\' in name or name.startswith('/') or name in names or any(
                p in ['', '.', '..', '.git', 'node_modules', '__pycache__'] or p.startswith('.env') for p in parts):
            raise ValueError('Unsafe or duplicate rollback member')
        names.add(name)
        file = root / name
        if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(root):
            raise ValueError('Rollback member type/path mismatch')
        if file.stat().st_size != item['bytes'] or digest(file) != item['sha256']:
            raise ValueError('Rollback member checksum mismatch')
    evidence = REFERENCE['evidenceFiles']
    current = root / evidence['currentInventory']
    historical = root / evidence['historicalInventory']
    if digest(current) != REFERENCE['reconciledInventorySha256'] or digest(historical) != REFERENCE['historicalInventorySha256']:
        raise ValueError('Reviewed inventory checksum mismatch')
    result = verify_inventory(json.loads(current.read_text()), json.loads(historical.read_text()), root / evidence['rollbackPackages'])
    return {**result, 'manifestFilesVerified': len(names), 'rollbackReady': True,
            'manifestSha256': digest(manifest_path), 'deploymentAuthorized': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify_review(args.manifest)))
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, f'Rollback review refused: {error}\n')
