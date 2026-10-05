import { productionEnvironment } from "../functions/src/production-environment.ts";
import { stagingFirebaseProjectId } from "../functions/src/staging-environment.ts";

// Same minimal admission guard in historical and final rule candidates. No SDK,
// cloud operation, control write, legal activation or extra public permission.
export const auctionCreationRuleBlock = `    function auctionCreationControlAllows() {
      return request.auth != null
        && request.auth.token.aud in ['demo-takeme', '${stagingFirebaseProjectId}', '${productionEnvironment.projectId}']
        && (!exists(/databases/$(database)/documents/releaseControls/auctionCreation)
          || validAuctionCreationControl(get(/databases/$(database)/documents/releaseControls/auctionCreation).data));
    }
    function validAuctionCreationControl(control) {
      return control is map
        && control.keys().hasAll(['releaseTarget', 'projectId', 'auctionCreationPaused'])
        && control.keys().hasOnly(['releaseTarget', 'projectId', 'auctionCreationPaused'])
        && control.auctionCreationPaused is bool && control.auctionCreationPaused == false
        && control.projectId == request.auth.token.aud
        && ((control.releaseTarget == 'demo' && control.projectId == 'demo-takeme')
          || (control.releaseTarget == 'staging' && control.projectId == '${stagingFirebaseProjectId}')
          || (control.releaseTarget == 'production' && control.projectId == '${productionEnvironment.projectId}'));
    }
    function auctionRecord(data) {
      return data.get('listingType', '') in ['auction', 'buy_now_and_auction'];
    }
    function publishedUnfinishedAuction(data) {
      return auctionRecord(data) && data.get('status', '') == 'active'
        && data.get('auctionStatus', '') in ['active', 'scheduled'];
    }
    function auctionAdmissionAllowed() {
      return request.method == 'delete'
        || !auctionRecord(request.resource.data)
        || (request.method == 'update' && auctionRecord(resource.data)
          && (!publishedUnfinishedAuction(request.resource.data) || publishedUnfinishedAuction(resource.data)))
        || auctionCreationControlAllows();
    }
`;

export function prepareAuctionCreationRuleGuard(rules) {
  if (rules.includes('function auctionAdmissionAllowed(')) throw new Error('Auction admission guard already exists; double preparation refused.');
  const scope = '  match /databases/{database}/documents {\n';
  const listing = '    match /listings/{listingId} {';
  if (rules.split(scope).length !== 2 || rules.split(listing).length !== 2) throw new Error('Known Firestore/listing scope required.');
  const begin = rules.indexOf(listing), end = rules.indexOf('      match /bids/{bidId}', begin);
  if (end < 0) throw new Error('Known nested bid scope required.');
  const block = rules.slice(begin, end), pattern = /allow create, update, delete: if ([^;]+);/g;
  const matches = [...block.matchAll(pattern)];
  if (matches.length !== 1 || !matches[0][1].includes('isAdmin()')) throw new Error('Exact reviewed admin listing clause required.');
  const originalCondition = matches[0][1];
  const condition = `(${originalCondition}) && auctionAdmissionAllowed()`;
  const changed = block.replace(pattern, `allow create, update, delete: if ${condition};`);
  return { rules: (rules.slice(0, begin) + changed + rules.slice(end)).replace(scope, scope + auctionCreationRuleBlock),
    originalCondition, condition, clauseStart: begin + matches[0].index };
}
