'use strict';
// Since the lightweight flow (docs/maintenance/lightweight.md) the historical composite proof is not re-bound to the current
// core. Tests that exercise the proof's structural checks rebase only the core identity of a cloned snapshot to the source.
const Core=require('../../scripts/core-source-proof.cjs'),A=require('../../scripts/migration-analysis.cjs');
module.exports=(proof,source)=>{const p=structuredClone(proof);Object.assign(p.migration.snapshot,{coreHash:Core.hash(source),coreHashAlgorithm:Core.algorithm,coreSlices:Core.slices(source,A.coreRoots)});return p;};
