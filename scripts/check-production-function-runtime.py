"""Offline final deployment/readback gate. Private inventories must stay outside Git."""
import argparse
import json
import os
import subprocess
from pathlib import Path
from production_function_runtime import TARGETS, audit_function, plan_environment_patch, qualify_inventory


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inventory', required=True, type=Path)
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    for file in [args.inventory, args.output]:
        if file and file.resolve().is_relative_to(root):
            raise ValueError('Private runtime inventory/output cannot be inside the repository')
    subprocess.run(['node', str(root / 'scripts/audit-function-runtime-source.mjs')], check=True, capture_output=True)
    value = json.loads(args.inventory.read_text())
    functions = value['functions'] if isinstance(value, dict) else value
    functions = [f for f in functions if f['name'].split('/')[-1] in TARGETS]
    if len(functions) != len(TARGETS) or len({f['name'] for f in functions}) != len(TARGETS):
        raise ValueError('Incomplete final deployment inventory')
    if args.plan:
        if not args.output:
            raise ValueError('Plan requires a private output path')
        rows = [audit_function(f) for f in functions]
        patches = [plan_environment_patch(f) for f in functions]
        affected = [p for p in patches if p['deploymentRequired']]
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump({'audit': rows, 'affectedPatches': affected}, stream, indent=2)
        print(json.dumps({'total': len(rows), 'affected': len(affected), 'planOnly': True}))
    else:
        rows = qualify_inventory(functions)
        print(json.dumps({'total': len(rows), 'missingRequiredPins': 0, 'incorrectPins': 0, 'finalRuntimeQualified': True}))


if __name__ == '__main__':
    main()
