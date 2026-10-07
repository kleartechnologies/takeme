import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const Q=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(Q+'/scripts/production-function-runtime-manifest.json'));
const targets=manifest.functions.map(x=>x.name);
const p=ts.createProgram([Q+'/functions/src/index.ts'],{moduleResolution:ts.ModuleResolutionKind.Node10,allowImportingTsExtensions:true,noEmit:true});const c=p.getTypeChecker();
const index=p.getSourceFile(Q+'/functions/src/index.ts');const ex=c.getExportsOfModule(c.getSymbolAtLocation(index));
const skip=new Set(['marketplaceCall','resolutionCall','runGuardedTransaction','accountIsActive','visibleParticipantId']);
function ali(s){return s&&(s.flags&ts.SymbolFlags.Alias)?c.getAliasedSymbol(s):s;}
function top(d){return ts.isFunctionDeclaration(d)&&ts.isSourceFile(d.parent)||ts.isVariableDeclaration(d)&&ts.isVariableDeclarationList(d.parent)&&ts.isVariableStatement(d.parent.parent)&&ts.isSourceFile(d.parent.parent.parent);}
let rows=[];
for(const name of targets){const root=ali(ex.find(x=>x.name===name));if(!root)throw Error('Missing '+name);const seen=new Set();const graph=[];
 function walk(s){s=ali(s);if(!s||seen.has(s))return;seen.add(s);for(const d of s.declarations||[]){if(!d.getSourceFile().fileName.startsWith(Q+'/functions/src/')||!top(d))continue;graph.push({symbol:s.name,file:path.relative(Q,d.getSourceFile().fileName)});if(d.getSourceFile().fileName.endsWith('/account-lifecycle.ts')){if(skip.has(s.name))continue;if(['marketplaceMutationCall','resolutionMutationCall'].includes(s.name)){walk(c.getSymbolAtLocation(p.getSourceFile(Q+'/functions/src/account-lifecycle.ts').statements.find(x=>ts.isImportDeclaration(x)&&x.moduleSpecifier.text==='./account-eligibility').importClause.namedBindings.elements[0].name));continue;}}
 const visit=n=>{if(ts.isIdentifier(n))walk(c.getSymbolAtLocation(n));ts.forEachChild(n,visit)};ts.forEachChild(d,visit);
 }}walk(root);
 const guarded=graph.some(x=>x.symbol==='runtimePolicyContext'||x.symbol==='resolvePolicyContext');
 rows.push({name,source:graph[0].file,requiresPolicyIdentity:guarded,reason:guarded?'production policy/eligibility dependency':'read or unscoped derived work; no production policy-context invocation',symbols:graph.filter(x=>['marketplaceMutationCall','resolutionMutationCall','currentReleasePolicy','marketplaceAccountIsEligible','runtimePolicyContext','resolvePolicyContext'].includes(x.symbol))});
}
for (const row of rows) { const reviewed=manifest.functions.find(x=>x.name===row.name); if (row.source !== reviewed.source || row.requiresPolicyIdentity !== reviewed.requiresPolicyIdentity) throw Error('Runtime dependency classification requires review: '+row.name); }
console.log(JSON.stringify({total:rows.length,requires:rows.filter(x=>x.requiresPolicyIdentity).length,notApplicable:rows.filter(x=>!x.requiresPolicyIdentity).length,classificationMatchesReviewedManifest:true}));
