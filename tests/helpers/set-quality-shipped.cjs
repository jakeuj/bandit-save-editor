'use strict';
// The six set-quality and set-level cross-pool groups: an open flag needs its verification.json group record. Since the
// lightweight flow (docs/maintenance/lightweight.md) the historical first proofs are not re-bound to the current core text.
// Candidate tests start from `closed(k)`, so they keep exercising the closed and isolated-open paths.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('../../scripts/set-equipment-quality-data.cjs');
const root=path.join(__dirname,'../..'),groups=[...D.groups,...D.crossPoolGroups];
const undelivered=()=>fs.readFileSync(path.join(root,'index.html'),'utf8').includes('bandit-delivery:undelivered-pending-ui');
const closed=k=>{const c=structuredClone(k);for(const g of groups)c.verification[g]=false;return c;};
function assertShipped(k,proof=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8'))){
 for(const g of groups){
  if(k.verification[g]===false){assert.notEqual(proof.groups?.[g],true,g);continue;}
  assert.equal(k.verification[g],true,g);assert.equal(proof.groups?.[g],true,g);
  const quality=D.groups.includes(g),rec=quality?proof.migration?.qualityInitialVerification?.[g]:proof.migration?.crossPoolInitialVerification?.[g];
  assert.ok(rec,g);
 }
}
module.exports={groups,closed,assertShipped,undelivered};
