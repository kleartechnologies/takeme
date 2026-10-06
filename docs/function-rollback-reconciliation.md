# Production Function rollback reconciliation

Owner-approved local checkpoint after the safe maintenance-bridge abort. No deployment, policy/control activation, rule change, customer write or Phase 1 resumption is authorized here.

The failed verifier equated the generated temporary upload object with the deployed Function source. Google copied the reviewed bytes into generation-pinned managed deployment objects. The reviewed bridge bytes were correct, but the failed verification caused the batch to stop and the three touched Functions to be restored. Restoration created new revision IDs; matching old IDs is not a rollback-equivalence requirement.

`function-rollback-baseline-reference.json` is the Git reference for the approved reconciliation. It contains non-secret identities, historical/bridge/restored revision IDs and checksum pins. The authoritative current inventory, exact rollback packages, runtime readbacks, operation receipts and prior evidence remain in the separate private bundle outside Git. The local private pointer is named `current-production-function-rollback.json`. Its bundle contents must never be committed.

The reviewed baseline has 91 ACTIVE Functions, exact reviewed source/configuration equivalence and zero drift. Three serving revision pointers changed; the other 88 stayed unchanged. Source/runtime/environment/service-account/IAM/traffic verification for the three restorations passed. No bridge remains serving. Policy, maintenance and auction freeze remain absent/OFF; publication, deletion and payments remain OFF. These are point-in-time verification results, not permission to skip a fresh operational precheck.

## Durable bridge verification

`scripts/bridge_verification.py` preserves the approved fail-closed checks without a cloud SDK, credential loader, upload command or deployment implementation. The source reader is injected by the separately authorized deployment process. The verifier validates the project-owned managed bucket, region, Function object and generation **before** calling that reader. Prefer resolved deployment-source provenance. A temporary upload URL/object is neither a serving-source identity nor a required post-deployment read.

Require successful upload and completed deployment, a new ACTIVE/ready serving revision, unchanged approved runtime/configuration/IAM/traffic, exact reviewed source members and compiled hashes, and durable build/source/revision provenance. Missing files, extra files, changed bytes, duplicate ZIP members, symlinks, traversal and mismatched resources fail closed. ZIP timestamps and a copied source generation do not establish code drift. HTTPS absent/null trigger metadata and event-filter ordering may be normalized; changed trigger/filter values still fail.

The reviewed private deployment helper remains outside Git. Its source verification can use the tracked pure verifier with an authorized generation-pinned managed-source reader. Live ready-revision/100% traffic verification and safe maintenance-OFF status/authentication checks remain mandatory in that process. Passing an offline verifier alone does not establish complete operational bridge coverage.

## Offline inventory review

Python 3 standard library is required only for these operator/offline checks; no package installation or application runtime change is needed.

```sh
python3 -B scripts/verify-reconciled-rollback.py --manifest "$ROLLBACK_MANIFEST"
python3 -B tests/rollback_reconciliation_test.py
```

Set `ROLLBACK_MANIFEST` locally to the approved private reconciled manifest. Do not print credentials or capture private evidence into Git. The CLI checks the exact reviewed manifest/inventory pins, all package members and the 91-Function inventory against the preserved historical baseline. It has no apply/deploy selector or cloud access. Synthetic unit tests require no private artifact or credential.

Before any separately approved retry, refresh the remote baseline and safety state; preserve historical evidence. An unexpected revision is not accepted solely because ACTIVE. Accept a new rollback ID only after reviewed source/configuration/IAM/serving equivalence is proven, then append a new private reconciliation record under owner review. Use a fresh checksum-verified rollback-package upload when restoration is authorized; do not assume reusing an old managed generation restores its bytes.

All freeze/pause/public-read/upload-cutoff/900-second drain/quiescence/rollback/owner gates in the activation runbook remain authoritative. Do not automatically resume Phase 1, reopen writes or restore auction admission after a verification failure.
