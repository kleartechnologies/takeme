#!/usr/bin/env bash
# Run only during a separately authorized production callable repair, after
# the targeted Firebase deployment of functions:removeFixedListing. A normal
# Firebase callable deploy may not repair this existing Cloud Run IAM drift.
# Cloud Run admits CORS preflights; the Firebase callable still checks auth
# and listing ownership in functions/src/index.ts.
set -euo pipefail

if [[ $# -gt 1 || ( $# -eq 1 && $1 != "--apply" ) ]]; then
  echo "Usage: $0 [--apply]" >&2
  exit 2
fi

project=takeme-52b80
region=asia-southeast1
function_name=removeFixedListing
service_name=removefixedlisting

state=$(gcloud functions describe "$function_name" --v2 --project "$project" --region "$region" --format='value(state)')
if [[ $state != ACTIVE ]]; then
  echo "Refusing invoker repair: $function_name is not ACTIVE in $project/$region." >&2
  exit 1
fi

has_invoker() {
  gcloud run services get-iam-policy "$service_name" --project "$project" --region "$region" --format=json |
    jq -e 'any(.bindings[]?; .role == "roles/run.invoker" and any(.members[]?; . == "allUsers"))' >/dev/null
}

if has_invoker; then
  echo "$function_name already has the required Cloud Run invoker binding."
  exit 0
fi

if [[ ${1:-} != --apply ]]; then
  echo "$function_name is missing allUsers/roles.run.invoker on Cloud Run. No changes made."
  echo "After separate authorization, run this script with --apply."
  exit 1
fi

gcloud functions add-invoker-policy-binding "$function_name" \
  --project "$project" --region "$region" --member=allUsers --quiet

if ! has_invoker; then
  echo "Invoker repair did not verify; inspect Cloud Run IAM before any retry." >&2
  exit 1
fi
echo "$function_name Cloud Run invocation is configured; callable auth/owner checks remain in source."
