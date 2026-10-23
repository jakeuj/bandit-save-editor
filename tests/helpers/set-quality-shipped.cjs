'use strict';
// The six set-quality and set-level cross-pool groups: closed until their first proofs merge (B8), then open only with their
// own matching record. A record still owing the B9 browser acceptance is allowed only while the outputs carry the undelivered
// snapshot marker. Candidate tests start from `closed(k)`, so they keep exercising the closed and isolated-open paths.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('../../scripts/set-equipment-quality-data.cjs'),P=require('../../scripts/set-equipment-quality-proof.cjs'),CP=require('../../scripts/set-equipment-level-cross-pool-proof.cjs');
const root=path.join(__dirname,'../..'),groups=[...D.groups,...D.crossPoolGroups];
const undelivered=()=>fs.readFileSync(path.join(root,'index.html'),'utf8').includes('bandit-delivery:undelivered-pending-ui');
const closed=k=>{const c=structuredClone(k);for(const g of groups)c.verification[g]=false;return c;};
function assertShipped(k,proof=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8')),source=fs.readFileSync(path.join(root,'src/core.js'),'utf8')){
 const opts={pendingUi:undelivered()};
 for(const g of groups){
  if(k.verification[g]===false){assert.notEqual(proof.groups?.[g],true,g);continue;}
  assert.equal(k.verification[g],true,g);assert.equal(proof.groups?.[g],true,g);
  const quality=D.groups.includes(g),rec=quality?proof.migration?.qualityInitialVerification?.[g]:proof.migration?.crossPoolInitialVerification?.[g];
  assert.equal((quality?P:CP).recordProblem(rec,g,k,source,opts),null,g);
 }
}
module.exports={groups,closed,assertShipped,undelivered};
